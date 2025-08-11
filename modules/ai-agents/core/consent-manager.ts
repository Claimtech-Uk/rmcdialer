// Strict consent management for portal links
// Ensures links are only sent with explicit user permission

import { cacheService } from '@/lib/redis'

export type ConsentType = 'portal_link' | 'review_link' | 'callback'

export type ConsentStatus = {
  hasConsent: boolean
  reason: 'explicit_request' | 'offered_and_accepted' | 'no_consent' | 'cooldown'
  lastConsentAt?: number
  lastOfferAt?: number
  offerCount: number
}

export type ConsentOffer = {
  type: ConsentType
  offeredAt: number
  messageIndex: number
  context: string
}

const consentKey = (phone: string) => `consent:${phone}`
const cooldownKey = (phone: string, type: ConsentType) => `cooldown:${phone}:${type}`

export async function checkLinkConsent(
  phoneNumber: string, 
  userMessage: string,
  conversationContext?: { 
    messageCount: number,
    recentMessages?: Array<{direction: 'inbound' | 'outbound', body: string}>
  }
): Promise<ConsentStatus> {
  
  // 1. Check if portal link was already sent/mentioned in recent conversation
  if (conversationContext?.recentMessages) {
    const recentLinkActivity = checkRecentLinkActivity(conversationContext.recentMessages)
    
    if (recentLinkActivity.linkSentRecently || recentLinkActivity.linkMentionedRecently) {
      console.log('AI SMS | 🔗 Link already in recent conversation', {
        linkSent: recentLinkActivity.linkSentRecently,
        linkMentioned: recentLinkActivity.linkMentionedRecently,
        messagesAgo: recentLinkActivity.messagesAgo
      })
      
      // Don't send another link, should reference existing one instead
      return {
        hasConsent: false,
        reason: 'no_consent', // Will be handled by smart referencing
        offerCount: 0
      }
    }
  }
  
  // 2. Check for explicit link requests
  const explicitPatterns = [
    /(send|text|share)\s+(me\s+)?(the\s+)?(portal\s+)?link/i,
    /can\s+i\s+get\s+(the\s+)?(portal\s+)?link/i,
    /i\s+want\s+(the\s+)?(portal\s+)?link/i,
    /yes\s*,?\s*(send\s+)?(the\s+)?link/i,
    /yes\s+send\s+it/i, // "Yes send it" - explicit after offer
    /yes\s*,?\s*send/i, // "Yes, send" or "Yes send"
    /send\s+it/i, // "Send it" - clear intent
    /portal/i // Simple portal mention
  ]
  
  const hasExplicitRequest = explicitPatterns.some(pattern => pattern.test(userMessage))
  
  if (hasExplicitRequest) {
    // Check cooldown to prevent spam
    const cooldownSec = Number(process.env.AI_SMS_LINK_COOLDOWN_SECONDS || 3600) // 1 hour default
    const lastSent = await getLastLinkSent(phoneNumber)
    const now = Date.now()
    
    if (lastSent && (now - lastSent) < cooldownSec * 1000) {
      return {
        hasConsent: false,
        reason: 'cooldown',
        lastConsentAt: lastSent,
        offerCount: 0
      }
    }
    
    await recordLinkConsent(phoneNumber, 'explicit_request')
    return {
      hasConsent: true,
      reason: 'explicit_request',
      lastConsentAt: now,
      offerCount: 0
    }
  }
  
  // 2. Check for acceptance of recent offer
  const acceptancePatterns = [
    /^yes\s*$/i,
    /^yeah\s*$/i,
    /^sure\s*$/i,
    /^ok\s*$/i,
    /^okay\s*$/i,
    /yes\s*please/i,
    /that\s+would\s+be\s+great/i,
    /sounds\s+good/i
  ]
  
  const recentOffer = await getRecentConsentOffer(phoneNumber)
  const hasAcceptance = acceptancePatterns.some(pattern => pattern.test(userMessage.trim()))
  
  if (hasAcceptance && recentOffer && isOfferValid(recentOffer)) {
    await recordLinkConsent(phoneNumber, 'offered_and_accepted')
    return {
      hasConsent: true,
      reason: 'offered_and_accepted',
      lastConsentAt: Date.now(),
      lastOfferAt: recentOffer.offeredAt,
      offerCount: 0
    }
  }
  
  return {
    hasConsent: false,
    reason: 'no_consent',
    offerCount: 0
  }
}

