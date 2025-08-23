#!/usr/bin/env node

/**
 * Voice Provider Selector
 * Automatically starts the appropriate voice service based on environment configuration
 */

import { spawn } from 'child_process'
import process from 'process'

const VOICE_PROVIDER = process.env.VOICE_PROVIDER || 'openai'
const PORT = process.env.PORT || 8080

console.log('🎙️ Voice Service Provider Selector')
console.log(`🔧 Provider: ${VOICE_PROVIDER}`)
console.log(`🌐 Port: ${PORT}`)
console.log(`🌍 Environment: ${process.env.ENVIRONMENT_NAME || 'staging-development'}`)

let serverFile = 'server.js'
let providerName = 'OpenAI Realtime API'

switch (VOICE_PROVIDER.toLowerCase()) {
  case 'hume':
  case 'hume-evi':
    serverFile = 'hume-server.js'
    providerName = 'Hume EVI'
    break
    
  case 'openai':
  case 'openai-realtime':
  default:
    serverFile = 'server.js'
    providerName = 'OpenAI Realtime API'
    break
}

console.log(`🚀 Starting ${providerName} voice service...`)
console.log(`📁 Server file: ${serverFile}`)
console.log('─'.repeat(50))

// Start the appropriate server
const child = spawn('node', [serverFile], {
  stdio: 'inherit',
  env: process.env
})

// Handle process signals
process.on('SIGTERM', () => {
  console.log('\n📤 Received SIGTERM, shutting down gracefully...')
  child.kill('SIGTERM')
})

process.on('SIGINT', () => {
  console.log('\n📤 Received SIGINT, shutting down gracefully...')
  child.kill('SIGINT')
})

// Handle child process events
child.on('error', (error) => {
  console.error(`❌ Failed to start ${providerName} service:`, error)
  process.exit(1)
})

child.on('exit', (code, signal) => {
  if (signal) {
    console.log(`🛑 ${providerName} service terminated by signal: ${signal}`)
  } else {
    console.log(`🛑 ${providerName} service exited with code: ${code}`)
  }
  process.exit(code || 0)
})
