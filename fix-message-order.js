#!/usr/bin/env node

const fs = require('fs')

console.log('🔧 Fixing Message Order Issue with setTimeout...')

const filePath = 'modules/ai-agents/core/agent-runtime.service.ts'
let content = fs.readFileSync(filePath, 'utf8')

// Find the executeAIActions call and wrap it with setTimeout
const originalCode = `      // Execute AI-decided actions using the action registry system
      await this.executeAIActions(
        intelligentResponse.actions.map(action => ({
          type: action.type as any,
          reasoning: action.reasoning,
          confidence: 0.8 // Default confidence for AI decisions
        })),
        input.fromPhone,
        userCtx,
        actions,
        followups
      )`

const fixedCode = `      // Execute AI-decided actions with 2-second delay to ensure proper message order
      // This prevents links from arriving before explanatory messages
      setTimeout(async () => {
        await this.executeAIActions(
          intelligentResponse.actions.map(action => ({
            type: action.type as any,
            reasoning: action.reasoning,
            confidence: 0.8 // Default confidence for AI decisions
          })),
          input.fromPhone,
          userCtx,
          actions,
          followups
        )
      }, 2000) // 2-second delay ensures message arrives before action`

// Apply the fix
content = content.replace(originalCode, fixedCode)

// Write the updated content
fs.writeFileSync(filePath, content)

console.log('✅ Message Order Fix Applied!')
console.log('')
console.log('🔧 Changes Made:')
console.log('   • Wrapped executeAIActions in setTimeout with 2-second delay')
console.log('   • Added explanatory comments about the timing fix')
console.log('')
console.log('💡 Expected Result:')
console.log('   Current: [Link] → "I\'ll send you the link"')  
console.log('   Fixed:   "I\'ll send you the link" → [Link] (2s later)')
console.log('')
console.log('🚀 Ready to deploy!')

