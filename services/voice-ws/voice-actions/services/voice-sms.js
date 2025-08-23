/**
 * Voice SMS Service
 * Handles SMS sending for voice interactions
 * Connects to Twilio for SMS delivery
 */

import crypto from 'crypto'

class VoiceSMSService {
  constructor() {
    this.twilioAccountSid = process.env.TWILIO_ACCOUNT_SID
    this.twilioAuthToken = process.env.TWILIO_AUTH_TOKEN
    this.twilioFromNumber = process.env.TWILIO_FROM_NUMBER
    
    if (!this.twilioAccountSid || !this.twilioAuthToken || !this.twilioFromNumber) {
      console.warn('⚠️ [VOICE-SMS] Twilio credentials not fully configured')
    }
  }

  /**
   * Send SMS message
   */
  async sendSMS(phoneNumber, message, options = {}) {
    try {
      // For development/testing - log instead of sending
      if (process.env.ENVIRONMENT_NAME === 'staging-development' && !process.env.ENABLE_REAL_SMS) {
        console.log('📱 [VOICE-SMS] Mock SMS sent:', {
          to: phoneNumber,
          from: this.twilioFromNumber,
          message: message.substring(0, 100) + '...',
          messageId: this.generateMockMessageId()
        })
        
        return {
          success: true,
          messageId: this.generateMockMessageId(),
          twilioSid: `SM${crypto.randomBytes(16).toString('hex')}`,
          status: 'sent'
        }
      }

      // Production SMS sending
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${this.twilioAccountSid}/Messages.json`
      
      const formData = new URLSearchParams({
        To: phoneNumber,
        From: this.twilioFromNumber,
        Body: message
      })

      const response = await fetch(twilioUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.twilioAccountSid}:${this.twilioAuthToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.text()
        throw new Error(`Twilio API error: ${response.status} - ${errorData}`)
      }

      const result = await response.json()

      console.log('✅ [VOICE-SMS] SMS sent successfully:', {
        to: phoneNumber,
        messageSid: result.sid,
        status: result.status
      })

      return {
        success: true,
        messageId: result.sid,
        twilioSid: result.sid,
        status: result.status
      }

    } catch (error) {
      console.error('❌ [VOICE-SMS] Failed to send SMS:', {
        error: error.message,
        phoneNumber: this.maskPhoneNumber(phoneNumber)
      })

      return {
        success: false,
        error: error.message,
        messageId: null
      }
    }
  }

  /**
   * Send portal link via SMS
   */
  async sendPortalLink(phoneNumber, userName, linkUrl, customMessage) {
    const greeting = userName ? `Hi ${userName}` : 'Hello'
    const defaultMessage = `${greeting},\n\nHere's your secure portal link: ${linkUrl}\n\nThis link expires in 24 hours for security.\n\nResolve My Claim`
    
    const message = customMessage || defaultMessage

    return await this.sendSMS(phoneNumber, message, {
      type: 'portal_link',
      linkUrl: linkUrl
    })
  }

  /**
   * Send callback confirmation via SMS
   */
  async sendCallbackConfirmation(phoneNumber, userName, callbackTime, reason) {
    const greeting = userName ? `Hi ${userName}` : 'Hello'
    const message = `${greeting},\n\nYour callback has been scheduled for ${callbackTime}.\n\nReason: ${reason || 'General inquiry'}\n\nWe'll call you at this number. Thanks!\n\nResolve My Claim`

    return await this.sendSMS(phoneNumber, message, {
      type: 'callback_confirmation',
      callbackTime: callbackTime
    })
  }

  /**
   * Send review link via SMS
   */
  async sendReviewLink(phoneNumber, userName) {
    const greeting = userName ? `Hi ${userName}` : 'Hello'
    const reviewUrl = 'https://uk.trustpilot.com/review/solvosolutions.co.uk'
    
    const message = `${greeting},\n\nThank you for using Resolve My Claim! We'd love your feedback:\n\n${reviewUrl}\n\nYour review helps others understand our service.\n\nThanks!`

    return await this.sendSMS(phoneNumber, message, {
      type: 'review_link',
      reviewUrl: reviewUrl
    })
  }

  /**
   * Send document upload link via SMS  
   */
  async sendDocumentLink(phoneNumber, userName, linkUrl, documentType) {
    const greeting = userName ? `Hi ${userName}` : 'Hello'
    const docType = documentType || 'documents'
    
    const message = `${greeting},\n\nPlease upload your ${docType} using this secure link:\n\n${linkUrl}\n\nThis link expires in 48 hours.\n\nResolve My Claim`

    return await this.sendSMS(phoneNumber, message, {
      type: 'document_link',
      documentType: docType,
      linkUrl: linkUrl
    })
  }

  /**
   * Generate magic/portal link
   */
  generatePortalLink(userId, linkType = 'claims') {
    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex')
    
    // In production, you'd save this token to database with expiration
    // For now, return a working dev link
    const baseUrl = process.env.MAIN_APP_URL || 'https://dev.solvosolutions.co.uk'
    
    const linkPaths = {
      'claims': '/claims',
      'documents': '/upload',
      'status': '/status',
      'portal': '/claims'
    }

    const path = linkPaths[linkType] || linkPaths['claims']
    
    return `${baseUrl}${path}?token=${token}&user=${userId}`
  }

  /**
   * Utility methods
   */
  generateMockMessageId() {
    return `voice_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
  }

  maskPhoneNumber(phoneNumber) {
    if (!phoneNumber || phoneNumber.length < 8) return phoneNumber
    return phoneNumber.replace(/(\d{3})\d{4}(\d{3})/, '$1****$2')
  }

  validatePhoneNumber(phoneNumber) {
    // Basic UK phone number validation
    const cleaned = phoneNumber.replace(/\D/g, '')
    
    // UK mobile (07xxx) or landline patterns
    const ukMobile = /^(\+44|0)7\d{9}$/
    const ukLandline = /^(\+44|0)[1-9]\d{8,9}$/
    
    return ukMobile.test(phoneNumber) || ukLandline.test(phoneNumber)
  }

  formatPhoneNumber(phoneNumber) {
    // Convert to E.164 format for Twilio
    let cleaned = phoneNumber.replace(/\D/g, '')
    
    // UK number handling
    if (cleaned.startsWith('44')) {
      return `+${cleaned}`
    } else if (cleaned.startsWith('07') || cleaned.startsWith('01') || cleaned.startsWith('02')) {
      return `+44${cleaned.substring(1)}`
    }
    
    return phoneNumber
  }
}

export const voiceSMSService = new VoiceSMSService()
