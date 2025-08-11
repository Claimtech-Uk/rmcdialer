export function formatSms(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, ' ')
  if (trimmed.length <= 160) return trimmed
  // Try to end on a sentence or clause boundary before 160
  const soft = trimmed.slice(0, 160)
  const lastPunct = Math.max(soft.lastIndexOf('. '), soft.lastIndexOf('! '), soft.lastIndexOf('? '), soft.lastIndexOf('; '), soft.lastIndexOf(', '))
  const cutoff = lastPunct > 80 ? lastPunct + 1 : 157
  return soft.slice(0, cutoff).trimEnd() + '...'
}


