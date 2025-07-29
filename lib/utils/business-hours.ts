// Business Hours Configuration and Utilities

export interface BusinessHoursConfig {
  timezone: string;
  weekdays: {
    monday: { start: string; end: string; enabled: boolean };
    tuesday: { start: string; end: string; enabled: boolean };
    wednesday: { start: string; end: string; enabled: boolean };
    thursday: { start: string; end: string; enabled: boolean };
    friday: { start: string; end: string; enabled: boolean };
    saturday: { start: string; end: string; enabled: boolean };
    sunday: { start: string; end: string; enabled: boolean };
  };
  holidays?: string[]; // ISO dates to exclude (e.g., "2024-12-25")
}

// Default RMC Business Hours Configuration
export const DEFAULT_BUSINESS_HOURS: BusinessHoursConfig = {
  timezone: 'Europe/London', // UK timezone
  weekdays: {
    monday: { start: '10:00', end: '19:00', enabled: true },
    tuesday: { start: '10:00', end: '19:00', enabled: true },
    wednesday: { start: '10:00', end: '19:00', enabled: true },
    thursday: { start: '10:00', end: '19:00', enabled: true },
    friday: { start: '10:00', end: '18:00', enabled: true },
    saturday: { start: '10:00', end: '14:00', enabled: false }, // Weekends disabled by default
    sunday: { start: '10:00', end: '14:00', enabled: false },
  },
  holidays: [
    // UK Bank Holidays 2024/2025 (update annually)
    '2024-12-25', // Christmas Day
    '2024-12-26', // Boxing Day
    '2025-01-01', // New Year's Day
    '2025-04-18', // Good Friday
    '2025-04-21', // Easter Monday
    '2025-05-05', // Early May Bank Holiday
    '2025-05-26', // Spring Bank Holiday
    '2025-08-25', // Summer Bank Holiday
    '2025-12-25', // Christmas Day
    '2025-12-26', // Boxing Day
  ]
};

export class BusinessHoursService {
  constructor(private config: BusinessHoursConfig = DEFAULT_BUSINESS_HOURS) {}

  /**
   * Check if current time is within business hours
   */
  isWithinBusinessHours(date: Date = new Date()): boolean {
    try {
      // Convert to business timezone
      const businessTime = new Date(date.toLocaleString("en-US", { timeZone: this.config.timezone }));
      
      // Check if it's a holiday
      const dateStr = businessTime.toISOString().split('T')[0];
      if (this.config.holidays && this.config.holidays.includes(dateStr)) {
        return false;
      }

      // Get day of week (0 = Sunday, 1 = Monday, ...)
      const dayOfWeek = businessTime.getDay();
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayName = dayNames[dayOfWeek] as keyof BusinessHoursConfig['weekdays'];
      
      const dayConfig = this.config.weekdays[dayName];
      
      // Check if this day is enabled for business
      if (!dayConfig.enabled) {
        return false;
      }

      // Check if current time is within business hours
      const currentTime = businessTime.getHours() * 100 + businessTime.getMinutes();
      const startTime = this.parseTime(dayConfig.start);
      const endTime = this.parseTime(dayConfig.end);

      return currentTime >= startTime && currentTime < endTime;
    } catch (error) {
      console.error('❌ Error checking business hours:', error);
      // Default to business hours on error to avoid blocking calls
      return true;
    }
  }

  /**
   * Get business hours status with detailed info
   */
  getBusinessHoursStatus(date: Date = new Date()): {
    isOpen: boolean;
    reason: string;
    nextOpenTime?: Date;
    timezone: string;
  } {
    const isOpen = this.isWithinBusinessHours(date);
    const businessTime = new Date(date.toLocaleString("en-US", { timeZone: this.config.timezone }));
    
    if (isOpen) {
      return {
        isOpen: true,
        reason: 'Within business hours',
        timezone: this.config.timezone
      };
    }

    // Determine why we're closed
    const dateStr = businessTime.toISOString().split('T')[0];
    if (this.config.holidays && this.config.holidays.includes(dateStr)) {
      return {
        isOpen: false,
        reason: 'Holiday',
        timezone: this.config.timezone
      };
    }

    const dayOfWeek = businessTime.getDay();
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayNames[dayOfWeek] as keyof BusinessHoursConfig['weekdays'];
    const dayConfig = this.config.weekdays[dayName];

    if (!dayConfig.enabled) {
      return {
        isOpen: false,
        reason: 'Weekend/Non-business day',
        timezone: this.config.timezone
      };
    }

    return {
      isOpen: false,
      reason: 'Outside business hours',
      timezone: this.config.timezone
    };
  }

  /**
   * Parse time string (HH:MM) to minutes since midnight
   */
  private parseTime(timeStr: string): number {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 100 + minutes;
  }

  /**
   * Get human-readable business hours
   */
  getBusinessHoursDescription(): string {
    const enabledDays = Object.entries(this.config.weekdays)
      .filter(([_, config]) => config.enabled)
      .map(([day, config]) => `${day.charAt(0).toUpperCase() + day.slice(1)}: ${config.start}-${config.end}`);
    
    return `Business Hours (${this.config.timezone}):\n${enabledDays.join('\n')}`;
  }
}

// Export singleton instance
export const businessHoursService = new BusinessHoursService();

// Convenience function for quick checks
export const isWithinBusinessHours = (date?: Date): boolean => {
  return businessHoursService.isWithinBusinessHours(date);
}; 