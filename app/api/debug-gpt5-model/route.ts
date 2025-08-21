import { NextRequest, NextResponse } from 'next/server'
import { universalChat } from '@/modules/ai-agents/core/multi-provider-llm.client'
// import { getSmsAgent } from '@/modules/ai-agents/channels/sms/sms-agent.service'

export async function POST(request: NextRequest) {
  const debugResults = {
    timestamp: new Date().toISOString(),
    environmentCheck: {} as any,
    modelTests: [] as any[],
    smsAgentTest: null as any,
    recommendations: [] as string[]
  }

  try {
    console.log('🔧 Starting GPT-5 Model Debug Test')

    // 1️⃣ ENVIRONMENT CHECK
    debugResults.environmentCheck = {
      AI_SMS_MODEL: process.env.AI_SMS_MODEL || 'NOT SET',
      AI_SMS_SIMPLIFIED_MODE: process.env.AI_SMS_SIMPLIFIED_MODE || 'NOT SET',
      OPENAI_API_KEY: process.env.OPENAI_API_KEY ? 'SET' : 'NOT SET',
      OPENAI_API_KEY_PREFIX: process.env.OPENAI_API_KEY?.substring(0, 10) + '...' || 'N/A'
    }

    console.log('🔧 Environment Check:', debugResults.environmentCheck)

    // 2️⃣ MODEL AVAILABILITY TESTS
    const modelsToTest = [
      'gpt-5',           // User's requested model
      'gpt-4o',          // Alternative
      'gpt-4o-mini',     // Fallback
      'gpt-3.5-turbo'    // Basic fallback
    ]

    for (const model of modelsToTest) {
      console.log(`🧪 Testing model: ${model}`)
      
      const modelTest = {
        model,
        success: false,
        error: null as any,
        response: null as any,
        responseTime: 0
      }

      try {
        const startTime = Date.now()
        
        const result = await universalChat({
          system: "You are a helpful assistant. Respond with exactly: 'Model working: [MODEL_NAME]'",
          user: "Test message",
          model: model
        })

        modelTest.responseTime = Date.now() - startTime
        modelTest.success = true
        modelTest.response = result.content || ''
        
        console.log(`✅ ${model} - SUCCESS: ${(result.content || '').substring(0, 50)}...`)
        
      } catch (error: any) {
        modelTest.error = {
          message: error.message,
          code: error.code,
          status: error.status,
          type: error.type
        }
        
        console.log(`❌ ${model} - FAILED: ${error.message}`)
      }

      debugResults.modelTests.push(modelTest)
    }

    // 3️⃣ SMS AGENT TEST SKIPPED (import issue)
    debugResults.smsAgentTest = {
      success: null,
      skipped: true,
      reason: 'Import issue with getSmsAgent - focus on model testing'
    }

    // 4️⃣ GENERATE RECOMMENDATIONS
    const workingModels = debugResults.modelTests.filter(t => t.success)
    const gpt5Test = debugResults.modelTests.find(t => t.model === 'gpt-5')

    if (!gpt5Test?.success) {
      debugResults.recommendations.push('❌ gpt-5 is not available - OpenAI does not offer a model called "gpt-5"')
      debugResults.recommendations.push('💡 Switch to "gpt-4o" for best quality or "gpt-4o-mini" for cost efficiency')
    }

    if (workingModels.length === 0) {
      debugResults.recommendations.push('🚨 NO MODELS WORKING - Check your OPENAI_API_KEY')
    } else {
      const fastestModel = workingModels.reduce((prev, current) => 
        prev.responseTime < current.responseTime ? prev : current
      )
      debugResults.recommendations.push(`⚡ Fastest working model: ${fastestModel.model} (${fastestModel.responseTime}ms)`)
    }

    if (debugResults.environmentCheck.AI_SMS_SIMPLIFIED_MODE !== 'true') {
      debugResults.recommendations.push('⚠️ Set AI_SMS_SIMPLIFIED_MODE=true to use enhanced responses')
    }

    return NextResponse.json({
      success: true,
      summary: {
        workingModels: workingModels.length,
        totalModels: modelsToTest.length,
        gpt5Available: gpt5Test?.success || false,
        smsAgentWorking: 'skipped'
      },
      ...debugResults
    }, { status: 200 })

  } catch (error: any) {
    console.error('🔧 Debug test failed:', error)
    
    return NextResponse.json({
      success: false,
      error: {
        message: error.message,
        stack: error.stack
      },
      partialResults: debugResults
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: "GPT-5 Model Debug Endpoint",
    purpose: "Diagnose GPT-5 model issues and test alternatives", 
    usage: "POST to run comprehensive model tests",
    quickCheck: {
      AI_SMS_MODEL: process.env.AI_SMS_MODEL || 'NOT SET',
      OPENAI_API_KEY: process.env.OPENAI_API_KEY ? 'SET' : 'NOT SET'
    }
  })
}
