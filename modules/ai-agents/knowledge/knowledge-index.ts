// Centralized exports for curated knowledge digests (condensed from @aismsplan.mdc)

export const KNOWLEDGE_DIGESTS = {
  // PCP core – what it is, how we help, key constraints
  pcpClaim: `PCP claims: Potential mis‑sell where finance was not clearly explained (APR/total cost/commission), affordability checks were weak, or options/balloon terms were unclear. We help users understand eligibility, explain next steps, and guide them to complete actions in their portal. Never promise a payout or timeline. Avoid legal advice; stay factual and supportive.`,

  // How our system works and what Sophie should encourage
  rmcSystem: `Portal link = the secure way users view/sign documents and upload requirements. Core flows: 1) If unsigned → explain benefits of signing and offer to send the portal link. 2) If outstanding requirements → explain what’s missing and help them upload via the portal. 3) If signed/no requirements → provide status updates. Use the phrase "portal link" to users. Ask permission before sending. Respect link send cooldowns.`,

  // Top FAQs users ask, condensed answers Sophie can draw from
  faqs: `Common FAQs: (1) How long does it take? Due to FCA pause until Dec 4, 2025, most payments expected early 2026; we keep them updated in the portal. (2) What documents do you need? Usually ID, proof of address, and finance docs; the portal lists any outstanding items. (3) Is this no‑win no‑fee? We're transparent about terms; details are in the portal/disclosure docs. (4) Can you guarantee a result? No guarantees; we'll pursue the claim diligently and keep them informed. (5) I've already signed—what next? Check the portal for any outstanding items; otherwise we'll progress and update you.`,

  // Compliance guardrails to reinforce tone and limits
  compliance: `Compliance: No promises of compensation or timeframes. No legal/financial advice. Be clear, patient, and opt‑in/consent‑first. If user is abusive or wants to complain, acknowledge and offer escalation to a specialist. Never share sensitive PII in messages; prefer portal for documents.`
}

// Structured Knowledge Base with stable IDs (2.1 from @aismsplan.mdc)
export type KBItem = { id: string; title: string; sms: string; long: string }

