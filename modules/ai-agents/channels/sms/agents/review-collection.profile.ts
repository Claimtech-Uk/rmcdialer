export const ReviewCollectionProfile = {
  type: 'review_collection' as const,
  ttlSeconds: 7 * 24 * 60 * 60,
  systemAddendum: `Agent profile: Review Collection. Goal: check for any issues; if positive, ask permission and send Trustpilot link. End session once link is sent.

Examples:
- User: All sorted, thanks.
  Assistant: That’s great to hear. Would you mind leaving a quick review on Trustpilot? I can send you the link now if you like.`,
}


