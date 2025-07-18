// =============================================================================
// Logger Utility - Core Module
// =============================================================================
// Centralized logging for the dialler system

import winston from 'winston';

// Create logger instance
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Add file logging in production (but not in serverless environments like Vercel)
if (process.env.NODE_ENV === 'production' && !process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
  try {
    logger.add(new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error' 
    }));
    logger.add(new winston.transports.File({ 
      filename: 'logs/combined.log' 
    }));
  } catch (error) {
    // Fallback to console-only logging if file system is not writable
    console.warn('File logging not available in this environment, using console only');
  }
}

// Export default
export default logger; 