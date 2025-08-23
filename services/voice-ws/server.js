import http from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import { voiceActionRegistry } from './voice-actions/voice-action-registry.js'

const PORT = process.env.PORT || 8080
const ENVIRONMENT_NAME = process.env.ENVIRONMENT_NAME || 'staging-development'
const ALLOWED_ENVS = (process.env.AI_VOICE_ALLOWED_ENVIRONMENTS || 'staging-development').split(',')
const MAX_STREAMS = parseInt(process.env.VOICE_MAX_CONCURRENT_STREAMS || '2', 10)
const STREAM_TOKEN = process.env.VOICE_STREAM_TOKEN || ''
let OPENAI_API_KEY = process.env.OPENAI_API_KEY || '' // Will be fetched from Secrets Manager
const AI_VOICE_MODEL = process.env.AI_VOICE_MODEL || 'gpt-4o-realtime-preview-2024-12-17'
const AI_VOICE_NAME = process.env.AI_VOICE_NAME || 'alloy'

// Fetch OpenAI API key from AWS Secrets Manager
async function fetchOpenAIKey() {
  try {
    // Try to import AWS SDK (will fail if not available)
    const { SecretsManagerClient, GetSecretValueCommand } = await import('@aws-sdk/client-secrets-manager')
    
    console.log('🔐 Fetching OpenAI API key from AWS Secrets Manager...')
    const client = new SecretsManagerClient({ region: 'eu-west-1' })
    
    const response = await client.send(
      new GetSecretValueCommand({
        SecretId: 'dev/openai/voice',
        VersionStage: 'AWSCURRENT'
      })
    )
    
    if (response.SecretString) {
      // The secret is a JSON object with the key
      const secret = JSON.parse(response.SecretString)
      OPENAI_API_KEY = secret.OPENAI_API_KEY || secret.apiKey || secret.key || response.SecretString
      console.log('✅ OpenAI API key fetched from Secrets Manager')
    }
  } catch (error) {
    console.log('⚠️ Could not fetch from Secrets Manager, using environment variable')
    console.log('   Error:', error.message)
    // Fall back to environment variable if AWS SDK not available or fetch fails
  }
}

// Initialize the API key fetch
fetchOpenAIKey()

// OpenAI Realtime API endpoint
const OPENAI_REALTIME_URL = 'wss://api.openai.com/v1/realtime'

const server = http.createServer((req, res) => {
  if (req.url === '/healthz') {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ 
      ok: true, 
      env: ENVIRONMENT_NAME,
      activeStreams: activeConnections,
      maxStreams: MAX_STREAMS,
      openaiConfigured: !!OPENAI_API_KEY
    }))
    return
  }
  res.writeHead(404)
  res.end()
})

const wss = new WebSocketServer({ server, path: '/twilio/media' })

let activeConnections = 0

// Session manager to track Twilio <-> OpenAI bridges
const sessions = new Map()

class VoiceSession {
  constructor(twilioWs, streamSid, callSid) {
    this.twilioWs = twilioWs
    this.streamSid = streamSid
    this.callSid = callSid
    this.openaiWs = null
    this.audioBuffer = []
    this.isConnected = false
    this.startTime = Date.now()
  }