export const KNOWLEDGE_KB: Record<string, KBItem> = {
  'KB-001': {
    id: 'KB-001',
    title: 'What is the car finance commission (DCA) issue?',
    sms: 'Some dealers/brokers could raise interest to earn more commission (DCA). Banned in 2021. If it happened on your deal, you may have paid too much. We can check and handle the complaint.',
    long: 'Discretionary Commission Arrangements (DCAs) allowed brokers/dealers to adjust interest rates to increase their commission. This was banned in Jan 2021. Cases from 2007–2021 may be eligible. Explain without promising outcomes.'
  },
  'KB-002': {
    id: 'KB-002',
    title: 'Which agreements are usually in scope?',
    sms: 'PCP and HP before 28 Jan 2021 are the main focus. Leases (PCH) are usually out of scope for DCA.',
    long: 'Regulated PCP/HP agreements may have DCA or similar commission models; pure leases (PCH) rarely do.'
  },
  'KB-003': {
    id: 'KB-003',
    title: 'What’s the current status with the regulator?',
    sms: 'Regulator is consulting on a redress scheme. Firms have until after 4 Dec 2025 to reply. You can still complain now.',
    long: 'The FCA has extended response times for motor finance commission complaints until after 4 Dec 2025. Consumers don’t need to wait to complain.'
  },
  'KB-004': {
    id: 'KB-004',
    title: 'What did the Supreme Court decide in 2025?',
    sms: 'Court limited some “secret commission” claims but unfair relationship claims can still succeed.',
    long: 'The Court reduced scope of certain secret commission claims but confirmed s.140A CCA unfair relationship claims remain viable.'
  },
  'KB-004a': {
    id: 'KB-004a',
    title: 'I heard the lenders won in the Supreme Court, so there’s no claim',
    sms: 'Not true—lenders only won on hidden commission. We still have DCA and unfair relationship claims going ahead as normal.',
    long: 'The ruling applied to hidden/half‑secret commission claims; DCA and s.140A unfair relationship claims remain valid, as do irresponsible lending claims.'
  },
  'KB-004b': {
    id: 'KB-004b',
    title: 'I read that the claims are only worth £950 each',
    sms: 'The FCA’s £950 figure is a rough estimate—many claims will be worth more on average.',
    long: 'FCA’s £950 estimate was based on limited evidence. Many claims could be higher depending on agreement value, term, rate, and additional claims. Aim to recover full amount plus interest.'
  },
  'KB-005': {
    id: 'KB-005',
    title: 'How do I complain? (DIY route and with us)',
    sms: 'You can complain directly for free. We handle everything - finding older motor finance agreements back to 2007, building stronger cases with DCA, hidden commission and irresponsible lending claims, and managing all negotiations.',
    long: 'DIY is free but limited. We find agreements back to 2007, investigate DCA, unfair relationships, and irresponsible lending. Full service: LOA → comprehensive checks → doc requests → complaint → negotiations → escalation.'
  },
  'KB-006': {
    id: 'KB-006',
    title: 'What documents/info do you need from me?',
    sms: 'Only your name, DOB, and address to run a credit check. We may request more if agreements are missing.',
    long: 'Name, DOB, and address are enough for a credit check. If agreements are missing, we may ask for lender, agreement number, or car reg.'
  },
  'KB-007': {
    id: 'KB-007',
    title: 'Why do you need my ID?',
    sms: 'Lenders require valid ID to release your data, and solicitors need ID to pay you.',
    long: 'Lenders require valid ID for data requests; solicitors must verify identity before releasing settlement funds to prevent fraud.'
  },
  'KB-008': {
    id: 'KB-008',
    title: 'Why do you need my signature?',
    sms: 'Your signature lets us run a credit check and request documents from lenders.',
    long: 'Signing the LOA allows a soft credit search to find lenders since 2007 and authorises document requests. It also formalises authority under no‑win no‑fee.'
  },
  'KB-009': {
    id: 'KB-009',
    title: 'How do we find my old agreements if I don’t remember?',
    sms: 'We can check via your credit file and lenders. You can request data (SAR).',
    long: 'We use credit reference data and Subject Access Requests to identify historic accounts.'
  },
  'KB-010': {
    id: 'KB-010',
    title: 'Will making a complaint affect my current agreement?',
    sms: 'No, it only relates to past overpayments.',
    long: 'Complaints focus on past overcharging and do not affect current agreements; successful outcomes may reduce ongoing payments.'
  },
  'KB-011': {
    id: 'KB-011',
    title: 'Will making a complaint affect my credit score?',
    sms: 'No. Complaints don’t appear on your credit report. Keep paying as normal.',
    long: 'Complaints and SARs do not appear on credit files. Continue payments to avoid credit impact.'
  },
  'KB-012': {
    id: 'KB-012',
    title: 'Do I need to keep paying during my complaint?',
    sms: 'Yes—keep paying as normal. Overpayments refunded if your case succeeds.',
    long: 'Complaints do not suspend payments. Stopping could cause arrears, fees, or repossession. Refunds are paid if successful.'
  },
  'KB-013': {
    id: 'KB-013',
    title: 'What outcomes/redress are possible?',
    sms: 'If upheld, lenders may refund overpaid interest/charges plus interest. Each case is different.',
    long: 'Redress can include refunds of overpaid interest/charges, statutory interest, and corrections to credit records. No guarantees.'
  },
  'KB-014': {
    id: 'KB-014',
    title: 'Timelines — how long will this take?',
    sms: 'Due to FCA rules, lenders have until December 4, 2025 to respond. Most payments are expected from early 2026. We proactively chase and keep you updated throughout.',
    long: 'FCA pause until 4 Dec 2025 means extended response times. Most payments expected early 2026. We track and chase cases proactively; timelines vary by lender but regulatory pause affects all cases.'
  },
  'KB-015': {
    id: 'KB-015',
    title: 'When will I get my money back?',
    sms: 'Due to FCA pause until December 4, 2025, most payments are expected from early 2026. We actively chase for quicker resolution where possible.',
    long: 'FCA regulatory pause until 4 Dec 2025 affects all motor finance cases. Payments likely early 2026. We actively chase lenders and negotiate for faster resolution where possible.'
  },
  'KB-016': {
    id: 'KB-016',
    title: 'Is there a cancellation period?',
    sms: 'You can cancel within 14 days at no cost.',
    long: 'You may cancel within 14 days of signing at no cost. After this, if work was done, a nominal admin fee may apply.'
  },
  'KB-017': {
    id: 'KB-017',
    title: 'Four reasons to use our service',
    sms: 'We fight for full amounts, speed payouts, ensure you don’t miss communication, and find older claims.',
    long: '1) Tipping offers – we fight low settlements. 2) Delayed compensation – we push for quicker payouts. 3) Communication issues – we ensure you get notices. 4) Missing data – we find agreements back to 2007.'
  },
  'KB-018': {
    id: 'KB-018',
    title: 'What is a “hidden” or “half-secret” commission?',
    sms: 'Hidden = no disclosure. Half-secret = told it may exist, not how much. Both can still be unfair.',
    long: 'Hidden and half‑secret commission can still be unfair under s.140A CCA even after 2025 rulings, depending on the circumstances.'
  },
  'KB-019': {
    id: 'KB-019',
    title: 'Irresponsible lending — when is it relevant?',
    sms: 'If affordability checks were weak or ignored.',
    long: 'If proportionate checks weren’t done, or the product was unsuitable. We assess debt levels, defaults, income stability, and other indicators.'
  },
  'KB-020': {
    id: 'KB-020',
    title: 'I have claimed myself / gone through Martin Lewis',
    sms: 'You can claim yourself. We can also check older motor finance agreements and add DCA, hidden commission and irresponsible lending claims.',
    long: 'DIY claims are possible, but we can find older agreements, add DCA and irresponsible lending claims, and build a stronger case.'
  },
  'KB-021': {
    id: 'KB-021',
    title: 'What if I have multiple agreements?',
    sms: 'You can complain about each eligible agreement.',
    long: 'Each agreement is treated as a separate case with its own evidence and timeline.'
  },
  'KB-022': {
    id: 'KB-022',
    title: 'What if my deal was after 28 Jan 2021?',
    sms: 'DCA issues usually out of scope; we check for other issues.',
    long: 'The DCA ban took effect on this date; other issues may still apply such as unfair commission or irresponsible lending.'
  },
  'KB-023': {
    id: 'KB-023',
    title: 'What happens if I’m unhappy with your service?',
    sms: 'Tell us and we’ll put it right.',
    long: 'We follow our complaints procedure; unresolved issues may go to the regulator/ombudsman.'
  },
  'KB-024': {
    id: 'KB-024',
    title: 'What are your fees?',
    sms: 'Our fee is up to 30% + VAT on a sliding scale. The more compensation we secure, the lower percentage we charge. We investigate 3 types of claims to maximise your compensation.',
    long: 'No‑win, no‑fee with sliding scale pricing. Fee reduces as compensation increases, capped at 30% + VAT. We investigate DCA, unfair relationships, and irresponsible lending to maximise your outcome.'
  },
  // Regular Questions & Guided responses (2.2)
  'QRG-FEES': { id: 'QRG-FEES', title: 'Fees cap', sms: 'Our fee is capped at 30% + VAT. You can complain direct to your lender for free.', long: 'Our fee is capped at 30% + VAT of the compensation. DIY complaints to lenders are free; we add value by finding older cases, handling chasers, and building stronger evidence.' },
  'QRG-SCAM': { id: 'QRG-SCAM', title: 'Scam concern / Who are you?', sms: 'We’re Resolve My Claim with Prowse Phillips Law. Verify via our website, Companies House, or SRA.', long: 'We are Resolve My Claim, working with Prowse Phillips Law. You can verify us via our website, Companies House, and SRA registration.' },
  'QRG-CREDIT': { id: 'QRG-CREDIT', title: 'Credit impact', sms: 'Complaints don’t show on credit files. Keep paying as normal.', long: 'Complaints and SARs don’t appear on credit files; keep paying to avoid impact.' },
  'QRG-OPTOUT': { id: 'QRG-OPTOUT', title: 'Opt‑out', sms: 'Reply STOP to opt out.', long: 'Users can opt out by replying STOP. Always respect immediately.' },
  'QRG-DIY': { id: 'QRG-DIY', title: 'DIY route', sms: 'You can complain direct to your lender for free. We can handle it for you.', long: 'DIY route is free; we can still handle the process, find missing agreements, and manage escalations.' }
}

// Objection handling playbooks (2.3)
export type ObjectionPlaybook = {
  id: string
  title: string
  acknowledge: string
  respond: string
  confirm: string
}

export const OBJECTION_PLAYBOOKS: ObjectionPlaybook[] = [
  {
    id: 'OBJ-DIY',
    title: '“I’ll do it myself”',
    acknowledge: 'Got it, it’s your call.',
    respond: 'Many people start DIY, but find missing agreements or delays. We can locate everything and handle chasers.',
    confirm: 'Would you like me to send you the portal link so you can get moving today?'
  },
  {
    id: 'OBJ-NOT-INTERESTED',
    title: '“Not interested” / “Nah”',
    acknowledge: 'No problem.',
    respond: 'Just so I can close your file correctly — is there a specific concern or missing info holding you back?',
    confirm: 'If I can address it now, would you like to get your claim started?'
  },
  {
    id: 'OBJ-SCAM',
    title: '“Is this a scam?”',
    acknowledge: 'It’s right to check.',
    respond: 'We’re regulated and work with Prowse Phillips Law. You can verify us via SRA, Companies House, or our website.',
    confirm: 'Now that you know who we are, shall we go ahead with your claim?'
  }
]


