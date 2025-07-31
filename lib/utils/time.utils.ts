/**
 * Formats a duration in minutes into a human-readable string
 * @param minutes Number of minutes
 * @returns Formatted string like "2d 3h 45m", "1h 30m", or "45m"
 */
export function formatDuration(minutes: number): string {
  if (minutes <= 0) return '0m';
  
  const days = Math.floor(minutes / (24 * 60));
  const remainingAfterDays = minutes % (24 * 60);
  const hours = Math.floor(remainingAfterDays / 60);
  const remainingMinutes = remainingAfterDays % 60;
  
  const parts: string[] = [];
  
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (remainingMinutes > 0) parts.push(`${remainingMinutes}m`);
  
  // If we have days, only show days and hours for brevity
  if (days > 0) {
    return parts.slice(0, 2).join(' ');
  }
  
  // Otherwise show all relevant parts
  return parts.join(' ');
}

/**
 * Formats time until a scheduled date
 * @param scheduledDate The scheduled date
 * @returns Object with formatted time and status
 */
export function formatTimeUntil(scheduledDate: Date): {
  formatted: string;
  status: 'upcoming' | 'due_soon' | 'overdue';
  isOverdue: boolean;
} {
  const now = new Date();
  const timeDiff = scheduledDate.getTime() - now.getTime();
  const minutesUntil = Math.floor(timeDiff / (1000 * 60));
  
  let status: 'upcoming' | 'due_soon' | 'overdue';
  let formatted: string;
  let isOverdue = false;
  
  if (timeDiff < 0) {
    status = 'overdue';
    isOverdue = true;
    formatted = formatDuration(Math.abs(minutesUntil));
  } else if (minutesUntil <= 10) {
    status = 'due_soon';
    formatted = formatDuration(minutesUntil);
  } else {
    status = 'upcoming';
    formatted = formatDuration(minutesUntil);
  }
  
  return { formatted, status, isOverdue };
} 