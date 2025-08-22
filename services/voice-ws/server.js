import http from 'http'
import { WebSocketServer } from 'ws'

const PORT = process.env.PORT || 8080
const ENVIRONMENT_NAME = process.env.ENVIRONMENT_NAME || 'staging-development'
const ALLOWED_ENVS = (process.env.AI_VOICE_ALLOWED_ENVIRONMENTS || 'staging-development').split(',')
const MAX_STREAMS = parseInt(process.env.VOICE_MAX_CONCURRENT_STREAMS || '2', 10)
const STREAM_TOKEN = process.env.VOICE_STREAM_TOKEN || ''

const server = http.createServer((req, res) => {
  if (req.url === '/healthz') {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ ok: true, env: ENVIRONMENT_NAME }))
    return
  }
  res.writeHead(404)
  res.end()
})

const wss = new WebSocketServer({ server, path: '/twilio/media' })

let activeConnections = 0

wss.on('connection', (ws) => {
  if (!ALLOWED_ENVS.includes(ENVIRONMENT_NAME)) {
    ws.close(1011, 'Env not allowed')
    return
  }
  if (activeConnections >= MAX_STREAMS) {
    ws.close(1013, 'Too many streams')
    return
  }
  activeConnections++

  let started = false

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(String(data))
      if (msg.event === 'start' && !started) {
        started = true
        const envParam = msg.start?.customParameters?.env
        const auth = msg.start?.customParameters?.auth
        if (envParam !== ENVIRONMENT_NAME) {
          ws.close(1008, 'Bad env')
          return
        }
        if (STREAM_TOKEN && auth !== STREAM_TOKEN) {
          ws.close(1008, 'Bad token')
          return
        }
        console.log('🎧 Twilio stream started', { env: envParam })
        // TODO: Bridge to OpenAI Realtime here
      }
      if (msg.event === 'media') {
        // TODO: forward msg.media.payload to Realtime session
      }
    } catch (e) {
      ws.close(1003, 'Bad frame')
    }
  })

  ws.on('close', () => {
    activeConnections = Math.max(0, activeConnections - 1)
  })
})

server.listen(PORT, () => {
  console.log(`WS server listening on :${PORT} (env=${ENVIRONMENT_NAME})`)
})


