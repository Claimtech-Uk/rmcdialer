import type { AgentTurnInput } from '../../../core/agent-runtime.service'
import { getBehaviourOverride } from '../../../core/agent-behavior-override.store'

// Simplified agent types without session dependencies
export type SmsAgentType = 'customer_service' | 'unsigned_chase' | 'requirements' | 'review_collection'

export type RouteDecision = {
  type: SmsAgentType
  reason: string
  sessionStarted?: boolean
}

export type UserRoutingSignals = {
  found: boolean
  hasSignature: boolean | null
  pendingRequirements: number
}

export class SmsAgentRouter {
  async route(phone: string, signals: UserRoutingSignals): Promise<RouteDecision> {
    // Check behaviour override
    try {
      const override = await getBehaviourOverride(phone)
      if (override?.type) {
        console.log('AI SMS | 🧭 Router: behaviour override active', { phone, type: override.type })
        return { type: override.type, reason: 'behaviour_override' }
      }
    } catch (err) {
      console.warn('AI SMS | ⚠️ Router: behaviour override check failed', { err })
    }

    // Simple routing based on signals (no session management)
    if (signals.found) {
      if (signals.hasSignature === false) {
        console.log('AI SMS | 🧭 Router: unsigned user', { phone })
        return { type: 'unsigned_chase', reason: 'unsigned' }
      }
      if ((signals.pendingRequirements || 0) > 0) {
        console.log('AI SMS | 🧭 Router: requirements needed', { phone })
        return { type: 'requirements', reason: 'pending_requirements' }
      }
    }

    console.log('AI SMS | 🧭 Router: default customer_service', { phone })
    return { type: 'customer_service', reason: 'default' }
  }

  async endIfGoalAchieved(phone: string, type: SmsAgentType, signals: UserRoutingSignals): Promise<boolean> {
    // Simplified - no session management needed
    console.log('AI SMS | 🧭 Router: goal achievement check (simplified)', { phone, type })
    return false // No session ending needed in simplified mode
  }
}


