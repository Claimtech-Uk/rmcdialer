/**
 * Check Claim Details Action
 * Gets detailed information about a specific claim
 */

import { voiceDatabaseService } from '../services/voice-database.js'
import { voiceSMSService } from '../services/voice-sms.js'

export async function checkClaimDetailsAction(context, parameters) {
  const { callSid, from: phoneNumber } = context
  const { claim_reference } = parameters

  console.log('📋 [CLAIM-DETAILS] Checking claim details:', {
    callSid,
    claimReference: claim_reference
  })

  try {
    // 1. Find claim by reference
    const claim = await voiceDatabaseService.getClaimByReference(claim_reference)

    if (!claim.found) {
      return {
        success: true,
        message: `I couldn't find a claim with reference ${claim_reference}. Please double-check the reference number or contact us directly.`,
        data: {
          claim_found: false,
          reference_searched: claim_reference
        }
      }
    }

    // 2. Log the action
    await voiceDatabaseService.logVoiceAction({
      callSid,
      phoneNumber,
      userId: null, // We have claim but may not have matched user from voice
      actionName: 'check_claim_details',
      parameters: { claim_reference },
      result: {
        claimFound: true,
        claimStatus: claim.status,
        lender: claim.lender
      }
    })

    // 3. Build response message
    const statusDescriptions = {
      'pending': 'pending review',
      'under_review': 'currently under review',
      'approved': 'approved for compensation',
      'rejected': 'unfortunately been rejected',
      'paid': 'completed with payment made',
      'escalated': 'escalated for further review'
    }

    const statusDescription = statusDescriptions[claim.status] || claim.status
    
    let message = `I found your claim ${claim.reference}. `
    message += `This is your claim against ${claim.lender}. `
    message += `The current status is ${statusDescription}. `

    if (claim.amount) {
      message += `The estimated compensation amount is £${claim.amount}. `
    }

    if (claim.status === 'under_review') {
      message += `We're currently reviewing your case and will update you as soon as we have more information.`
    } else if (claim.status === 'approved') {
      message += `Congratulations! Your claim has been approved. You should receive payment details soon.`
    } else if (claim.status === 'pending') {
      message += `We're still processing your initial submission. This typically takes a few days.`
    }

    // 4. Return detailed response
    const response = {
      success: true,
      message: message,
      data: {
        claim_found: true,
        reference: claim.reference,
        status: claim.status,
        status_description: statusDescription,
        lender: claim.lender,
        estimated_amount: claim.amount,
        created_date: claim.createdAt,
        last_updated: claim.updatedAt,
        customer: {
          name: claim.customer.name,
          phone: voiceSMSService.maskPhoneNumber(claim.customer.phone)
        }
      }
    }

    console.log('✅ [CLAIM-DETAILS] Successfully found claim:', {
      reference: claim.reference,
      status: claim.status,
      lender: claim.lender
    })

    return response

  } catch (error) {
    console.error('❌ [CLAIM-DETAILS] Failed to check claim details:', {
      error: error.message,
      callSid,
      claimReference: claim_reference
    })

    return {
      success: false,
      message: "I'm having trouble accessing the claim details right now. Please try again or contact us directly.",
      error: error.message,
      data: {
        reference_searched: claim_reference,
        error_type: 'system_error'
      }
    }
  }
}
