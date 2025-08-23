/**
 * Check Requirements Action
 * Checks what documents or information are still needed for a claim
 */

import { voiceDatabaseService } from '../services/voice-database.js'

export async function checkRequirementsAction(context, parameters) {
  const { callSid, from: phoneNumber } = context
  const { claim_reference } = parameters

  console.log('📝 [REQUIREMENTS] Checking claim requirements:', {
    callSid,
    claimReference: claim_reference
  })

  try {
    // 1. Get outstanding requirements
    const requirements = await voiceDatabaseService.getClaimRequirements(claim_reference)

    // 2. Log the action
    await voiceDatabaseService.logVoiceAction({
      callSid,
      phoneNumber,
      actionName: 'check_requirements',
      parameters: { claim_reference },
      result: {
        requirementsFound: requirements.found,
        requirementCount: requirements.requirements.length,
        completionStatus: requirements.completionStatus
      }
    })

    // 3. Build response based on requirements
    let message = ''
    
    if (requirements.completionStatus === 'complete') {
      message = `Great news! All requirements for claim ${claim_reference} have been completed. No additional documents or information are needed at this time.`
    } else if (requirements.requirements.length === 0) {
      message = `I couldn't find any outstanding requirements for claim ${claim_reference}. Your claim appears to be complete.`
    } else {
      message = `For claim ${claim_reference}, you still need to provide: `
      
      const requirementsList = requirements.requirements.map(req => {
        let item = req.description || req.type
        if (req.dueDate) {
          const dueDate = new Date(req.dueDate).toLocaleDateString('en-GB')
          item += ` (due ${dueDate})`
        }
        return item
      }).join(', ')
      
      message += requirementsList + '. Would you like me to send you a link to upload these documents?'
    }

    // 4. Return response
    const response = {
      success: true,
      message: message,
      data: {
        claim_reference: claim_reference,
        completion_status: requirements.completionStatus,
        outstanding_count: requirements.requirements.length,
        requirements: requirements.requirements.map(req => ({
          type: req.type,
          description: req.description,
          status: req.status,
          due_date: req.dueDate
        })),
        all_complete: requirements.completionStatus === 'complete'
      }
    }

    console.log('✅ [REQUIREMENTS] Successfully checked requirements:', {
      claimReference: claim_reference,
      outstandingCount: requirements.requirements.length,
      status: requirements.completionStatus
    })

    return response

  } catch (error) {
    console.error('❌ [REQUIREMENTS] Failed to check requirements:', {
      error: error.message,
      callSid,
      claimReference: claim_reference
    })

    return {
      success: false,
      message: "I'm having trouble checking your requirements right now. Please try again or contact us directly.",
      error: error.message,
      data: {
        claim_reference: claim_reference,
        error_type: 'system_error'
      }
    }
  }
}
