export function formatSms(text: string): string {
  // Preserve intentional double line breaks for paragraph spacing
  const withPreservedBreaks = text.replace(/\n\n/g, '__PARAGRAPH_BREAK__')
  // Clean up other whitespace but preserve our markers
  const trimmed = withPreservedBreaks.trim().replace(/\s+/g, ' ')
  // Restore paragraph breaks for mobile readability
  const formatted = trimmed.replace(/__PARAGRAPH_BREAK__/g, '\n\n')
  
  // Modern SMS supports concatenated messages up to ~1600 chars
  // Use a reasonable limit of 800 chars for good UX
  const SMS_LIMIT = 800
  
  if (formatted.length <= SMS_LIMIT) return formatted
  
  // Try to end on a sentence or clause boundary before limit
  const soft = formatted.slice(0, SMS_LIMIT)
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


