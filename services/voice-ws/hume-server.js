import http from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import { voiceActionRegistry } from './voice-actions/voice-action-registry.js'

// Hume EVI Configuration
const PORT = process.env.PORT || 8080
const ENVIRONMENT_NAME = process.env.ENVIRONMENT_NAME || 'staging-development'
const ALLOWED_ENVS = (process.env.AI_VOICE_ALLOWED_ENVIRONMENTS || 'staging-development').split(',')
const MAX_STREAMS = parseInt(process.env.VOICE_MAX_CONCURRENT_STREAMS || '2', 10)
const STREAM_TOKEN = process.env.VOICE_STREAM_TOKEN || ''
let HUME_API_KEY = process.env.HUME_API_KEY || ''
const HUME_CONFIG_ID = process.env.HUME_CONFIG_ID || ''

// Fetch Hume API key from AWS Secrets Manager
async function fetchHumeKey() {
  try {
    const { SecretsManagerClient, GetSecretValueCommand } = await import('@aws-sdk/client-secrets-manager')
    
    console.log('🔐 Fetching Hume API key from AWS Secrets Manager...')
    const client = new SecretsManagerClient({ region: 'eu-west-1' })
    
    const response = await client.send(
      new GetSecretValueCommand({
        SecretId: 'dev/hume/voice',
        VersionStage: 'AWSCURRENT'
      })
    )
    
    if (response.SecretString) {
      const secret = JSON.parse(response.SecretString)
      HUME_API_KEY = secret.HUME_API_KEY || secret.apiKey || secret.key || response.SecretString
      console.log('✅ Hume API key fetched from Secrets Manager')
    }
  } catch (error) {
    console.log('⚠️ Could not fetch from Secrets Manager, using environment variable')
    console.log('   Error:', error.message)
  }
}

// Initialize the API key fetch
fetchHumeKey()

// Hume EVI WebSocket endpoint  
const HUME_EVI_URL = 'wss://api.hume.ai/v0/evi/ws'

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ 
      ok: true,
      provider: 'hume-evi',
      env: ENVIRONMENT_NAME,
      activeStreams: activeConnections,
      maxStreams: MAX_STREAMS,
      humeConfigured: !!HUME_API_KEY,
      configId: HUME_CONFIG_ID ? 'SET' : 'NOT SET'
    }))
    return
  }
  res.writeHead(404)
  res.end()
})

const wss = new WebSocketServer({ server, path: '/twilio/media' })
let activeConnections = 0
const sessions = new Map()

class HumeEVISession {
  constructor(twilioWs, streamSid, callSid) {
    this.twilioWs = twilioWs
    this.streamSid = streamSid
    this.callSid = callSid
    this.humeWs = null
    this.audioBuffer = []
    this.startTime = Date.now()
    this.isConnected = false
    this.emotionData = []
  }

