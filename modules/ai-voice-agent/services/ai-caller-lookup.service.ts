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
    status: string | null;
    current_user_id_document_id: string | null;
  } | null;
  claims: Array<{
    id: number;
    status: string | null;
    lender: string | null;
    vehiclePackages: Array<{
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
  error?: string;  // Add error field for debugging
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
    
    // Use dynamic import like working tests
    const { replicaDb } = await import('@/lib/mysql');
    
    // Use EXACT same phone pattern generation as working Voice DB service
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    const searchPatterns = [
      phoneNumber,                    // Original: '+447738585850'
      cleanPhone,                     // Digits only: '447738585850'
      `+44${cleanPhone.substring(1)}`, // UK international: '+447738585850' 
      `0${cleanPhone.substring(2)}`,   // Remove +44, add 0: '07738585850'
      `44${cleanPhone.substring(1)}`,  // Without + prefix: '447738585850'
    ];
    console.log(`🤖 [AI Voice] Searching with phone patterns (Voice DB style): ${searchPatterns.join(', ')}`);

    // Search for user with enhanced fields for AI (NO is_enabled filter like working service)
    const user = await replicaDb.user.findFirst({
      where: {
        phone_number: {
          in: searchPatterns
        }
        // NO is_enabled filter - matching working Voice DB service
      },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        phone_number: true,
        status: true,
        current_user_id_document_id: true,  // ID document check
        is_enabled: true  // Add for debugging
      }
    });

    if (!user) {
      console.log(`❌ [AI Voice] No user found for phone: ${phoneNumber}`);
      return null;
    }

    console.log(`✅ [AI Voice] User found: ${user.first_name} ${user.last_name} (ID: ${user.id})`);
    console.log(`📋 [AI Voice] User is_enabled: ${user.is_enabled}, status: ${user.status}`);

    // Get claims data for AI context (simplified)
    const claims = await replicaDb.claim.findMany({
        where: {
          user_id: user.id,
          status: {
            not: 'completed'
          }
        },
        select: {
          id: true,
          status: true,
          lender: true,
          // Just vehicle status - useful for users
          vehiclePackages: {
            select: {
              status: true
            }
          }
        },
        orderBy: {
          created_at: 'desc'
        }
      });

    // Calculate AI-specific priority score (based on claims only)
    const priorityScore = calculateAIPriority(claims, []);

    // Convert BigInts for JSON serialization
    const convertedClaims = claims.map(claim => ({
      ...claim,
      id: Number(claim.id), // Convert BigInt to number
      vehiclePackages: claim.vehiclePackages // Status is already a string, no conversion needed
    }));

    const result: AICallerInfo = {
      user: {
        ...user,
        id: Number(user.id) // Convert BigInt to number for JSON serialization
      },
      claims: convertedClaims,
      callHistory: [], // Empty - not fetching call history anymore
      priorityScore,
      lookupSuccess: true
    };

    console.log(`✅ [AI Voice] Simplified lookup successful:`, {
      callerName: `${user.first_name} ${user.last_name}`,
      userId: user.id,
      hasIdOnFile: !!user.current_user_id_document_id,
      claimsCount: claims.length,
      lenders: [...new Set(claims.map(c => c.lender).filter(Boolean))],
      vehicleStatuses: claims.flatMap(c => c.vehiclePackages?.map(vp => vp.status) || [])
    });

    return result;

  } catch (error: any) {
    console.error('❌ [AI Voice] Enhanced caller lookup failed:', error);
    console.error('❌ [AI Voice] Error details:', {
      message: error?.message || 'Unknown error',
      stack: error?.stack || 'No stack trace',
      phoneNumber,
      normalizedNumbers: normalizePhoneNumber(phoneNumber)
    });
    return {
      user: null,
      claims: [],
      callHistory: [],
      priorityScore: 0,
      lookupSuccess: false,
      error: error?.message || 'Unknown error'  // Return error for debugging
    };
  }
}

/**
 * Quick lookup for AI voice when only basic info is needed
 */
export async function performAIQuickLookup(phoneNumber: string): Promise<{found: boolean, name?: string, hasId?: boolean} | null> {
  try {
    // Use dynamic import like working tests
    const { replicaDb } = await import('@/lib/mysql');
    
    // Use EXACT same phone pattern generation as working Voice DB service
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    const searchPatterns = [
      phoneNumber,                    // Original
      cleanPhone,                     // Digits only
      `+44${cleanPhone.substring(1)}`, // UK international
      `0${cleanPhone.substring(2)}`,   // Remove +44, add 0
      `44${cleanPhone.substring(1)}`,  // Without + prefix
    ];
    
    const user = await replicaDb.user.findFirst({
      where: {
        phone_number: {
          in: searchPatterns
        }
        // NO is_enabled filter - matching working Voice DB service
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

  } catch (error: any) {
    console.error('❌ [AI Voice] Quick lookup failed:', error?.message || error);
    return null;
  }
}