  async connectToOpenAI() {
    if (!OPENAI_API_KEY) {
      console.error('❌ OpenAI API key not configured')
      return false
    }

    try {
      // Connect to OpenAI Realtime API
      const url = `${OPENAI_REALTIME_URL}?model=${AI_VOICE_MODEL}`
      this.openaiWs = new WebSocket(url, {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'OpenAI-Beta': 'realtime=v1'
        }
      })

      this.openaiWs.on('open', () => {
        console.log(`🤖 OpenAI Realtime connected for call ${this.callSid}`)
        this.isConnected = true
        
        // Configure session with OpenAI best practices
        this.openaiWs.send(JSON.stringify({
          type: 'session.update',
          session: {
            modalities: ['text', 'audio'],
            instructions: `You are a helpful AI assistant for Resolve My Claim. 
              You're helping customers with their motor finance compensation claims in the UK.
              
              SPEAKING STYLE - CRITICAL:
              - Speak English (UK) with a modern RP accent (General Southern British)
              - Use UK spellings (colour, realise, centre, organised, etc.)
              - Sound friendly, modern, and upbeat—natural, never pompous
              - Pace slightly faster than casual conversation
              - Vary sentence length for natural flow
              - Add brief pauses only before key points when helpful
              - Use contractions naturally: "I'll", "we're", "that's", "you'll", "can't", "won't"
              - Allow words to flow together naturally (linking/elision) when it sounds right
              - Avoid Americanisms unless in a direct quote
              - If accent drifts, ease back to UK RP over the next sentence
              
              CORE KNOWLEDGE - MOTOR FINANCE CLAIMS:
              
              WHAT THIS IS ABOUT:
              - Motor finance brokers/dealers secretly increased interest rates 2007-2021 to earn higher commissions
              - FCA investigated and found widespread mis-selling affecting millions
              - Claims are based on DCA (Discretionary Commission Arrangements) and unfair relationships under Section 140A
              - Supreme Court 2024 ruling confirmed both pathways remain valid
              - FCA confirmed £9-18 billion total compensation scheme coming by end-2025
              
              ELIGIBILITY & SCOPE:
              - PCP and HP agreements 2007-2021 mainly affected
              - Each agreement is a separate case 
              - Complaints are made against lenders/finance providers
              - We can find old agreements back to 2007 (lenders often delete after 6 years)
              
              TIMING & PROCESS:
              - FCA pause until December 4, 2025, but customers can complain now
              - Most payments expected early 2026
              - We're FCA-regulated (ref 838936) and backed by Prowse Phillips Law
              - No-win-no-fee with capped rates at 30% + VAT (sliding scale)
              - Process: Sign up → find agreements → assess claims → lodge complaints → recover money
              
              CONVERSATION APPROACH:
              - Be empathetic and solution-focused
              - Address common concerns: legitimacy, DIY options, fees, timing
              - Allow interruptions and respond appropriately  
              - Keep responses brief unless detail is requested
              - Sound like a modern, professional British assistant
              - Maintain natural warmth and helpfulness`,
            voice: AI_VOICE_NAME,
            input_audio_format: 'g711_ulaw',  // Twilio's format
            output_audio_format: 'g711_ulaw', // Twilio's format
            input_audio_transcription: {
              model: 'whisper-1'
            },
            turn_detection: {
              type: 'server_vad',
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 200,  // Reduced for more responsive interruptions
              create_response: true       // Auto-respond when user stops speaking
            },
            tools: [
              // Dynamic business action functions
              ...voiceActionRegistry.getOpenAIFunctions(),
              // Knowledge base search function (local implementation)
              {
                type: 'function',
                function: {
                  name: 'search_knowledge_base',
                  description: 'Search detailed knowledge base for specific information about motor finance claims, objections, processes, or regulations',
                  parameters: {
                    type: 'object',
                    properties: {
                      query: { 
                        type: 'string',
                        description: 'What to search for (e.g. "Supreme Court ruling", "DCA definition", "objection handling", "fees structure")'
                      },
                      category: {
                        type: 'string',
                        enum: ['legitimacy', 'eligibility', 'timing', 'process', 'fees', 'regulations', 'objections'],
                        description: 'Category of information needed'
                      }
                    },
                    required: ['query']
                  }
                }
              }
            ],
            tool_choice: 'auto',
            temperature: 0.8,
            max_response_output_tokens: 4096
          }
        }))

        // Process any buffered audio
        if (this.audioBuffer.length > 0) {
          console.log(`📦 Sending ${this.audioBuffer.length} buffered audio chunks`)
          this.audioBuffer.forEach(chunk => {
            this.sendAudioToOpenAI(chunk)
          })
          this.audioBuffer = []
        }
      })

      this.openaiWs.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString())
          this.handleOpenAIMessage(msg)
        } catch (e) {
          console.error('❌ Failed to parse OpenAI message:', e)
        }
      })

      this.openaiWs.on('error', (error) => {
        console.error(`❌ OpenAI WebSocket error for call ${this.callSid}:`, error)
        this.cleanup()
      })

      this.openaiWs.on('close', () => {
        console.log(`🔌 OpenAI connection closed for call ${this.callSid}`)
        this.isConnected = false
        this.cleanup()
      })

      return true
    } catch (error) {
      console.error(`❌ Failed to connect to OpenAI for call ${this.callSid}:`, error)
      return false
    }
  }

  handleOpenAIMessage(msg) {
    switch (msg.type) {
      case 'session.created':
        console.log(`✅ OpenAI session created for call ${this.callSid}`)
        break

      case 'response.audio.delta':
        // Forward audio back to Twilio
        if (msg.delta) {
          this.sendAudioToTwilio(msg.delta)
        }
        break

      case 'response.audio.done':
        console.log(`🎵 Audio response complete for call ${this.callSid}`)
        break

      case 'response.text.delta':
        // Log transcript for debugging
        if (msg.delta) {
          process.stdout.write(msg.delta)
        }
        break

      case 'response.done':
        console.log(`\n✅ Response complete for call ${this.callSid}`)
        break

      case 'input_audio_buffer.speech_started':
        console.log(`🎤 User started speaking on call ${this.callSid}`)
        break

      case 'input_audio_buffer.speech_stopped':
        console.log(`🤐 User stopped speaking on call ${this.callSid}`)
        break

      case 'conversation.item.created':
        if (msg.item?.role === 'user') {
          console.log(`💬 User message on call ${this.callSid}:`, msg.item.content?.[0]?.transcript || '(audio)')
        }
        break

      case 'response.function_call_arguments.done':
        // Handle tool calls
        console.log(`🔧 Tool call on ${this.callSid}: ${msg.name}`, msg.arguments)
        this.handleToolCall(msg.name, msg.arguments, msg.call_id)
        break

      case 'error':
        console.error(`❌ OpenAI error for call ${this.callSid}:`, msg.error)
        break

      default:
        // Log other events for debugging
        if (process.env.DEBUG_OPENAI === 'true') {
          console.log(`[OpenAI Event] ${msg.type}`)
        }
    }
  }

  sendAudioToOpenAI(base64Audio) {
    if (!this.isConnected) {
      // Buffer audio if not yet connected
      this.audioBuffer.push(base64Audio)
      return
    }

    try {
      this.openaiWs.send(JSON.stringify({
        type: 'input_audio_buffer.append',
        audio: base64Audio
      }))
    } catch (error) {
      console.error(`❌ Failed to send audio to OpenAI for call ${this.callSid}:`, error)
    }
  }

  sendAudioToTwilio(base64Audio) {
    try {
      this.twilioWs.send(JSON.stringify({
        event: 'media',
        streamSid: this.streamSid,
        media: {
          payload: base64Audio
        }
      }))
    } catch (error) {
      console.error(`❌ Failed to send audio to Twilio for call ${this.callSid}:`, error)
    }
  }

  async handleToolCall(toolName, args, callId) {
    console.log(`🔧 [OpenAI] Processing tool: ${toolName} for call ${this.callSid}`)
    
    // Parse arguments if they're a string
    const parsedArgs = typeof args === 'string' ? JSON.parse(args) : args
    
    let result = {}
    
    try {
      // Handle knowledge base search locally (not in action registry)
      if (toolName === 'search_knowledge_base') {
        result = await this.searchKnowledgeBase(parsedArgs.query, parsedArgs.category)
        console.log(`🧠 Knowledge search: "${parsedArgs.query}" in ${parsedArgs.category || 'all'}`)
      } else {
        // Use voice action registry for all business functions
        const context = {
          callSid: this.callSid,
          from: this.from || 'unknown',
          provider: 'openai'
        }
        
        result = await voiceActionRegistry.execute(toolName, context, parsedArgs)
      }
      
    } catch (error) {
      console.error(`❌ [OpenAI] Tool execution failed: ${toolName}`, {
        error: error.message,
        callSid: this.callSid
      })
      
      result = {
        success: false,
        error: error.message,
        message: "I'm sorry, I couldn't complete that action right now. Please try again or contact us directly."
      }
    }
    
    // Send tool result back to OpenAI
    if (this.openaiWs && this.openaiWs.readyState === WebSocket.OPEN) {
      this.openaiWs.send(JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id: callId,
          output: JSON.stringify(result)
        }
      }))
      
      // Trigger response generation after tool output
      this.openaiWs.send(JSON.stringify({
        type: 'response.create'
      }))
    }
  }

  // Knowledge base search method
  async searchKnowledgeBase(query, category) {
    // Simplified knowledge base - can be expanded with full KB_SUMMARY from modules/ai-agents/knowledge/kb-summary.ts
    const knowledgeBase = {
      legitimacy: {
        title: "Legitimacy & Credibility",
        content: [
          "This is a real industry-wide issue investigated by the FCA",
          "Motor finance brokers secretly increased rates 2007-2021 for higher commissions", 
          "FCA banned these practices in January 2021",
          "Supreme Court 2024 ruling confirmed claim pathways remain valid",
          "We're FCA-regulated (ref 838936) and backed by Prowse Phillips Law",
          "Multiple court cases already won by consumers"
        ]
      },
      eligibility: {
        title: "Who Can Claim", 
        content: [
          "PCP and HP agreements 2007-2021 mainly affected",
          "Each agreement is a separate case",
          "Complaints made against lenders/finance providers",
          "We can find old agreements back to 2007",
          "Lenders often delete records after 6 years"
        ]
      },
      fees: {
        title: "Costs & Fees",
        content: [
          "No-win-no-fee structure",
          "Capped at 30% + VAT on sliding scale", 
          "Lower percentage for higher recovery amounts",
          "You only pay if we successfully recover money",
          "No upfront costs"
        ]
      },
      timing: {
        title: "Timeline & Process",
        content: [
          "FCA pause until December 4, 2025",
          "Most payments expected early 2026",
          "Customers can still complain now",
          "£9-18 billion total compensation scheme confirmed",
          "We handle all lender chasing and communications"
        ]
      }
    }

    try {
      // Search for relevant information
      let searchResults = []
      const searchTerm = query.toLowerCase()

      // If category is specified, search within that category
      if (category && knowledgeBase[category]) {
        const categoryData = knowledgeBase[category]
        const relevantContent = categoryData.content.filter(item => 
          item.toLowerCase().includes(searchTerm)
        )
        
        if (relevantContent.length > 0) {
          searchResults = relevantContent
        }
      } else {
        // Search across all categories
        for (const [cat, data] of Object.entries(knowledgeBase)) {
          const relevantContent = data.content.filter(item => 
            item.toLowerCase().includes(searchTerm)
          )
          searchResults = searchResults.concat(relevantContent.map(content => 
            `${data.title}: ${content}`
          ))
        }
      }

      return {
        success: true,
        query: query,
        category: category || 'all',
        results: searchResults.slice(0, 3), // Limit to top 3 results
        found: searchResults.length > 0
      }
    } catch (error) {
      console.error('Knowledge base search error:', error)
      return {
        success: false,
        query: query,
        error: 'Search failed',
        results: []
      }
    }
  }

  cleanup() {
    if (this.openaiWs && this.openaiWs.readyState === WebSocket.OPEN) {
      this.openaiWs.close()
    }
    if (this.twilioWs && this.twilioWs.readyState === WebSocket.OPEN) {
      this.twilioWs.close()
    }
    sessions.delete(this.streamSid)
    activeConnections = Math.max(0, activeConnections - 1)
    
    const duration = Math.round((Date.now() - this.startTime) / 1000)
    console.log(`📊 Session ended for call ${this.callSid}. Duration: ${duration}s`)
  }
}

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
          // Validate environment and token
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

          console.log(`🎧 Twilio stream started`, { 
            env: envParam, 
            callSid,
            streamSid,
            from: msg.start?.customParameters?.from
          })

          // Create session and connect to OpenAI
          session = new VoiceSession(ws, streamSid, callSid)
          sessions.set(streamSid, session)
          
          const connected = await session.connectToOpenAI()
          if (!connected) {
            console.error(`❌ Failed to establish OpenAI connection for call ${callSid}`)
            ws.send(JSON.stringify({
              event: 'error',
              error: 'Failed to connect to AI service'
            }))
            session.cleanup()
          }
          break

        case 'media':
          // Forward audio to OpenAI
          if (session && msg.media?.payload) {
            session.sendAudioToOpenAI(msg.media.payload)
          }
          break

        case 'stop':
          console.log(`⏹️ Stream stop requested`)
          if (session) {
            session.cleanup()
          }
          break

        default:
          if (process.env.DEBUG_TWILIO === 'true') {
            console.log(`[Twilio Event] ${msg.event}`)
          }
      }
    } catch (e) {
      console.error('❌ Failed to process Twilio message:', e)
      ws.close(1003, 'Bad frame')
    }
  })

  ws.on('close', () => {
    if (session) {
      session.cleanup()
    } else {
      activeConnections = Math.max(0, activeConnections - 1)
    }
  })

  ws.on('error', (error) => {
    console.error('❌ Twilio WebSocket error:', error)
    if (session) {
      session.cleanup()
    }
  })
})

server.listen(PORT, () => {
  console.log(`
🚀 Voice WebSocket Server Started
   Port: ${PORT}
   Environment: ${ENVIRONMENT_NAME}
   Allowed Envs: ${ALLOWED_ENVS.join(', ')}
   Max Streams: ${MAX_STREAMS}
   OpenAI Model: ${AI_VOICE_MODEL}
   Voice: ${AI_VOICE_NAME}
   Token Required: ${!!STREAM_TOKEN}
   OpenAI Configured: ${!!OPENAI_API_KEY}
   Version: 0.2.1
  `)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, closing connections...')
  sessions.forEach(session => session.cleanup())
  server.close(() => {
    console.log('👋 Server closed')
    process.exit(0)
  })
})