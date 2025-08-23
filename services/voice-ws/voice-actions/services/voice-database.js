/**
 * Voice Database Service
 * Database operations specifically for voice interactions
 * Uses Prisma client with replica database (MySQL) - READ-ONLY
 */

import { PrismaClient } from '../../../../prisma/generated/mysql-client/index.js'

class VoiceDatabaseService {
  constructor() {
    this.prisma = null
    this.initializePrisma()
  }

  async initializePrisma() {
    if (!this.prisma) {
      try {
        // Initialize Prisma client with replica database
        this.prisma = new PrismaClient({
          log: ['error'],
          datasources: {
            db: {
              url: process.env.REPLICA_DATABASE_URL || 'mysql://placeholder:placeholder@localhost:3306/placeholder'
            }
          },
          transactionOptions: {
            maxWait: 10000, // 10 seconds for voice queries
            timeout: 30000, // 30 seconds total timeout
          }
        })
        
        // Test connection
        await this.prisma.$connect()
        console.log('✅ [VOICE-DB] Connected to replica database')
        
      } catch (error) {
        console.error('❌ [VOICE-DB] Failed to connect to replica database:', error.message)
        this.prisma = null
      }
    }
    return this.prisma
  }

  async getPrismaClient() {
    if (!this.prisma) {
      await this.initializePrisma()
    }
    return this.prisma
  }

  /**
   * Find user by phone number
   */
  async findUserByPhone(phoneNumber) {
    try {
      const prisma = await this.getPrismaClient()
      
      if (!prisma) {
        throw new Error('Database connection not available')
      }
      
      // Clean phone number for search
      const cleanPhone = phoneNumber.replace(/\D/g, '')
      
      // Search patterns for UK phone numbers
      const searchPatterns = [
        phoneNumber,
        cleanPhone,
        `+44${cleanPhone.substring(1)}`, // UK international format
        `0${cleanPhone.substring(2)}`,   // Remove +44, add 0 prefix
        `44${cleanPhone.substring(1)}`,  // Without + prefix
      ]

      // Search for user with any of the phone number patterns
      const user = await prisma.user.findFirst({
        where: {
          phone_number: {
            in: searchPatterns
          }
        },
        select: {
          id: true,
          first_name: true,
          last_name: true,
          email_address: true,
          phone_number: true,
          created_at: true,
          updated_at: true,
          status: true
        }
      })
      
      if (user) {
        return {
          found: true,
          id: user.id.toString(), // Convert BigInt to string for compatibility
          firstName: user.first_name,
          lastName: user.last_name,
          fullName: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
          email: user.email_address,
          phone: user.phone_number,
          status: user.status,
          createdAt: user.created_at,
          updatedAt: user.updated_at
        }
      }

      return { found: false }
    } catch (error) {
      console.error('❌ [VOICE-DB] Error finding user by phone:', error)
      return { found: false, error: error.message }
    }
  }

  /**
   * Get user claims count and basic info
   */
  async getUserClaims(userId) {
    try {
      const prisma = await this.getPrismaClient()
      
      if (!prisma) {
        throw new Error('Database connection not available')
      }

      // Convert userId to BigInt for database query
      const userIdBigInt = BigInt(userId)
      
      const claims = await prisma.claim.findMany({
        where: {
          user_id: userIdBigInt
        },
        select: {
          id: true,
          status: true,
          updated_at: true
        },
        orderBy: {
          updated_at: 'desc'
        }
      })
      
      return {
        claimCount: claims.length,
        lastActivity: claims[0]?.updated_at || null,
        claims: claims.map(claim => ({
          id: claim.id.toString(),
          status: claim.status,
          updatedAt: claim.updated_at
        }))
      }
    } catch (error) {
      console.error('❌ [VOICE-DB] Error getting user claims:', error)
      return { claimCount: 0, lastActivity: null, error: error.message }
    }
  }

  /**
   * Get claim details by reference
   */
  async getClaimByReference(claimReference) {
    try {
      const prisma = await this.getPrismaClient()
      
      if (!prisma) {
        throw new Error('Database connection not available')
      }

      // Try to find claim by ID (if claimReference is numeric) or by any reference field
      let claim = null
      
      // First try by ID if it's a valid BigInt
      if (/^\d+$/.test(claimReference)) {
        try {
          const claimIdBigInt = BigInt(claimReference)
          claim = await prisma.claim.findUnique({
            where: {
              id: claimIdBigInt
            },
            include: {
              user: {
                select: {
                  first_name: true,
                  last_name: true,
                  phone_number: true
                }
              }
            }
          })
        } catch (err) {
          // If BigInt conversion fails, continue to other search methods
          console.warn('❌ [VOICE-DB] BigInt conversion failed for claim reference:', claimReference)
        }
      }

      // If not found by ID, we don't have other reference fields in the schema
      // In a real scenario, you might have a reference field in the claims table
      
      if (claim) {
        return {
          found: true,
          id: claim.id.toString(),
          reference: claim.id.toString(), // Using ID as reference since no separate reference field
          status: claim.status,
          lender: claim.lender,
          type: claim.type,
          createdAt: claim.created_at,
          updatedAt: claim.updated_at,
          customer: {
            name: `${claim.user.first_name || ''} ${claim.user.last_name || ''}`.trim(),
            phone: claim.user.phone_number
          }
        }
      }

      return { found: false }
    } catch (error) {
      console.error('❌ [VOICE-DB] Error getting claim by reference:', error)
      return { found: false, error: error.message }
    }
  }

