/**
 * Streamlined Knowledge Base Summary
 * Optimized for AI conversation flow with facts, benefits, and objection handling
 */

export const KB_SUMMARY = {
  facts: [
    "DCA allowed commission-linked rate setting; banned 28 Jan 2021; 2007–2021 in scope.",
    "PCP & HP mainly affected; PCH usually out for DCA.",
    "FCA response pause until 4 Dec 2025; most redress expected early 2026.",
    "2025 Supreme Court narrowed hidden-commission claims; DCA and s.140A unfair-relationship claims remain viable.",
    "DIY is free; we can still act for you.",
    "LOA enables soft credit search and lender data requests.",
    "ID required for lender data release and to receive funds.",
    "Complaints don't appear on credit files; keep paying as normal.",
    "Outcomes may include refunds of interest/charges plus statutory interest; no guarantees.",
    "Fees capped at 30% + VAT on a sliding scale.",
    "Each agreement is a separate case; multiple agreements OK.",
    "Post-28 Jan 2021: DCA usually out; other claims may still apply.",
    "Portal link is for signatures, uploads, and real-time status updates.",
    "We are a Claims mangemenet company, regualted by the FCA.",
    "We partner with Prowse Phillips Law to deal with the legal side of the claims.",
    "We are a regulated company, so we are able to act on your behalf.", 
    "The FCA have now confirmed there will be a redress scheme",
    "The FCA have confirmed that the redress scheme will be in place by the end of 2025",
    "The FCA has made some comments about the compensation being £950, but have also said it's an estiamte.",
    "The total scheme has been estimated to be between £9-£18bn"
  ],
  benefits: [
    "Locate historic agreements back to 2007 (credit checks + SARs). Lenders usually delete records after 6 years.",
    "Run multiple claim angles (DCA, unfair-relationship, irresponsible lending).",
    "Handle lender chasers/negotiations end-to-end.",
    "Prevent missed communications and low 'tipping' offers.",
    "Maintain momentum with structured workflows and proactive chasing.",
    "Secure portal for signatures, uploads, and real-time status.",
    "Backed by Prowse Phillips Law with compliant processes.",
    "We are able to act on your behalf, so you don't need to worry about the legal side of the claims.",
  ],
  objectionHandlingIntelligence: {
    psychologyFramework: {
      approach: "Understand the emotional and logical drivers behind each objection, then address the underlying psychology naturally using facts and benefits",
      structure: "Acknowledge → Understand → Address → Guide (but adapt this flow to the conversation, don't force it)",
      tone: "Conversational, empathetic, consultative - match their energy and communication style"
    },
    
    corePsychologies: {
      legitimacyConcerns: {
        emotionalDrivers: ["Fear of scams", "Past bad experiences", "Sounds too good to be true", "Protective skepticism"],
        logicalDrivers: ["Want verification", "Need proof of credentials", "Seeking transparency"],
        addressWith: ["FCA regulation status", "Prowse Phillips Law partnership", "Companies House/SRA verification", "No upfront fees structure"],
        psychologicalApproach: "Validate their caution as intelligent, provide concrete verification methods, be transparent about process",
        avoidancePatterns: ["Being defensive", "Dismissing concerns", "Pushing too hard after providing verification"]
      },
      
      autonomyConcerns: {
        emotionalDrivers: ["Desire for control", "Independence preference", "Self-reliance pride", "Distrust of intermediaries"],
        logicalDrivers: ["Thinks it's simple", "Wants to save fees", "Believes they can handle it"],
        addressWith: ["Complexity of finding agreements", "Lender communication challenges", "Time investment reality", "Missed deadline risks"],
        psychologicalApproach: "Respect their capability and choice, then gently highlight practical challenges without undermining their confidence",
        avoidancePatterns: ["Telling them they can't do it", "Being condescending", "Aggressive persuasion"]
      },
      
      valueConcerns: {
        emotionalDrivers: ["Effort vs reward doubt", "Fee anxiety", "Disappointment protection"],
        logicalDrivers: ["Cost-benefit analysis", "Time investment concerns", "Outcome uncertainty"],
        addressWith: ["No-win-no-fee structure", "Potential compensation amounts", "Time savings", "Success rate indicators"],
        psychologicalApproach: "Acknowledge their practical mindset, provide value clarity, focus on risk-free opportunity",
        avoidancePatterns: ["Making guarantees", "Overselling outcomes", "Minimizing their concerns"]
      },
      
      timelineConcerns: {
        emotionalDrivers: ["Impatience", "Frustration with delays", "Urgency for resolution"],
        logicalDrivers: ["Want realistic expectations", "Planning considerations", "Opportunity cost assessment"],
        addressWith: ["FCA timeline clarity", "Proactive communication promise", "Early 2026 expectations", "Progress tracking"],
        psychologicalApproach: "Empathize with their frustration, provide realistic expectations, emphasize what we control vs don't control",
        avoidancePatterns: ["False timeline promises", "Minimizing their impatience", "Vague timeline responses"]
      },
      
      newsHeadlineConcerns: {
        emotionalDrivers: ["Confusion from media", "Fear of wasted effort", "Disappointment from false hope"],
        logicalDrivers: ["Want current accurate information", "Need clarification on Supreme Court impact"],
        addressWith: ["Supreme Court ruling scope", "DCA vs hidden commission distinction", "Unfair relationship claims status"],
        psychologicalApproach: "Acknowledge the confusing media coverage, provide clear current status, separate different claim types",
        avoidancePatterns: ["Dismissing the news", "Over-complicating explanations", "False reassurances"]
      }
    },
    
    intelligentResponseGuidance: {
      naturalConversation: "Use your conversational intelligence to weave psychology, facts, and benefits into natural responses that feel human and consultative",
      adaptToUser: "Match their communication style - formal users get professional responses, casual users get friendly approaches",
      buildOnContext: "Reference what they specifically said, show you're listening and understanding their unique situation",
      guidanceNotScripts: "Use this psychology understanding to craft original responses, don't follow templates or repeat phrases"
    },
    
    complianceRequirements: {
      mandatory: ["No outcome guarantees", "No legal/financial advice", "Keep PII discussions in portal", "Respect consent and cooldowns"],
      escalation: ["Route complaints/abuse appropriately", "Escalate complex situations to Customer Service"]
    }
  }
} as const;

export type KBSummary = typeof KB_SUMMARY;
export type ObjectionPsychology = typeof KB_SUMMARY.objectionHandlingIntelligence.corePsychologies[keyof typeof KB_SUMMARY.objectionHandlingIntelligence.corePsychologies];