  async connectToHumeEVI() {
    if (!HUME_API_KEY) {
      console.error('❌ Hume API key not configured')
      return false
    }

    if (!HUME_CONFIG_ID) {
      console.error('❌ Hume Config ID not configured')
      return false
    }

    try {
      // Connect to Hume EVI WebSocket with authentication
      this.humeWs = new WebSocket(HUME_EVI_URL, {
        headers: {
          'X-Hume-Api-Key': HUME_API_KEY,
        }
      })

      this.humeWs.on('open', () => {
        console.log(`🎭 Hume EVI connected for call ${this.callSid}`)
        this.isConnected = true
        
        // Send session configuration for Hume EVI
        this.humeWs.send(JSON.stringify({
          type: 'session_config',
          config: {
            config_id: HUME_CONFIG_ID,
            audio_config: {
              encoding: 'linear16',
              sample_rate: 8000,
              channels: 1
            },
            language: 'en-GB',
            session_settings: {
              custom_session_id: this.callSid,
              context: {
                caller_type: 'motor_finance_customer',
                call_purpose: 'claim_inquiry',
                preferred_style: 'british_professional'
              }
            }
          }
        }))

        // Process any buffered audio
        this.audioBuffer.forEach(audio => this.sendAudioToHume(audio))
        this.audioBuffer = []
      })

      this.humeWs.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString())
          this.handleHumeMessage(msg)
        } catch (error) {
          console.error(`❌ Error parsing Hume message for call ${this.callSid}:`, error)
        }
      })

      this.humeWs.on('close', (code, reason) => {
        console.log(`🔌 Hume EVI disconnected for call ${this.callSid}: ${code} - ${reason}`)
        this.isConnected = false
      })

      this.humeWs.on('error', (error) => {
        console.error(`❌ Hume EVI error for call ${this.callSid}:`, error)
      })

      return true
    } catch (error) {
      console.error(`❌ Failed to connect to Hume EVI for call ${this.callSid}:`, error)
      return false
    }
  }

  handleHumeMessage(msg) {
    switch (msg.type) {
      case 'audio_output':
        // Convert Hume's audio to Twilio format and send back
        if (msg.data) {
          // Note: May need format conversion here depending on Hume's output format
          this.twilioWs.send(JSON.stringify({
            event: 'media',
            streamSid: this.streamSid,
            media: {
              payload: msg.data
            }
          }))
        }
        break

      case 'user_message':
        console.log(`💬 User message on call ${this.callSid}:`, msg.message?.content || '(audio only)')
        break

      case 'assistant_message': 
        console.log(`🎭 Hume response on call ${this.callSid}:`, msg.message?.content || '(audio response)')
        break

      case 'user_interruption':
        console.log(`⚡ User interruption detected on call ${this.callSid}`)
        break

      case 'emotion_features':
        // Store emotion data for analysis
        this.emotionData.push({
          timestamp: Date.now(),
          emotions: msg.emotions,
          prosody: msg.prosody,
          confidence: msg.confidence
        })
        
        // Log significant emotional states
        if (msg.emotions && msg.confidence > 0.7) {
          const topEmotion = Object.entries(msg.emotions)
            .sort(([,a], [,b]) => b - a)[0]
          
          if (topEmotion && topEmotion[1] > 0.5) {
            console.log(`😊 Strong emotion detected on call ${this.callSid}: ${topEmotion[0]} (${(topEmotion[1] * 100).toFixed(1)}%)`)
          }
        }
        break

      case 'function_call':
        // Handle any function calls if configured in Hume
        this.handleHumeToolCall(msg.function_name, msg.parameters, msg.call_id)
        break

      case 'session_status':
        console.log(`📊 Hume session status for call ${this.callSid}:`, msg.status)
        break

      case 'error':
        console.error(`❌ Hume EVI error for call ${this.callSid}:`, msg.error)
        break

      default:
        if (process.env.DEBUG_HUME === 'true') {
          console.log(`[Hume Event] ${msg.type}`, msg)
        }
    }
  }

  sendAudioToHume(base64Audio) {
    if (!this.isConnected) {
      // Buffer audio if not yet connected
      this.audioBuffer.push(base64Audio)
      return
    }

    if (this.humeWs && this.humeWs.readyState === WebSocket.OPEN) {
      try {
        // Convert Twilio's mulaw (g711_ulaw) to linear16 PCM for Hume
        const convertedAudio = this.convertMulawToLinear16(base64Audio)
        
        this.humeWs.send(JSON.stringify({
          type: 'audio_input',
          data: convertedAudio,
          timestamp: Date.now()
        }))
      } catch (error) {
        console.error(`❌ Error converting audio for Hume on call ${this.callSid}:`, error)
      }
    }
  }

  async handleHumeToolCall(functionName, parameters, callId) {
    console.log(`🔧 [Hume] Processing tool: ${functionName} for call ${this.callSid}`)
    
    let result = {}
    
    try {
      // Use voice action registry for all business functions
      const context = {
        callSid: this.callSid,
        from: this.from || 'unknown',
        provider: 'hume'
      }
      
      result = await voiceActionRegistry.execute(functionName, context, parameters)
      
    } catch (error) {
      console.error(`❌ [Hume] Tool execution failed: ${functionName}`, {
        error: error.message,
        callSid: this.callSid
      })
      
      result = {
        success: false,
        error: error.message,
        message: "I'm sorry, I couldn't complete that action right now. Please try again or contact us directly."
      }
    }

    // Send function result back to Hume
    if (this.humeWs && this.humeWs.readyState === WebSocket.OPEN) {
      this.humeWs.send(JSON.stringify({
        type: 'function_response',
        call_id: callId,
        result: result
      }))
    }
  }

  getEmotionalSummary() {
    if (this.emotionData.length === 0) return 'No emotional data recorded'

    // Analyze dominant emotions throughout the call
    const emotionCounts = {}
    this.emotionData.forEach(data => {
      if (data.emotions && data.confidence > 0.6) {
        Object.entries(data.emotions).forEach(([emotion, score]) => {
          if (score > 0.4) {
            emotionCounts[emotion] = (emotionCounts[emotion] || 0) + score
          }
        })
      }
    })

    const topEmotions = Object.entries(emotionCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([emotion, score]) => `${emotion}: ${score.toFixed(2)}`)

    return `Dominant emotions: ${topEmotions.join(', ')}`
  }

  /**
   * Convert Twilio's mulaw (g711_ulaw) audio to linear16 PCM for Hume
   * This is a basic conversion - for production use a proper audio library
   */
  convertMulawToLinear16(base64MulawAudio) {
    try {
      // Decode base64 to buffer
      const mulawBuffer = Buffer.from(base64MulawAudio, 'base64')
      
      // Simple mulaw to linear16 conversion lookup table (simplified)
      // For production, use a proper audio conversion library like 'node-ffmpeg' or 'alsa'
      const linear16Buffer = Buffer.alloc(mulawBuffer.length * 2)
      
      for (let i = 0; i < mulawBuffer.length; i++) {
        // Basic mulaw to linear16 conversion
        const mulawSample = mulawBuffer[i]
        const linear16Sample = this.mulawToLinear16Sample(mulawSample)
        
        // Write as little-endian 16-bit
        linear16Buffer.writeInt16LE(linear16Sample, i * 2)
      }
      
      return linear16Buffer.toString('base64')
    } catch (error) {
      console.error('❌ Audio conversion error:', error)
      return base64MulawAudio // Return original if conversion fails
    }
  }

  /**
   * Convert a single mulaw sample to linear16
   * Based on ITU-T G.711 standard
   */
  mulawToLinear16Sample(mulawByte) {
    const sign = (mulawByte & 0x80) ? -1 : 1
    const exponent = (mulawByte & 0x70) >> 4
    const mantissa = mulawByte & 0x0F
    
    let sample = (mantissa << (exponent + 3)) + (1 << (exponent + 2))
    if (exponent === 0) sample += 132
    else sample += 132 - (1 << (exponent + 2))
    
    return sign * Math.min(sample, 32767)
  }

  cleanup() {
    if (this.humeWs && this.humeWs.readyState === WebSocket.OPEN) {
      this.humeWs.close()
    }
    if (this.twilioWs && this.twilioWs.readyState === WebSocket.OPEN) {
      this.twilioWs.close()
    }
    sessions.delete(this.streamSid)
    activeConnections = Math.max(0, activeConnections - 1)
    
    const duration = Math.round((Date.now() - this.startTime) / 1000)
    const emotionalSummary = this.getEmotionalSummary()
    
    console.log(`📊 Hume EVI session ended for call ${this.callSid}`)
    console.log(`   Duration: ${duration}s`)
    console.log(`   ${emotionalSummary}`)
  }
}

