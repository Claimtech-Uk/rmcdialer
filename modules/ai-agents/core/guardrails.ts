export function containsStopIntent(text: string): boolean {
  const t = text.toLowerCase()
  return t.includes('stop') || t.includes('unsubscribe') || t.includes('opt out')
}

export function redactPII(text: string): string {
  return text
    .replace(/\b\d{10,}\b/g, '[number]')
    .replace(/\b\d{2}[\/\-]\d{2}[\/\-]\d{2,4}\b/g, '[date]')
}

export function containsComplaintIntent(text: string): boolean {
  const t = text.toLowerCase()
  return /\b(complaint|complain|ombudsman|formal complaint)\b/.test(t)
}

export function containsAbuseIntent(text: string): boolean {
  // Only flag explicit abusive language. Avoid broad patterns that match common
  // words like "from", "fees", etc. Do NOT treat "scam"/"fraud" as abuse – those are
  // common trust questions and should be handled by normal replies.
  return /(\bidiot\b|\bstupid\b|\buseless\b|\bfuck(?:er|ing)?\b|\bf\*+k\b)/i.test(text)
}


