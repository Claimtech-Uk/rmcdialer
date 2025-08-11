export function formatSms(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, ' ')
  
  // Modern SMS supports concatenated messages up to ~1600 chars
  // Use a reasonable limit of 800 chars for good UX
  const SMS_LIMIT = 800
  
  if (trimmed.length <= SMS_LIMIT) return trimmed
  
  // Try to end on a sentence or clause boundary before limit
  const soft = trimmed.slice(0, SMS_LIMIT)
  const lastPunct = Math.max(
    soft.lastIndexOf('. '), 
    soft.lastIndexOf('! '), 
    soft.lastIndexOf('? '), 
    soft.lastIndexOf('; '), 
    soft.lastIndexOf(', ')
  )
  
  // Use punctuation boundary if found after halfway point, otherwise cut cleanly
  const cutoff = lastPunct > SMS_LIMIT / 2 ? lastPunct + 1 : SMS_LIMIT - 3
  return soft.slice(0, cutoff).trimEnd() + '...'
}


