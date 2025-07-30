/**
 * Smart phone number normalization for better matching
 * Generates multiple variants of a phone number to match different storage formats
 */
export function normalizePhoneNumber(phoneNumber: string): string[] {
  // Remove all non-numeric characters
  const digits = phoneNumber.replace(/\D/g, '');
  
  const variants: string[] = [];
  
  // Add original number
  variants.push(phoneNumber);
  
  if (digits.length >= 10) {
    // UK mobile numbers (assuming UK market)
    if (digits.startsWith('447')) {
      // +447... format (international)
      variants.push(`+${digits}`);
      // 07... format (national)
      variants.push(`0${digits.substring(2)}`);
      // 447... format (international without +)
      variants.push(digits);
    } else if (digits.startsWith('44')) {
      // 44... format
      variants.push(`+${digits}`);
      variants.push(`0${digits.substring(2)}`);
      variants.push(digits);
    } else if (digits.startsWith('07')) {
      // 07... format (national)
      variants.push(digits);
      variants.push(`+44${digits.substring(1)}`);
      variants.push(`44${digits.substring(1)}`);
    } else if (digits.length === 10 && digits.startsWith('7')) {
      // 7... format (missing leading 0)
      variants.push(`0${digits}`);
      variants.push(`+44${digits}`);
      variants.push(`44${digits}`);
    }
  }
  
  // Remove duplicates and return
  return [...new Set(variants)];
} 