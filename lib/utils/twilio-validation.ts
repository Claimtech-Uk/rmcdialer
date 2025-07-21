// =============================================================================
// Twilio Environment Validation Utility
// =============================================================================
// Validates required Twilio configuration for SMS functionality

interface TwilioConfig {
  accountSid: string;
  authToken: string;
  phoneNumber: string;
  apiBaseUrl?: string;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  config?: TwilioConfig;
}

/**
 * Validate Twilio environment variables and configuration
 */
export function validateTwilioConfig(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required environment variables
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const phoneNumber = process.env.TWILIO_PHONE_NUMBER;
  const apiBaseUrl = process.env.API_BASE_URL || process.env.VERCEL_URL;

  // Check required variables
  if (!accountSid || accountSid.startsWith('your-') || accountSid === 'your-twilio-account-sid') {
    errors.push('TWILIO_ACCOUNT_SID is not properly configured');
  } else if (!accountSid.startsWith('AC')) {
    errors.push('TWILIO_ACCOUNT_SID should start with "AC"');
  }

  if (!authToken || authToken.startsWith('your-') || authToken === 'your-twilio-auth-token') {
    errors.push('TWILIO_AUTH_TOKEN is not properly configured');
  } else if (authToken.length < 32) {
    warnings.push('TWILIO_AUTH_TOKEN seems unusually short');
  }

  if (!phoneNumber || phoneNumber.startsWith('your-') || phoneNumber === 'your-twilio-phone-number') {
    errors.push('TWILIO_PHONE_NUMBER is not properly configured');
  } else if (!phoneNumber.startsWith('+')) {
    errors.push('TWILIO_PHONE_NUMBER should include country code (e.g., +1234567890)');
  }

  if (!apiBaseUrl) {
    warnings.push('API_BASE_URL not set - webhook URLs may not work correctly');
  } else if (!apiBaseUrl.startsWith('https://')) {
    warnings.push('API_BASE_URL should use HTTPS for production webhooks');
  }

  // Additional validation checks
  if (process.env.NODE_ENV === 'production') {
    if (!apiBaseUrl) {
      errors.push('API_BASE_URL is required in production for webhook callbacks');
    }
    
    if (phoneNumber && phoneNumber.includes('447700000000')) {
      warnings.push('Using UK test phone number in production - ensure this is intentional');
    }
  }

  const isValid = errors.length === 0;
  const config: TwilioConfig | undefined = isValid ? {
    accountSid: accountSid!,
    authToken: authToken!,
    phoneNumber: phoneNumber!,
    apiBaseUrl
  } : undefined;

  return {
    isValid,
    errors,
    warnings,
    config
  };
}

/**
 * Generate webhook URLs for Twilio configuration
 */
export function getTwilioWebhookUrls(baseUrl?: string): {
  smsIncoming: string;
  smsStatus: string;
  voiceIncoming: string;
  voiceStatus: string;
  recordingCallback: string;
} {
  const base = baseUrl || process.env.API_BASE_URL || process.env.VERCEL_URL || 'http://localhost:3001';
  
  return {
    smsIncoming: `${base}/api/webhooks/twilio/sms`,
    smsStatus: `${base}/api/webhooks/twilio/sms/status`,
    voiceIncoming: `${base}/api/webhooks/twilio/voice`,
    voiceStatus: `${base}/api/webhooks/twilio/voice/status`,
    recordingCallback: `${base}/api/webhooks/twilio/recording`
  };
}

/**
 * Format validation results for logging
 */
export function formatValidationResults(result: ValidationResult): string {
  let output = `Twilio Configuration Validation: ${result.isValid ? '✅ VALID' : '❌ INVALID'}\n`;
  
  if (result.errors.length > 0) {
    output += '\n🚨 ERRORS:\n';
    result.errors.forEach(error => output += `  - ${error}\n`);
  }
  
  if (result.warnings.length > 0) {
    output += '\n⚠️  WARNINGS:\n';
    result.warnings.forEach(warning => output += `  - ${warning}\n`);
  }
  
  if (result.config) {
    const webhooks = getTwilioWebhookUrls(result.config.apiBaseUrl);
    output += '\n📞 Webhook URLs:\n';
    output += `  SMS Incoming: ${webhooks.smsIncoming}\n`;
    output += `  SMS Status: ${webhooks.smsStatus}\n`;
    output += `  Voice: ${webhooks.voiceIncoming}\n`;
  }
  
  return output;
} 