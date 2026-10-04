export interface AgentMailMessage {
  message_id: string;
  timestamp: string;
  from: string;
  subject?: string;
}

export async function listRecentMessages(apiKey: string, inboxId: string, limit = 10): Promise<AgentMailMessage[]> {
  const response = await fetch(`https://api.agentmail.to/v0/inboxes/${encodeURIComponent(inboxId)}/messages?limit=${limit}`, {
    headers: { Authorization: `Bearer ${apiKey}` }
  });
  if (!response.ok) throw new Error(`AgentMail request failed: ${response.status}`);
  const data = await response.json() as { messages?: AgentMailMessage[] };
  return data.messages ?? [];
}

export function findConfirmation(messages: AgentMailMessage[], accountName: string): AgentMailMessage | undefined {
  return messages.find((message) => message.subject?.toLowerCase().includes(accountName.toLowerCase()));
}