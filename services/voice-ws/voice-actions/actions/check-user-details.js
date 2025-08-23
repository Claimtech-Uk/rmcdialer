/**
 * Check User Details Action
 * Looks up customer information and claims status
 */

import { voiceDatabaseService } from '../services/voice-database.js'
import { voiceSMSService } from '../services/voice-sms.js'

export async function checkUserDetailsAction(context, parameters) {
  const { callSid, from: phoneNumber } = context
  const { phone_number, claim_reference } = parameters

  // Use provided phone number or fall back to caller ID
  const searchPhone = phone_number || phoneNumber

  console.log('👤 [USER-DETAILS] Checking user details:', {
    callSid,
    searchPhone: voiceSMSService.maskPhoneNumber(searchPhone),
    hasClaimRef: !!claim_reference
  })

  try {
    // 1. Find user by phone number
    const user = await voiceDatabaseService.findUserByPhone(searchPhone)

    if (!user.found) {
      console.log('👤 [USER-DETAILS] User not found:', {
        searchPhone: voiceSMSService.maskPhoneNumber(searchPhone)
      })

      return {
        success: true, // Success in terms of completing the lookup
        message: "I couldn't find an account with that phone number in our system. You may need to register first, or there might be a different number associated with your claim.",
        data: {
          user_found: false,
          phone_searched: voiceSMSService.maskPhoneNumber(searchPhone),
          suggested_actions: ['verify_phone_number', 'register_new_account', 'provide_claim_reference']
        }
      }
    }

    // 2. Get user's claims information
    let claimsInfo = { claimCount: 0 }
    try {
      claimsInfo = await voiceDatabaseService.getUserClaims(user.id)
    } catch (error) {
      console.warn('⚠️ [USER-DETAILS] Could not fetch claims info:', error.message)
    }

    // 3. If specific claim reference provided, get those details too
    let specificClaim = null
    if (claim_reference) {
      try {
        const claimDetails = await voiceDatabaseService.getClaimByReference(claim_reference)
        if (claimDetails.found) {
          specificClaim = claimDetails
        }
      } catch (error) {
        console.warn('⚠️ [USER-DETAILS] Could not fetch specific claim:', error.message)
      }
    }

    // 4. Log the action
    await voiceDatabaseService.logVoiceAction({
      callSid,
      phoneNumber: searchPhone,
      userId: user.id,
      actionName: 'check_user_details',
      parameters: { phone_number: searchPhone, claim_reference },
      result: {
        userFound: true,
        claimCount: claimsInfo.claimCount,
        specificClaimFound: !!specificClaim
      }
    })

    // 5. Build response message
    let message = `Hello ${user.fullName || 'there'}! I found your account.`
    
    if (claimsInfo.claimCount === 0) {
      message += " You don't currently have any claims in our system."
    } else if (claimsInfo.claimCount === 1) {
      message += " You have 1 claim with us."
    } else {
      message += ` You have ${claimsInfo.claimCount} claims with us.`
    }

    if (specificClaim) {
      message += ` I can see your claim ${specificClaim.reference} with ${specificClaim.lender}. The status is currently ${specificClaim.status}.`
    }

    // 6. Return success response with user details
    const response = {
      success: true,
      message: message,
      data: {
        user_found: true,
        user_id: user.id,
        customer_name: user.fullName,
        first_name: user.firstName,
        last_name: user.lastName,
        email: user.email,
        phone: user.phone,
        claim_count: claimsInfo.claimCount,
        last_activity: claimsInfo.lastActivity,
        account_created: user.createdAt,
        specific_claim: specificClaim ? {
          reference: specificClaim.reference,
          status: specificClaim.status,
          lender: specificClaim.lender,
          estimated_amount: specificClaim.amount
        } : null
      }
    }

    console.log('✅ [USER-DETAILS] Successfully found user:', {
      userId: user.id,
      userName: user.fullName,
      claimCount: claimsInfo.claimCount,
      specificClaim: !!specificClaim
    })

    return response

  } catch (error) {
    console.error('❌ [USER-DETAILS] Failed to check user details:', {
      error: error.message,
      stack: error.stack,
      callSid,
      searchPhone: voiceSMSService.maskPhoneNumber(searchPhone)
    })

    return {
      success: false,
      message: "I'm having trouble accessing your account details right now. Please try again in a moment or contact us directly.",
      error: error.message,
      data: {
        phone_searched: voiceSMSService.maskPhoneNumber(searchPhone),
        error_type: 'system_error'
      }
    }
  }
}
