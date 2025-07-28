#!/usr/bin/env tsx

/**
 * Cleanup Script: Remove users from outstanding_requests queue who only have excluded id_document requirements
 * 
 * 🎯 PURPOSE:
 * After adding id_document (with 'base requirement for claim.' reason) to excluded types,
 * we need to clean up existing users who are in outstanding_requests queue but no longer qualify.
 * 
 * 🔍 LOGIC:
 * 1. Get all users with currentQueueType = 'outstanding_requests'
 * 2. For each user, check their actual pending requirements
 * 3. Exclude standard excluded types + id_document with specific reason
 * 4. If user has NO valid pending requirements, remove from queue
 * 
 * 🚫 EXCLUDED REQUIREMENT TYPES:
 * - signature
 * - vehicle_registration 
 * - cfa
 * - solicitor_letter_of_authority
 * - letter_of_authority
 * - id_document (ONLY when claim_requirement_reason = 'base requirement for claim.')
 */

import { replicaDb } from '@/lib/mysql'
import { prisma } from '@/lib/db'

interface CleanupResult {
  timestamp: Date
  duration: number
  success: boolean
  totalOutstandingUsers: number
  usersChecked: number
  usersToRemove: number
  usersRemoved: number
  errors: string[]
  summary: string
  removedUsers: Array<{
    userId: bigint
    hadOnlyExcludedRequirements: boolean
    requirementTypes: string[]
  }>
}

const EXCLUDED_REQUIREMENT_TYPES = [
  'signature',
  'vehicle_registration', 
  'cfa',
  'solicitor_letter_of_authority',
  'letter_of_authority'
]

