/**
 * Voice Session Manager
 * 
 * Manages AI voice agent sessions with state tracking
 * Inspired by OpenAI Realtime Agents patterns
 */

import { voiceAgentTools, executeVoiceTool } from './voice-tools'

export interface VoiceSessionState {
  sessionId: string
  callSid: string
  from: string
  to: string
  startTime: Date
  endTime?: Date
  
  // Authentication
  isAuthenticated: boolean
  claimReference?: string
  
  // Conversation state
  currentIntent?: 'greeting' | 'status_check' | 'callback' | 'documents' | 'escalation'
  conversationHistory: Array<{
    role: 'user' | 'assistant' | 'system'
    content: string
    timestamp: Date
  }>
  
  // Metrics
  interruptions: number
  toolCalls: Array<{
    tool: string
    args: any
    result: any
    timestamp: Date
  }>
  
  // Agent state (for potential multi-agent patterns)
  currentAgent: 'greeter' | 'claims_specialist' | 'escalation'
  handoffHistory: Array<{
    from: string
    to: string
    reason: string
    timestamp: Date
  }>
}

class VoiceSessionManager {
  private sessions: Map<string, VoiceSessionState> = new Map()
  
  /**
   * Create a new session
   */
  createSession(params: {
    callSid: string
    from: string
    to: string
  }): VoiceSessionState {
    const sessionId = `voice_${params.callSid}_${Date.now()}`
    
    const session: VoiceSessionState = {
      sessionId,
      callSid: params.callSid,
      from: params.from,
      to: params.to,
      startTime: new Date(),
      isAuthenticated: false,
      currentAgent: 'greeter',
      conversationHistory: [],
      interruptions: 0,
      toolCalls: [],
      handoffHistory: []
    }
    
    this.sessions.set(sessionId, session)
    console.log(`📞 [SESSION] Created session ${sessionId}`)
    
    return session
  }
  
  /**
   * Get session by ID
   */
  getSession(sessionId: string): VoiceSessionState | undefined {
    return this.sessions.get(sessionId)
  }
  
  /**
   * Update session state
   */
  updateSession(sessionId: string, updates: Partial<VoiceSessionState>): void {
    const session = this.sessions.get(sessionId)
    if (session) {
      Object.assign(session, updates)
      console.log(`📝 [SESSION] Updated session ${sessionId}`, updates)
    }
  }
  
  /**
   * Record conversation turn
   */
  recordTurn(sessionId: string, role: 'user' | 'assistant', content: string): void {
    const session = this.sessions.get(sessionId)
    if (session) {
      session.conversationHistory.push({
        role,
        content,
        timestamp: new Date()
      })
    }
  }
  
  /**
   * Record tool call
   */
  async recordToolCall(
    sessionId: string, 
    toolName: string, 
    args: any
  ): Promise<any> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }
    
    // Execute the tool
    const result = await executeVoiceTool(toolName, args, {
      callSid: session.callSid,
      from: session.from
    })
    
    // Record the call
    session.toolCalls.push({
      tool: toolName,
      args,
      result,
      timestamp: new Date()
    })
    
    // Update state based on tool
    if (toolName === 'check_claim_status' && result.success) {
      session.currentIntent = 'status_check'
    } else if (toolName === 'transfer_to_human') {
      session.currentAgent = 'escalation'
      session.handoffHistory.push({
        from: session.currentAgent,
        to: 'escalation',
        reason: args.reason,
        timestamp: new Date()
      })
    }
    
    return result
  }
  
  /**
   * Handle agent handoff (multi-agent pattern)
   */
  handoffAgent(sessionId: string, toAgent: string, reason: string): void {
    const session = this.sessions.get(sessionId)
    if (session) {
      const fromAgent = session.currentAgent
      session.currentAgent = toAgent as any
      session.handoffHistory.push({
        from: fromAgent,
        to: toAgent,
        reason,
        timestamp: new Date()
      })
      
      console.log(`🤝 [HANDOFF] ${fromAgent} → ${toAgent}: ${reason}`)
    }
  }
  
  /**
   * End session
   */
  endSession(sessionId: string): void {
    const session = this.sessions.get(sessionId)
    if (session) {
      session.endTime = new Date()
      
      // Log session metrics
      const duration = Math.round((session.endTime.getTime() - session.startTime.getTime()) / 1000)
      console.log(`📊 [SESSION] Ended ${sessionId}`, {
        duration: `${duration}s`,
        turns: session.conversationHistory.length,
        toolCalls: session.toolCalls.length,
        interruptions: session.interruptions,
        handoffs: session.handoffHistory.length
      })
      
      // In production, save to database here
      // await saveSessionToDatabase(session)
      
      // Clean up after 5 minutes
      setTimeout(() => {
        this.sessions.delete(sessionId)
      }, 5 * 60 * 1000)
    }
  }
  
  /**
   * Get active session count
   */
  getActiveSessionCount(): number {
    let active = 0
    this.sessions.forEach(session => {
      if (!session.endTime) active++
    })
    return active
  }
  
  /**
   * Generate session summary for handoff
   */
  generateHandoffSummary(sessionId: string): string {
    const session = this.sessions.get(sessionId)
    if (!session) return 'No session information available.'
    
    const recentTurns = session.conversationHistory.slice(-5)
    const summary = `
Customer: ${session.from}
Authenticated: ${session.isAuthenticated}
Claim Ref: ${session.claimReference || 'Not provided'}
Current Intent: ${session.currentIntent || 'Unknown'}
Recent Tools: ${session.toolCalls.slice(-3).map(t => t.tool).join(', ') || 'None'}

Recent Conversation:
${recentTurns.map(t => `${t.role}: ${t.content}`).join('\n')}
    `.trim()
    
    return summary
  }
}

// Export singleton instance
export const voiceSessionManager = new VoiceSessionManager()

// Export for testing
export { VoiceSessionManager }
