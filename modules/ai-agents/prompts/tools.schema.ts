export const TOOL_SCHEMA_PROMPT = `When you need to perform an action, respond ONLY with compact JSON matching this schema:
{
  "tool": "send_sms | send_magic_link | get_user_context | none",
  "args": { "key": "value" }
}

Rules:
- send_sms: { phoneNumber: string, text: string }
- send_magic_link: { userId: number, phoneNumber: string, linkType: "claimPortal" | "documentUpload" }
- get_user_context: { phoneNumber: string }
- none: { text: string } // Use when no tool is needed; provide the SMS reply in 'text'

Do not add commentary outside the JSON.
`;