async function main() {
  const startTime = Date.now()
  console.log('🧹 Starting cleanup of outstanding_requests users with only excluded id_document requirements...')
  
  const result: CleanupResult = {
    timestamp: new Date(),
    duration: 0,
    success: false,
    totalOutstandingUsers: 0,
    usersChecked: 0,
    usersToRemove: 0,
    usersRemoved: 0,
    errors: [],
    summary: '',
    removedUsers: []
  }

  try {
    // Step 1: Get all users currently in outstanding_requests queue
    const outstandingUsers = await prisma.userCallScore.findMany({
      where: {
        // @ts-ignore - currentQueueType exists in database
        currentQueueType: 'outstanding_requests',
        isActive: true
      },
      select: {
        userId: true
      }
    })

    result.totalOutstandingUsers = outstandingUsers.length
    console.log(`📊 Found ${result.totalOutstandingUsers} users in outstanding_requests queue`)

    if (outstandingUsers.length === 0) {
      result.success = true
      result.summary = '✅ No users in outstanding_requests queue to check'
      console.log(result.summary)
      return result
    }

    // Step 2: Check each user's actual requirements
    for (const userScore of outstandingUsers) {
      try {
        const userData = await replicaDb.user.findUnique({
          where: { id: userScore.userId },
          include: {
            claims: {
              include: {
                requirements: {
                  where: { status: 'PENDING' },
                  select: {
                    id: true,
                    type: true,
                    claim_requirement_reason: true
                  }
                }
              }
            }
          }
        })

        result.usersChecked++

        if (!userData || !userData.is_enabled) {
          // User not found or disabled - should be removed
          result.removedUsers.push({
            userId: userScore.userId,
            hadOnlyExcludedRequirements: false,
            requirementTypes: ['USER_NOT_FOUND_OR_DISABLED']
          })
          result.usersToRemove++
          continue
        }

        // Check if user still has signature (required for outstanding_requests queue)
        const hasSignature = !!userData.current_signature_file_id
        if (!hasSignature) {
          // User lost signature - should move to unsigned_users, not be removed entirely
          console.log(`⚠️ User ${userScore.userId} lost signature - should be moved to unsigned_users queue`)
          continue
        }

        // Count valid pending requirements (excluding filtered types)
        const allRequirements = userData.claims.flatMap(claim => claim.requirements)
        const requirementTypes = allRequirements.map(req => req.type || 'UNKNOWN')
        
        const validRequirements = allRequirements.filter(req => {
          // Exclude standard excluded types
          if (EXCLUDED_REQUIREMENT_TYPES.includes(req.type || '')) {
            return false
          }
          // Exclude id_document with specific reason
          if (req.type === 'id_document' && req.claim_requirement_reason === 'base requirement for claim.') {
            return false
          }
          return true
        })

        if (validRequirements.length === 0) {
          // User has no valid pending requirements - should be removed from outstanding_requests
          result.removedUsers.push({
            userId: userScore.userId,
            hadOnlyExcludedRequirements: true,
            requirementTypes
          })
          result.usersToRemove++
        }

      } catch (error) {
        console.error(`❌ Error checking user ${userScore.userId}:`, error)
        result.errors.push(`User ${userScore.userId}: ${error}`)
      }
    }

    console.log(`📊 Analysis complete: ${result.usersToRemove} of ${result.usersChecked} users need to be removed`)

    // Step 3: Show what would be removed (dry run first)
    if (result.usersToRemove > 0) {
      console.log('\n🔍 Users to be removed from outstanding_requests queue:')
      result.removedUsers.forEach(user => {
        console.log(`   👤 User ${user.userId}: ${user.requirementTypes.join(', ')}`)
      })

      // Ask for confirmation
      console.log(`\n⚠️  This will remove ${result.usersToRemove} users from outstanding_requests queue.`)
      console.log('   Run with --confirm flag to execute the removal.')
      
      const shouldExecute = process.argv.includes('--confirm')
      
      if (shouldExecute) {
        console.log('\n🚀 Executing removal...')
        
        // Step 4: Remove users from outstanding_requests queue
        for (const userToRemove of result.removedUsers) {
          try {
            const updateResult = await prisma.userCallScore.updateMany({
              where: { 
                userId: userToRemove.userId,
                // @ts-ignore - currentQueueType exists in database
                currentQueueType: 'outstanding_requests'
              },
              data: { 
                // @ts-ignore - currentQueueType exists in database
                currentQueueType: null,
                currentScore: 0,
                isActive: false,
                // @ts-ignore - lastQueueCheck exists in database
                lastQueueCheck: new Date()
              }
            })

            if (updateResult.count > 0) {
              result.usersRemoved++
              
              // Create conversion record
              await prisma.conversion.create({
                data: {
                  userId: userToRemove.userId,
                  previousQueueType: 'outstanding_requests',
                  conversionType: 'requirements_completed',
                  conversionReason: 'Removed due to only having excluded requirements (cleanup after id_document filtering)',
                  finalScore: 0,
                  totalCallAttempts: 0,
                  signatureObtained: true,
                  convertedAt: new Date()
                }
              })
            }
          } catch (error) {
            console.error(`❌ Failed to remove user ${userToRemove.userId}:`, error)
            result.errors.push(`Failed to remove user ${userToRemove.userId}: ${error}`)
          }
        }
        
        console.log(`✅ Removed ${result.usersRemoved} users from outstanding_requests queue`)
      } else {
        console.log('\n🔍 Dry run complete. Use --confirm to execute the changes.')
      }
    }

    result.duration = Date.now() - startTime
    result.success = result.errors.length === 0
    result.summary = `Checked ${result.usersChecked} users, identified ${result.usersToRemove} for removal, actually removed ${result.usersRemoved}`

    console.log(`\n📋 Summary: ${result.summary}`)
    console.log(`⏱️  Duration: ${result.duration}ms`)
    
    if (result.errors.length > 0) {
      console.log(`⚠️  Errors: ${result.errors.length}`)
      result.errors.forEach(error => console.log(`   ${error}`))
    }

    return result

  } catch (error) {
    result.duration = Date.now() - startTime
    result.errors.push(`${error}`)
    console.error('❌ Cleanup failed:', error)
    throw error
  }
}

// Run the script
if (require.main === module) {
  main()
    .then(() => {
      console.log('✅ Cleanup script completed')
      process.exit(0)
    })
    .catch((error) => {
      console.error('❌ Cleanup script failed:', error)
      process.exit(1)
    })
}

export { main as cleanupIdDocumentOutstandingUsers } 