export async function offerPortalLink(
  phoneNumber: string,
  context: string,
  messageIndex: number
): Promise<string> {
  const offer: ConsentOffer = {
    type: 'portal_link',
    offeredAt: Date.now(),
    messageIndex,
    context
  }
  
  await recordConsentOffer(phoneNumber, offer)
  
  // Return varied offer messages
  const offers = [
    "Would you like me to send your secure portal link?",
    "Shall I text you the portal link to get started?",
    "Would you like your portal link now to begin the process?",
    "Ready for your portal link to move forward?",
    "Would the portal link be helpful right now?"
  ]
  
  const offerHistory = await getOfferHistory(phoneNumber)
  const usedOffers = offerHistory.slice(-3).map(o => o.context)
  const availableOffers = offers.filter(offer => !usedOffers.includes(offer))
  
  if (availableOffers.length === 0) {
    return offers[0] // Fallback to first option
  }
  
  return availableOffers[Math.floor(Math.random() * availableOffers.length)]
}

async function getLastLinkSent(phoneNumber: string): Promise<number | null> {
  try {
    const data = await cacheService.get(cooldownKey(phoneNumber, 'portal_link'))
    return data ? parseInt(data as string) : null
  } catch {
    return null
  }
}

async function recordLinkConsent(phoneNumber: string, reason: string): Promise<void> {
  const now = Date.now()
  await cacheService.set(cooldownKey(phoneNumber, 'portal_link'), now.toString(), 3600) // 1 hour TTL
}

async function getRecentConsentOffer(phoneNumber: string): Promise<ConsentOffer | null> {
  try {
    const data = await cacheService.get(`offer:${phoneNumber}`)
    return data ? JSON.parse(data as string) : null
  } catch {
    return null
  }
}

async function recordConsentOffer(phoneNumber: string, offer: ConsentOffer): Promise<void> {
  await cacheService.set(`offer:${phoneNumber}`, JSON.stringify(offer), 900) // 15 minutes TTL
}

async function getOfferHistory(phoneNumber: string): Promise<ConsentOffer[]> {
  try {
    const data = await cacheService.get(`offer_history:${phoneNumber}`)
    return data ? JSON.parse(data as string) : []
  } catch {
    return []
  }
}

function isOfferValid(offer: ConsentOffer): boolean {
  const now = Date.now()
  const validityWindow = 15 * 60 * 1000 // 15 minutes
  return (now - offer.offeredAt) < validityWindow
}

function checkRecentLinkActivity(recentMessages: Array<{direction: 'inbound' | 'outbound', body: string}>): {
  linkSentRecently: boolean
  linkMentionedRecently: boolean
  messagesAgo: number
  referenceText: string
} {
  // Check last 5 messages for any portal link activity
  const lastFiveMessages = recentMessages.slice(-5)
  
  let linkSentRecently = false
  let linkMentionedRecently = false
  let messagesAgo = 999
  let referenceText = 'the portal link'
  
  for (let i = lastFiveMessages.length - 1; i >= 0; i--) {
    const message = lastFiveMessages[i]
    const messageIndex = lastFiveMessages.length - 1 - i // Messages ago (0 = most recent)
    
    // Check for actual link sends (URLs in outbound messages)
    if (message.direction === 'outbound') {
      // Only flag if an actual URL was sent, not just mentions/offers
      const hasActualUrl = /claim\.resolvemyclaim\.co\.uk|https?:\/\/[^\s]+/i.test(message.body)
      if (hasActualUrl) {
        linkSentRecently = true
        messagesAgo = Math.min(messagesAgo, messageIndex)
        
        // Set reference text based on how recent
        if (messageIndex === 0) referenceText = 'the link I just sent'
        else if (messageIndex === 1) referenceText = 'the link above'
        else referenceText = 'the portal link from earlier'
        break
      }
    }
    
    // Check for portal link mentions that suggest a link was shared (not just offered)
    const hasSharedLinkMention = /(sent|shared|sent you|here.{0,10}link|link.{0,10}above|link.{0,10}earlier)/i.test(message.body) && 
                                /portal|link/i.test(message.body)
    if (hasSharedLinkMention) {
      linkMentionedRecently = true
      messagesAgo = Math.min(messagesAgo, messageIndex)
      
      if (messageIndex <= 1) referenceText = 'the link we discussed'
      else referenceText = 'the portal link we mentioned'
    }
  }
  
  return {
    linkSentRecently,
    linkMentionedRecently,
    messagesAgo,
    referenceText
  }
}
