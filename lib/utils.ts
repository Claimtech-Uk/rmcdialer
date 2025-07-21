import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats a date as a relative time string (e.g., "45 minutes ago", "3 days ago")
 */
export function formatRelativeTime(date: string | Date | null | undefined): string {
  if (!date) return 'Unknown';
  
  const now = new Date();
  const targetDate = new Date(date);
  
  // Check if the date is valid
  if (isNaN(targetDate.getTime())) return 'Unknown';
  
  const diffInSeconds = Math.floor((now.getTime() - targetDate.getTime()) / 1000);
  
  // Handle future dates (shouldn't happen but just in case)
  if (diffInSeconds < 0) return 'Just now';
  
  // Less than a minute
  if (diffInSeconds < 60) return 'Just now';
  
  // Minutes
  const minutes = Math.floor(diffInSeconds / 60);
  if (minutes < 60) {
    return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`;
  }
  
  // Hours
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  }
  
  // Days
  const days = Math.floor(hours / 24);
  if (days < 7) {
    return days === 1 ? '1 day ago' : `${days} days ago`;
  }
  
  // Weeks
  const weeks = Math.floor(days / 7);
  if (weeks < 4) {
    return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
  }
  
  // Months
  const months = Math.floor(days / 30);
  if (months < 12) {
    return months === 1 ? '1 month ago' : `${months} months ago`;
  }
  
  // Years
  const years = Math.floor(days / 365);
  return years === 1 ? '1 year ago' : `${years} years ago`;
} 