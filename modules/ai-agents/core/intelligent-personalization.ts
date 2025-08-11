import { shouldUseName, recordNameUsage, getRecentLinkContext, recordLinkSent } from './memory.store'

export type PersonalizationContext = {
  phone: string
  firstName?: string
  userFound: boolean
  replyText: string
}

export type SmartPersonalizationResult = {
  personalizedText: string
  usedName: boolean
  linkContext: {
    canReference: boolean
    referenceText: string
    shouldSendNew: boolean
  }
}

/**
 * Intelligent personalization that considers conversation context
 * to avoid overusing names and provide smart link references
 */
export async function smartPersonalize(context: PersonalizationContext): Promise<SmartPersonalizationResult> {
  const { phone, firstName, userFound, replyText } = context
  
  // Get link context for smart referencing
  const linkContext = await getRecentLinkContext(phone)
  
  // Check if we should use the name
  const useNameDecision = userFound && firstName && !/^unknown$/i.test(firstName) && await shouldUseName(phone)
  
  let personalizedText = replyText
  let usedName = false
  
  // Smart name usage logic
  if (useNameDecision) {
    const startsWithGreeting = /^\s*(hi|hey|hello)\b/i.test(replyText)
    if (!startsWithGreeting) {
      personalizedText = `Hi ${firstName}, ${replyText}`
      usedName = true
      
      // Record name usage for future intelligence
      await recordNameUsage(phone)
      
      console.log('AI SMS | 👋 Used name intelligently', {
        phone: phone.substring(0, 8) + '***',
        firstName: firstName.substring(0, 3) + '***'
      })
    }
  } else if (firstName && userFound) {
    console.log('AI SMS | 🤐 Skipped name usage', {
      phone: phone.substring(0, 8) + '***',
      reason: 'conversation_intelligence'
    })
  }
  
  // Smart link replacement logic
  if (linkContext.canReference && !linkContext.shouldSendNew) {
    // Replace common portal link phrases with smart references
    const linkReplacements = [
      { pattern: /\bportal link\b/gi, replacement: linkContext.referenceText },
      { pattern: /\byour link\b/gi, replacement: linkContext.referenceText },
      { pattern: /\bthe link\b/gi, replacement: linkContext.referenceText },
      { pattern: /send (?:you )?(?:your )?(?:the )?portal link/gi, replacement: `use ${linkContext.referenceText}` }
    ]
    
    let hasLinkReplacement = false
    for (const { pattern, replacement } of linkReplacements) {
      if (pattern.test(personalizedText)) {
        personalizedText = personalizedText.replace(pattern, replacement)
        hasLinkReplacement = true
      }
    }
    
    if (hasLinkReplacement) {
      await recordLinkSent(phone, 'portal_link_mentioned')
      console.log('AI SMS | 🔗 Smart link reference used', {
        phone: phone.substring(0, 8) + '***',
        reference: linkContext.referenceText
      })
    }
  }
  
  return {
    personalizedText,
    usedName,
    linkContext
  }
}

/**
 * Enhanced prompt information for AI to understand conversation context
 */
export async function getPersonalizationPromptContext(phone: string): Promise<string> {
  const linkContext = await getRecentLinkContext(phone)
  const shouldUse = await shouldUseName(phone)
  
  const contextParts: string[] = []
  
  if (!shouldUse) {
    contextParts.push('Note: Avoid using the user\'s name - you\'ve used it recently')
  }
  
  if (linkContext.canReference && !linkContext.shouldSendNew) {
    contextParts.push(`Note: Reference "${linkContext.referenceText}" instead of sending new portal link`)
  } else if (!linkContext.shouldSendNew) {
    contextParts.push('Note: You recently sent a portal link - avoid sending another immediately')
  }
  
  return contextParts.length > 0 ? `\nPersonalization context: ${contextParts.join('; ')}` : ''
}

/**
 * Record when AI mentions or sends links in responses
 */
export async function recordAILinkAction(phone: string, responseText: string): Promise<void> {
  const portalLinkMentioned = /portal link|your link|the link/i.test(responseText)
  const reviewLinkMentioned = /trustpilot|review/i.test(responseText)
  
  if (portalLinkMentioned) {
    await recordLinkSent(phone, 'portal_link_mentioned')
  }
  
  if (reviewLinkMentioned) {
    await recordLinkSent(phone, 'review_link_sent')
  }
}

// Backwards compatibility wrapper
export function createLegacyPersonalizeFunction() {
  return (text: string, name?: string, found?: boolean): string => {
    if (!found || !name || /^unknown$/i.test(name)) return text
    const startsWithGreeting = /^\s*(hi|hey|hello)\b/i.test(text)
    if (startsWithGreeting) return text
    return `Hi ${name}, ${text}`
  }
}
