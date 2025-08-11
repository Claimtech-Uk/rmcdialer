import { UserService } from '@/modules/users'

export type AgentUserContext = {
  found: boolean
  userId?: number
  firstName?: string
  queueType?: 'unsigned_users' | 'outstanding_requests' | null
  pendingRequirements?: number
  primaryClaimStatus?: string
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
    const callContext = await this.userService.getUserCallContext(userId).catch(() => null)
    let queueType: 'unsigned_users' | 'outstanding_requests' | null = null
    try {
      if (callContext) {
        const hasSignature = Boolean((callContext as any).user?.signatureFileId || (callContext as any).user?.current_signature_file_id)
        const pending = (callContext.claims || []).some((c: any) => (c.requirements || []).some((r: any) => r.status === 'PENDING'))
        if (!hasSignature) queueType = 'unsigned_users'
        else if (pending) queueType = 'outstanding_requests'
      }
    } catch {}

    const claims = callContext?.claims || []
    const pending = claims.reduce((acc: number, c: any) => acc + (c.requirements?.filter((r: any) => r.status === 'PENDING').length || 0), 0)
    const primaryClaimStatus = claims[0]?.status || undefined

    // Ensure we never return placeholder names like 'Unknown' into prompts
    const resolvedFirst = (callContext?.user.firstName || basic.first_name || '').trim()
    const firstName = resolvedFirst && /^(unknown|user)$/i.test(resolvedFirst) ? undefined : resolvedFirst

    return {
      found: true,
      userId,
      firstName,
      queueType: (queueType as any) || null,
      pendingRequirements: pending,
      primaryClaimStatus
    }
  }
}


