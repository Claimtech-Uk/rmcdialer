import { UserService } from '@/modules/users'

export type AgentUserContext = {
  found: boolean
  userId?: number
  firstName?: string
  queueType?: 'unsigned_users' | 'outstanding_requests' | null
  pendingRequirementTypes?: string[]
  primaryClaimStatus?: string
  claimLenders?: string[]
  // ENHANCED: Claim-specific requirements grouped by lender
  claimRequirements?: Array<{
    claimId: number
    lender: string
    status: string
    pendingRequirements: string[]
  }>
}

export class AgentContextBuilder {
  constructor(private readonly userService: UserService = new UserService()) {}

  async buildFromPhone(phoneNumber: string): Promise<AgentUserContext> {
    // Try to find user by phone
    const basic = await this.userService.getUserByPhoneNumber(phoneNumber).catch(() => null)
    if (!basic) {
      return { found: false }
    }

    const userId = Number(basic.id)

    // Fetch only what we need for SMS: user+claims (pending requirements) and infer queue type locally
    // ENHANCED: Include requirement details to get actual requirement types (not just placeholders)
    const callContext = await this.userService.getUserCallContext(userId, {
      includeRequirementDetails: true
    }).catch(() => null)
    let queueType: 'unsigned_users' | 'outstanding_requests' | null = null
    try {
      if (callContext) {
        const hasSignature = Boolean((callContext as any).user?.signatureFileId || (callContext as any).user?.current_signature_file_id)
        const hasPendingRequirements = (callContext.claims || []).some((c: any) => (c.requirements || []).some((r: any) => r.status === 'PENDING'))
        if (!hasSignature) queueType = 'unsigned_users'
        else if (hasPendingRequirements) queueType = 'outstanding_requests'
      }
    } catch {}

    const claims = callContext?.claims || []
    
    // Extract all unique lenders from all claims
    const claimLenders = [...new Set(
      claims
        .map((c: any) => c.lender)
        .filter((lender: any) => lender && lender.trim())
    )]
    
    // Extract all unique pending requirement types
    const pendingRequirementTypes = [...new Set(
      claims
        .flatMap((c: any) => c.requirements || [])
        .filter((r: any) => r.status === 'PENDING')
        .map((r: any) => r.type)
        .filter((type: any) => type && type.trim())
    )]

    // ENHANCED: Build claim-specific requirements grouped by lender
    const claimRequirements = claims.map((claim: any) => {
      const pendingReqs = (claim.requirements || [])
        .filter((r: any) => r.status === 'PENDING')
        .map((r: any) => r.type)
        .filter((type: any) => type && type.trim())
      
      return {
        claimId: Number(claim.id),
        lender: claim.lender || 'Unknown',
        status: claim.status || 'Unknown',
        pendingRequirements: pendingReqs
      }
    }).filter((claim: any) => claim.pendingRequirements.length > 0) // Only include claims with pending requirements
    
    const primaryClaimStatus = claims[0]?.status || undefined

    // Ensure we never return placeholder names like 'Unknown' into prompts
    const resolvedFirst = (callContext?.user.firstName || basic.first_name || '').trim()
    const firstName = resolvedFirst && /^(unknown|user)$/i.test(resolvedFirst) ? undefined : resolvedFirst

    return {
      found: true,
      userId,
      firstName,
      queueType: (queueType as any) || null,
      pendingRequirementTypes,
      primaryClaimStatus,
      claimLenders,
      claimRequirements
    }
  }
}


