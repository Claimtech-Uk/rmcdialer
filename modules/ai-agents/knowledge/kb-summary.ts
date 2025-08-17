/**
 * Enhanced Knowledge Base Summary
 * Optimized for AI conversation flow with structured sections, benefits, and objection handling
 * Organized by customer journey for improved LLM performance
 */

export const KB_SUMMARY = {
  // Structured knowledge organized by customer journey and topic
  structuredKnowledge: {
    claimBackgroundLegitimacy: {
      title: "What This Claim Is About & Why It's Legitimate",
      description: "Use when people don't understand the issue, think it's not real, or ask 'what's this about?'",
      content: [
        "The Issue: Motor finance brokers/dealers were allowed to secretly increase your interest rates to earn higher commissions between 2007-2021. This meant you paid more than you should have for your car finance.",
        "FCA Investigation: The Financial Conduct Authority investigated this industry-wide practice and found widespread mis-selling affecting millions of customers. They banned these practices in January 2021.",
        "Court Precedent: Multiple court cases have already been won by consumers, establishing strong legal precedent. The 2024 Supreme Court ruling clarified that both DCA and unfair relationship claims under Section 140A remain fully valid pathways for compensation.",
        "Regulatory Response: The FCA has confirmed a compensation scheme will be in place by end-2025, with industry estimates of £9-18 billion in total redress across all affected customers.",
        "Scale: This isn't a few isolated cases - it affected millions of PCP and HP agreements across virtually every major car finance lender in the UK.",
        "Current Status: While the FCA paused lender responses until December 2025, consumers can still complain now and many are already winning substantial compensation.",
        "Legal Foundation: Claims are based on breaches of the Consumer Credit Act and FCA regulations - this is established consumer law, not speculative."
      ],
      // Logic: Legitimacy questions come from lack of awareness - build credibility with regulatory/legal facts
      linkedBenefit: "We're FCA-regulated and backed by Prowse Phillips Law - pursuing claims based on established legal precedent and regulatory findings",
      addressesObjection: "legitimacyConcerns" // Perfect match - addresses "is this even real?" concerns
    },
    
    scopeEligibility: {
      title: "Scope & Eligibility", 
      description: "Use when qualifying users or explaining who can claim",
      content: [
        "DCA (Discretionary Commission Arrangement): A type of motor finance commission where brokers could vary their commission rate. Allowed 2007–28 Jan 2021; banned thereafter. Post-ban cases are usually out for DCA, but other claim types may still apply.",
        "Agreement types: PCP & HP mainly affected; PCH usually out for DCA.",
        "Per-agreement basis: Each agreement = a separate case; multiple agreements are fine.",
        "Who you complain against: Complaints are made against lenders/finance providers."
      ],
      // Logic: People asking about eligibility often consider DIY route, so emphasize our ability to find old agreements
      linkedBenefit: "Find old agreements back to 2007 via soft checks and SARs (lenders often delete after 6 years)",
      addressesObjection: "autonomyConcerns" // "Can I do this myself?" is common with eligibility questions
    },
    
    timingRegulatory: {
      title: "Timing & Regulatory/Legal Context", 
      description: "Use for timeline questions, delays, and regulatory updates",
      content: [
        "FCA pause: Complaint handling is paused until 4 Dec 2025.",
        "Redress scheme: FCA has confirmed there will be a scheme and that it will be in place by end-2025; most redress is expected early 2026.",
        "Estimates: FCA has referenced ~£950 compensation as an estimate; total scheme size estimated £9–£18bn.",
        "Public commentary: Martin Lewis suggested automatic redress; the FCA considers that unlikely.",
        "Court landscape: The 2024 Supreme Court decision narrowed hidden-commission routes but opened up unfair relationship claims; DCA and s.140A unfair-relationship claims remain viable."
      ],
      // Logic: Timeline questions = impatience/frustration, so emphasize we handle the chasing
      linkedBenefit: "Keep momentum with structured workflows and proactive chasing",
      addressesObjection: "timelineConcerns" // Direct match - timeline questions = timeline concerns
    },
    
    processRequirements: {
      title: "Process & Requirements",
      description: "Use for 'how does it work' questions and explaining what happens next",
      content: [
        "Your steps (simple): Sign up → soft credit check to find agreements → we request any missing agreements from lenders → we assess for DCA → we investigate other claim types → we lodge and run your complaint and work to recover money.",
        "Letter of Authority (LOA) allows a soft credit search and lets us request lender data.",
        "We're an FCA-regulated Claims Management Company and can act on your behalf.",
        "We partner with Prowse Phillips Law for the legal side of claims.",
        "ID: Required for lenders to release data and for you to receive funds.",
        "Portal: One secure portal link for e-signatures, uploads, and real-time status updates.",
        "DIY option: You can complain yourself for free; we can still act for you if you prefer.",
        "Operational hygiene: We handle lender chasers/negotiations end-to-end, prevent missed messages and low 'tipping' offers, and maintain momentum via structured workflows and proactive chasing."
      ],
      // Logic: Process questions often come from trust verification - show we're professional and thorough
      linkedBenefit: "End-to-end handling of lender chasers and negotiations",
      addressesObjection: "legitimacyConcerns" // "How does it work?" = "Are you legitimate?"
    },
    
    outcomesFeesProtections: {
      title: "Outcomes, Fees & Protections",
      description: "Use for cost/benefit questions and addressing value concerns",
      content: [
        "Potential outcomes: Refunds of interest/charges plus statutory interest; no guarantees.",
        "Fees: Capped at 30% + VAT on a sliding scale.",
        "Credit file: Complaints don't appear on credit files; keep paying as normal."
      ],
      // Logic: Fee questions = value assessment, emphasize we protect their interests
      linkedBenefit: "Prevent missed communications and low 'tipping' offers",
      addressesObjection: "valueConcerns" // Direct match - fees/outcomes = value concerns
    },
    
    marketUpdates: {
      title: "Recent Market Developments & Supreme Court Update",
      description: "Use for questions about recent news, Supreme Court ruling, or current regulatory status",
      content: [
        "Supreme Court Ruling Impact: The 2024 Supreme Court decision narrowed certain hidden commission routes but importantly opened up potential for unfair relationship claims under Section 140A of the Consumer Credit Act.",
        "Dual Claim Pathways: Both DCA (Discretionary Commission Arrangement) claims and unfair relationship claims remain fully viable and valid routes for compensation.",
        "FCA Confirmed Redress: The Financial Conduct Authority has officially confirmed that a redress scheme will be implemented, validating the legitimacy of these claims industry-wide.",
        "Market Scale Confirmed: Total damages across the industry are confirmed at £9-18 billion, demonstrating the massive scope of this mis-selling issue affecting millions of consumers.",
        "Regulatory Certainty: While the FCA has not yet released exact details of how the redress scheme will operate, they have confirmed it will be in place by end-2025, providing certainty for consumers.",
        "Current Status: Despite regulatory pause until December 2025, consumers can still lodge complaints now and many are already winning compensation through established legal channels.",
        "Multiple Angles Available: The Supreme Court ruling actually strengthened our position by clarifying that we can pursue both DCA claims (where appropriate) and unfair relationship claims, maximizing potential recovery."
      ],
      // Logic: Market update questions often come from news confusion - provide clarity and reassurance
      linkedBenefit: "We stay current with all regulatory changes and pursue every viable angle to maximize your compensation potential",
      addressesObjection: "newsHeadlineConcerns" // Perfect match - addresses confusion from recent media coverage
    }
  },

  // Benefits organized by value proposition
  benefits: {
    title: "Why Use Us (Benefits)",
    description: "Value propositions for addressing autonomy and value concerns",
    content: [
      "Find old agreements back to 2007 via soft checks and SARs (lenders often delete after 6 years).",
      "Run multiple angles (DCA, s.140A unfair relationship, irresponsible lending).",
      "End-to-end handling of lender chasers and negotiations.",
      "Prevent missed communications and low 'tipping' offers.",
      "Keep momentum with structured workflows and proactive chasing.",
      "Secure portal for signatures, uploads, and live status.",
      "Backed by Prowse Phillips Law with compliant processes.",
      "We can act on your behalf, so you don't need to worry about the legal side."
    ]
  },
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
  },

  // Stage-specific completion promises and support offers (for AI paraphrasing - don't copy exactly)
  stageIntelligence: {
    completionPromiseIntents: {
      signature: "After signing and ID upload → agreement search begins quickly (within 24hrs) investigating all agreements for multiple claims",
      requirements: "After document upload → case fast-tracked to legal team for processing",
      status: "Ongoing → we handle lender chasing and provide progress updates", 
      review: "Reviews help → other people understand the process and what to expect"
    },
    supportOfferIntents: {
      signature: "Help available → portal assistance, upload guidance, technical support",
      requirements: "Flexibility → alternative options if documents unavailable, workarounds, guidance",
      status: "Process support → questions welcomed, explanation available, ongoing help",
      review: "Writing help → suggest key points, guide what to mention, optional assistance"
    },
    objectionBenefits: {
      legitimacyConcerns: "This is a real, industry-wide issue that the FCA investigated and found widespread mis-selling. We're FCA regulated (ref 838936) and backed by Prowse Phillips Law - pursuing claims based on established court precedent and regulatory findings",
      autonomyConcerns: "We find old agreements you might not have - lenders delete records after 6 years, but we can recover them",
      valueConcerns: "No-win-no-fee with capped rates - you only pay if we successfully recover money for you",
      timelineConcerns: "We handle all the chasing and lender communications so you don't have to wait around wondering",
      newsHeadlineConcerns: "Despite confusing headlines, unfair relationship claims are still winning - we pursue all viable angles"
    }
  },
  
  // Pre-crafted objection responses following LAARC-lite structure
  // Logic: These are compliant, tested responses that AI can adapt naturally
  objectionQuickResponses: {
    // Legitimacy: "Is this a scam?"
    scam: "I understand your caution - it's smart to check. We're FCA-regulated (ref 838936) and work with Prowse Phillips Law. You can verify us on the FCA register or Companies House.",
    
    // Autonomy: "I'll do it myself"
    myself: "Got it, you prefer handling things yourself. Just so you know, we find agreements back to 2007 that lenders often delete after 6 years. Would you like to know what's involved either way?",
    
    // Value: "What are your fees?"
    fees: "Fair question about fees. It's no-win-no-fee, capped at 30% + VAT on a sliding scale. The more we recover, the lower the percentage. You only pay if we succeed.",
    
    // Timeline: "How long will this take?"
    time: "I understand the wait is frustrating. The FCA pause runs until Dec 4 2025, with most payments expected early 2026. We chase proactively so you don't have to worry about delays.",
    
    // General resistance: "Not interested"
    notInterested: "No problem at all. Just so I can close your file correctly, was there something specific holding you back? Sometimes there's a misunderstanding I can clear up.",
    
    // News confusion: "I heard the Supreme Court killed these claims"
    news: "I completely understand the confusion from recent headlines. The 2024 Supreme Court decision actually opened up new opportunities - while it narrowed hidden commission routes, it confirmed unfair relationship claims under Section 140A are valid. Plus DCA claims remain strong. The FCA has confirmed £9-18bn in total redress is coming.",
    
    // DCA definition: "What is DCA?"
    dca: "DCA stands for Discretionary Commission Arrangement - a type of motor finance commission where brokers could vary their rate. It was allowed 2007-2021 but is now banned. We can check if your agreements fall within this window.",
    
    // Background/legitimacy: "What is this about?" "Is this real?"
    background: "This is about motor finance brokers secretly increasing interest rates to earn higher commissions between 2007-2021. The FCA investigated this industry-wide practice, banned it in 2021, and confirmed billions in compensation. Multiple court cases have already been won."
  }
} as const;

export type KBSummary = typeof KB_SUMMARY;
export type ObjectionPsychology = typeof KB_SUMMARY.objectionHandlingIntelligence.corePsychologies[keyof typeof KB_SUMMARY.objectionHandlingIntelligence.corePsychologies];
