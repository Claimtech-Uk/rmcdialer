import type { AgentTurnInput } from '../../../core/agent-runtime.service'
import type { SmsAgentSession, SmsAgentType } from '../../../core/session.store'
import { getActiveSession, startSession, completeSession } from '../../../core/session.store'

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
  // Default TTLs per agent type (seconds)
  private ttl: Record<SmsAgentType, number> = {
    customer_service: 0, // stateless default
    unsigned_chase: 3 * 24 * 60 * 60,
    requirements: 5 * 24 * 60 * 60,
    review_collection: 7 * 24 * 60 * 60
  }

  async route(phone: string, signals: UserRoutingSignals): Promise<RouteDecision> {
    const existing = await getActiveSession(phone)
    if (existing && existing.type !== 'customer_service') {
      console.log('AI SMS | 🧭 Router: sticky', { phone, type: existing.type })
      return { type: existing.type, reason: 'sticky_session' }
    }

    // Choose based on current status
    if (signals.found) {
      if (signals.hasSignature === false) {
        await startSession(phone, { type: 'unsigned_chase', startedAt: Date.now(), lastAt: Date.now(), ttlSeconds: this.ttl.unsigned_chase })
        console.log('AI SMS | 🧭 Router: start unsigned', { phone })
        return { type: 'unsigned_chase', reason: 'unsigned', sessionStarted: true }
      }
      if ((signals.pendingRequirements || 0) > 0) {
        await startSession(phone, { type: 'requirements', startedAt: Date.now(), lastAt: Date.now(), ttlSeconds: this.ttl.requirements })
        console.log('AI SMS | 🧭 Router: start requirements', { phone })
        return { type: 'requirements', reason: 'pending_requirements', sessionStarted: true }
      }
    }

    console.log('AI SMS | 🧭 Router: default customer_service', { phone })
    return { type: 'customer_service', reason: 'default' }
  }

  async endIfGoalAchieved(phone: string, type: SmsAgentType, signals: UserRoutingSignals): Promise<boolean> {
    if (type === 'unsigned_chase' && signals.hasSignature === true) {
      await completeSession(phone)
      console.log('AI SMS | 🧭 Router: end unsigned (signed)', { phone })
      return true
    }
    if (type === 'requirements' && (signals.pendingRequirements || 0) === 0) {
      await completeSession(phone)
      console.log('AI SMS | 🧭 Router: end requirements (cleared)', { phone })
      return true
    }
    if (type === 'review_collection') {
      await completeSession(phone)
      console.log('AI SMS | 🧭 Router: end review (link sent)', { phone })
      return true
    }
    return false
  }
}


