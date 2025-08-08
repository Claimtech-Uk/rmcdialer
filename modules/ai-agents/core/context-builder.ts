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

    // Fetch richer context and queue-type to infer signature/requirements
    const [callContext, queueType] = await Promise.all([
      this.userService.getUserCallContext(userId).catch(() => null),
      this.userService.determineUserQueueType(userId).catch(() => null)
    ])

    const claims = callContext?.claims || []
    const pending = claims.reduce((acc: number, c: any) => acc + (c.requirements?.filter((r: any) => r.status === 'PENDING').length || 0), 0)
    const primaryClaimStatus = claims[0]?.status || undefined

    return {
      found: true,
      userId,
      firstName: callContext?.user.firstName || basic.first_name || 'there',
      queueType: (queueType as any) || null,
      pendingRequirements: pending,
      primaryClaimStatus
    }
  }
}