// WebSocket connection handler
wss.on('connection', (ws) => {
  // Environment check
  if (!ALLOWED_ENVS.includes(ENVIRONMENT_NAME)) {
    console.log(`🚫 Connection rejected: env ${ENVIRONMENT_NAME} not in ${ALLOWED_ENVS}`)
    ws.close(1011, 'Env not allowed')
    return
  }

  // Capacity check
  if (activeConnections >= MAX_STREAMS) {
    console.log(`🚫 Connection rejected: at capacity (${activeConnections}/${MAX_STREAMS})`)
    ws.close(1013, 'Too many streams')
    return
  }

  activeConnections++
  let session = null

  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data.toString())

      switch (msg.event) {
        case 'start':
          const envParam = msg.start?.customParameters?.env
          const auth = msg.start?.customParameters?.auth
          const callSid = msg.start?.customParameters?.callSid || msg.start?.callSid
          const streamSid = msg.start?.streamSid

          if (envParam !== ENVIRONMENT_NAME) {
            console.log(`🚫 Bad env: ${envParam} !== ${ENVIRONMENT_NAME}`)
            ws.close(1008, 'Bad env')
            return
          }

          if (STREAM_TOKEN && auth !== STREAM_TOKEN) {
            console.log(`🚫 Bad token`)
            ws.close(1008, 'Bad token')
            return
          }

          console.log(`🎧 Twilio stream started with Hume EVI`, { 
            env: envParam, 
            callSid,
            streamSid,
            from: msg.start?.customParameters?.from
          })

          // Create session and connect to Hume EVI
          session = new HumeEVISession(ws, streamSid, callSid)
          sessions.set(streamSid, session)
          
          const connected = await session.connectToHumeEVI()
          if (!connected) {
            console.error(`❌ Failed to connect to Hume EVI for call ${callSid}`)
            ws.close(1011, 'EVI connection failed')
          }
          break

        case 'media':
          if (session && msg.media?.payload) {
            session.sendAudioToHume(msg.media.payload)
          }
          break

        case 'stop':
          console.log(`🛑 Hume EVI stream stopped: ${msg.streamSid}`)
          if (session) {
            session.cleanup()
          }
          break
      }
    } catch (error) {
      console.error('❌ Error processing Twilio message:', error)
    }
  })

  ws.on('close', () => {
    if (session) {
      session.cleanup()
    }
  })
})

server.listen(PORT, () => {
  console.log(`🎭 Hume EVI Voice Service listening on port ${PORT}`)
  console.log(`🌍 Environment: ${ENVIRONMENT_NAME}`)
  console.log(`📊 Max concurrent streams: ${MAX_STREAMS}`)
  console.log(`🔑 Hume API configured: ${!!HUME_API_KEY}`)
  console.log(`⚙️ Hume Config ID: ${HUME_CONFIG_ID ? 'SET' : 'NOT SET'}`)
})
