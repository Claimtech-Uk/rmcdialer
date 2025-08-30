import { prisma } from '@/lib/db';
import { replicaDb } from '@/lib/mysql';
import { CallerInfo, NameInfo } from '../types/twilio-voice.types';
import { normalizePhoneNumber, calculateCallerPriority } from '../utils';

/**
 * Enhanced caller lookup with smart phone number matching
 * Retrieves full user context including claims, requirements, and call history
 */
export async function performEnhancedCallerLookup(phoneNumber: string): Promise<CallerInfo | null> {
  try {
    console.log(`🔍 [Voice Webhook] Starting enhanced caller lookup for: ${phoneNumber}`);
    
    // Normalize phone number to multiple formats for matching
    const normalizedNumbers = normalizePhoneNumber(phoneNumber);
    console.log(`🔍 [Voice Webhook] Searching for caller with phone variants: ${normalizedNumbers.join(', ')}`);

    // Search for user with any of the normalized phone number variants
    const user = await replicaDb.user.findFirst({
      where: {
        AND: [
          {
            phone_number: {
              in: normalizedNumbers
            }
          },
          {
            is_enabled: true
          }
        ]
      },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        phone_number: true,
        email_address: true,
        status: true,
        current_user_id_document_id: true,  // Check if ID is on file
        created_at: true,
        last_login: true
      }
    });

    if (!user) {
      console.log(`❌ [Voice Webhook] No user found for phone: ${phoneNumber} (tried: ${normalizedNumbers.join(', ')})`);
      return null;
    }

    console.log(`✅ [Voice Webhook] User found: ${user.first_name} ${user.last_name} (ID: ${user.id})`);

    // Get user's claims and call history
    const [claims, callHistory] = await Promise.all([
      // Get active claims with vehicle packages
      replicaDb.claim.findMany({
        where: {
          user_id: user.id,
          status: {
            not: 'completed'
          }
        },
        select: {
          id: true,
          type: true,
          status: true,
          lender: true,
          created_at: true,
          updated_at: true,
          // Include vehicle packages for each claim
          vehiclePackages: {
            select: {
              id: true,
              vehicle_registration: true,
              vehicle_make: true,
              vehicle_model: true,
              dealership_name: true,
              monthly_payment: true,
              status: true
            }
          }
        },
        take: 5,
        orderBy: {
          created_at: 'desc'
        }
      }),

      // Get recent call history from PostgreSQL
      prisma.callSession.findMany({
        where: {
          userId: user.id
        },
        select: {
          id: true,
          status: true,
          direction: true,
          startedAt: true
        },
        take: 5,
        orderBy: {
          startedAt: 'desc'
        }
      })
    ]);

    // Simplified requirements count
    const requirements: any[] = [];

    // Calculate priority score based on claims and requirements
    const priorityScore = calculateCallerPriority(claims, requirements, callHistory);

    const result: CallerInfo = {
      user: {
        ...user,
        id: Number(user.id) // Convert BigInt to number for JSON serialization
      },
      claims,
      requirements,
      callHistory,
      priorityScore,
      lookupSuccess: true
    };

    console.log(`✅ [Voice Webhook] Caller lookup successful:`, {
      callerName: result.user ? `${result.user.first_name} ${result.user.last_name}` : 'Unknown',
      userId: user.id,
      phone: user.phone_number,
      hasIdOnFile: !!user.current_user_id_document_id,
      claimsCount: claims.length,
      totalVehiclePackages: claims.reduce((sum, claim) => sum + (claim.vehiclePackages?.length || 0), 0),
      priorityScore
    });

    return result;

  } catch (error) {
    console.error('❌ [Voice Webhook] Enhanced caller lookup failed:', error);
    return null;
  }
}

/**
 * Lightweight caller name lookup for out-of-hours greetings
 * Only retrieves basic name information for faster response
 */
export async function performLightweightNameLookup(phoneNumber: string): Promise<NameInfo | null> {
  try {
    console.log(`🔍 [Voice Webhook] Starting lightweight name lookup for: ${phoneNumber}`);
    
    // Normalize phone number to multiple formats for matching
    const normalizedNumbers = normalizePhoneNumber(phoneNumber);
    
    // Search for user - ONLY get name fields
    const user = await replicaDb.user.findFirst({
      where: {
        AND: [
          {
            phone_number: {
              in: normalizedNumbers
            }
          },
          {
            is_enabled: true
          }
        ]
      },
      select: {
        id: true,
        first_name: true,
        last_name: true
      }
    });

    if (!user) {
      console.log(`❌ [Voice Webhook] No user found for phone: ${phoneNumber} (lightweight lookup)`);
      return null;
    }

    console.log(`✅ [Voice Webhook] Name found: ${user.first_name} ${user.last_name} (ID: ${user.id}) - lightweight lookup`);

    return {
      firstName: user.first_name || undefined,
      lastName: user.last_name || undefined,
      userId: Number(user.id)
    };

  } catch (error) {
    console.error('❌ [Voice Webhook] Lightweight name lookup failed:', error);
    return null;
  }
}

/**
 * Background caller lookup for business hours calls (non-blocking)
 * Updates the call session with full caller context asynchronously
 */
export async function triggerBackgroundCallerLookup(phoneNumber: string, callSessionId: string): Promise<void> {
  // Run in background - don't block the main call flow
  Promise.resolve().then(async () => {
    try {
      console.log(`🔍 Starting background caller lookup for session ${callSessionId}`);
      
      const fullCallerInfo = await performEnhancedCallerLookup(phoneNumber);
      
      if (fullCallerInfo) {
        // Update call session with full context
        await prisma.callSession.update({
          where: { id: callSessionId },
          data: {
            userClaimsContext: JSON.stringify({
              knownCaller: true,
              callerName: fullCallerInfo.user ? `${fullCallerInfo.user.first_name} ${fullCallerInfo.user.last_name}` : 'Unknown Caller',
              phoneNumber,
              claims: fullCallerInfo.claims.map((claim: any) => ({
                ...claim,
                id: Number(claim.id),
                user_id: Number(claim.user_id),
                created_at: claim.created_at?.toISOString(),
                updated_at: claim.updated_at?.toISOString()
              })),
              requirements: fullCallerInfo.requirements.map((req: any) => ({
                ...req,
                id: Number(req.id),
                claim_id: req.claim_id ? Number(req.claim_id) : null,
                created_at: req.created_at?.toISOString()
              })),
              callHistory: fullCallerInfo.callHistory.map((call: any) => ({
                ...call,
                id: call.id,
                userId: Number(call.userId),
                startedAt: call.startedAt?.toISOString()
              })),
              priorityScore: fullCallerInfo.priorityScore,
              lookupStatus: 'complete'
            })
          }
        });
        
        console.log(`✅ Background caller lookup complete for session ${callSessionId}`);
      } else {
        console.log(`⚠️ Background caller lookup found no additional data for session ${callSessionId}`);
      }
    } catch (error) {
      console.error(`❌ Background caller lookup failed for session ${callSessionId}:`, error);
    }
  }).catch(error => {
    console.error(`❌ Background caller lookup promise failed for session ${callSessionId}:`, error);
  });
} 