  /**
   * Create missed call entry for callback scheduling
   * NOTE: MissedCall table is in main PostgreSQL database, not replica
   * This is a read-only replica, so we can't create missed calls directly
   * In production, you'd need to use an API endpoint to the main app
   */
  async createMissedCall(data) {
    try {
      // Since this is a read-only replica database, we can't create missed calls directly
      // In a real implementation, you would:
      // 1. Call an API endpoint on your main app to create the missed call
      // 2. Or use a message queue to trigger missed call creation
      // 3. Or have a separate service handle missed call creation
      
      console.log('📅 [VOICE-DB] Callback request logged (read-only replica):', {
        phoneNumber: this.maskPhoneNumber(data.phoneNumber),
        userId: data.userId,
        reason: data.reason,
        requestedTime: data.requestedTime
      })

      // Generate a mock callback ID for the voice response
      const mockCallbackId = `voice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      // TODO: Implement actual missed call creation via:
      // - API call to main app: POST /api/missed-calls
      // - Message queue: publish to missed-call-queue
      // - Direct PostgreSQL connection (if needed)

      return {
        success: true,
        missedCallId: mockCallbackId,
        message: 'Callback request logged - will be processed by main system',
        requiresMainDbIntegration: true
      }
    } catch (error) {
      console.error('❌ [VOICE-DB] Error logging callback request:', error)
      return {
        success: false,
        error: error.message,
        message: 'Failed to log callback request'
      }
    }
  }

  /**
   * Get outstanding requirements for a claim
   */
  async getClaimRequirements(claimReference) {
    try {
      const prisma = await this.getPrismaClient()
      
      if (!prisma) {
        throw new Error('Database connection not available')
      }

      // First, find the claim to get its ID
      let claimId = null
      
      if (/^\d+$/.test(claimReference)) {
        try {
          claimId = BigInt(claimReference)
        } catch (err) {
          console.warn('❌ [VOICE-DB] Invalid claim reference:', claimReference)
          return {
            found: false,
            requirements: [],
            completionStatus: 'unknown'
          }
        }
      }

      // Get claim requirements that are not completed
      const requirements = await prisma.claimRequirement.findMany({
        where: {
          claim_id: claimId,
          status: {
            not: 'completed'
          }
        },
        select: {
          type: true,
          status: true,
          claim_requirement_reason: true,
          created_at: true,
          updated_at: true
        },
        orderBy: {
          created_at: 'asc'
        }
      })
      
      const formattedRequirements = requirements.map(req => ({
        type: req.type,
        description: req.claim_requirement_reason || req.type || 'Additional information needed',
        status: req.status,
        createdAt: req.created_at,
        updatedAt: req.updated_at
      }))

      return {
        found: requirements.length > 0,
        requirements: formattedRequirements,
        completionStatus: formattedRequirements.length === 0 ? 'complete' : 'pending',
        claimId: claimId?.toString()
      }
    } catch (error) {
      console.error('❌ [VOICE-DB] Error getting claim requirements:', error)
      // Return empty requirements rather than failing
      return {
        found: false,
        requirements: [],
        completionStatus: 'unknown',
        error: error.message
      }
    }
  }

  /**
   * Log voice interaction for audit trail
   * NOTE: This is a read-only replica, so we log to console
   * In production, you'd send logs to a logging service or main database
   */
  async logVoiceAction(data) {
    try {
      // Since this is a read-only replica, we can't write to database
      // Log to console for development/debugging
      console.log('📊 [VOICE-AUDIT]', {
        timestamp: new Date().toISOString(),
        callSid: data.callSid,
        phoneNumber: this.maskPhoneNumber(data.phoneNumber || 'unknown'),
        userId: data.userId,
        actionName: data.actionName,
        executionTimeMs: data.executionTimeMs,
        success: data.result?.success,
        error: data.result?.error
      })

      // TODO: In production, implement proper audit logging via:
      // - Send to main app API: POST /api/voice-logs
      // - Send to logging service (CloudWatch, DataDog, etc.)
      // - Write to separate audit database
      // - Use message queue for async logging
      
    } catch (error) {
      // Don't throw for logging errors - just log them
      console.error('❌ [VOICE-DB] Error logging voice action:', error)
    }
  }

  /**
   * Utility method to mask phone numbers in logs
   */
  maskPhoneNumber(phoneNumber) {
    if (!phoneNumber || phoneNumber.length < 8) return phoneNumber
    return phoneNumber.replace(/(\d{3})\d{4}(\d{3})/, '$1****$2')
  }

  async close() {
    if (this.prisma) {
      await this.prisma.$disconnect()
      this.prisma = null
    }
  }
}

export const voiceDatabaseService = new VoiceDatabaseService()
