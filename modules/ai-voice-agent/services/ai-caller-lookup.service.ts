import { replicaDb } from '@/lib/mysql';
import { prisma } from '@/lib/db';
import { normalizePhoneNumber } from '@/modules/twilio-voice/utils';

/**
 * AI Voice Agent Enhanced Caller Lookup
 * Separate from the main voice system to avoid impacting existing functionality
 * Includes additional data needed for AI conversations:
 * - ID document status
 * - Vehicle packages details
 * - Claim lenders
 */

export interface AICallerInfo {
  user: {
    id: number;
    first_name: string | null;
    last_name: string | null;
    phone_number: string | null;
    email_address: string | null;
    status: string | null;
    current_user_id_document_id: string | null;
    created_at: Date | null;
    last_login: Date | null;
  } | null;
  claims: Array<{
    id: number;
    type: string | null;
    status: string | null;
    lender: string | null;
    created_at: Date | null;
    updated_at: Date | null;
    vehiclePackages: Array<{
      id: string;
      vehicle_registration: string | null;
      vehicle_make: string | null;
      vehicle_model: string | null;
      dealership_name: string | null;
      monthly_payment: any;
      status: string | null;
    }>;
  }>;
  callHistory: Array<{
    id: string;
    status: string;
    direction: string;
    startedAt: Date;
  }>;
  priorityScore: number;
  lookupSuccess: boolean;
}

/**
 * Calculate priority score for AI voice routing
 */
function calculateAIPriority(claims: any[], callHistory: any[]): number {
  let score = 0;
  
  // More claims = higher priority
  score += claims.length * 10;
  
  // Active claims get priority
  const activeClaims = claims.filter(c => c.status === 'reviewing' || c.status === 'submitted');
  score += activeClaims.length * 15;
  
  // Multiple vehicles = higher complexity
  const totalVehicles = claims.reduce((sum, claim) => sum + (claim.vehiclePackages?.length || 0), 0);
  score += totalVehicles * 5;
  
  // Recent calls indicate engagement
  const recentCalls = callHistory.filter(c => {
    const daysSinceCall = (Date.now() - new Date(c.startedAt).getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceCall <= 7;
  });
  score += recentCalls.length * 3;
  
  return Math.min(score, 100); // Cap at 100
}

/**
 * Enhanced lookup specifically for AI Voice Agent
 * Includes all data needed for intelligent conversations
 */
export async function performAICallerLookup(phoneNumber: string): Promise<AICallerInfo | null> {
  try {
    console.log(`🤖 [AI Voice] Starting enhanced AI caller lookup for: ${phoneNumber}`);
    
    // Normalize phone number to multiple formats for matching
    const normalizedNumbers = normalizePhoneNumber(phoneNumber);
    console.log(`🤖 [AI Voice] Searching with phone variants: ${normalizedNumbers.join(', ')}`);

    // Search for user with enhanced fields for AI
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
        current_user_id_document_id: true,  // ID document check
        created_at: true,
        last_login: true
      }
    });

    if (!user) {
      console.log(`❌ [AI Voice] No user found for phone: ${phoneNumber}`);
      return null;
    }

    console.log(`✅ [AI Voice] User found: ${user.first_name} ${user.last_name} (ID: ${user.id})`);

    // Get comprehensive data for AI context
    const [claims, callHistory] = await Promise.all([
      // Get all claims with vehicle packages (AI needs full context)
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
          // Include vehicle packages for detailed conversations
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
        take: 10, // AI needs more history for context
        orderBy: {
          startedAt: 'desc'
        }
      })
    ]);

    // Calculate AI-specific priority score
    const priorityScore = calculateAIPriority(claims, callHistory);

    // Convert BigInts and Decimals for JSON serialization
    const convertedClaims = claims.map(claim => ({
      ...claim,
      id: Number(claim.id), // Convert BigInt to number
      vehiclePackages: claim.vehiclePackages.map(vp => ({
        ...vp,
        monthly_payment: vp.monthly_payment ? Number(vp.monthly_payment) : null // Convert Decimal to number
      }))
    }));

    const result: AICallerInfo = {
      user: {
        ...user,
        id: Number(user.id) // Convert BigInt to number for JSON serialization
      },
      claims: convertedClaims,
      callHistory,
      priorityScore,
      lookupSuccess: true
    };

    console.log(`✅ [AI Voice] Enhanced lookup successful:`, {
      callerName: `${user.first_name} ${user.last_name}`,
      userId: user.id,
      phone: user.phone_number,
      hasIdOnFile: !!user.current_user_id_document_id,
      claimsCount: claims.length,
      totalVehiclePackages: claims.reduce((sum, claim) => sum + (claim.vehiclePackages?.length || 0), 0),
      lenders: [...new Set(claims.map(c => c.lender).filter(Boolean))],
      priorityScore
    });

    return result;

  } catch (error) {
    console.error('❌ [AI Voice] Enhanced caller lookup failed:', error);
    return null;
  }
}

/**
 * Quick lookup for AI voice when only basic info is needed
 */
export async function performAIQuickLookup(phoneNumber: string): Promise<{found: boolean, name?: string, hasId?: boolean} | null> {
  try {
    const normalizedNumbers = normalizePhoneNumber(phoneNumber);
    
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
        first_name: true,
        last_name: true,
        current_user_id_document_id: true
      }
    });

    if (!user) {
      return { found: false };
    }

    return {
      found: true,
      name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
      hasId: !!user.current_user_id_document_id
    };

  } catch (error) {
    console.error('❌ [AI Voice] Quick lookup failed:', error);
    return null;
  }
}
