import { Injectable } from "@nestjs/common";
import { listRecentMessages } from "@life-agent/agentmail";
import { AiGatewayService } from "../planner/ai-gateway.service.js";
import { DatabaseService } from "../database/database.service.js";
@Injectable()
export class DiscoveryService {
  constructor(private readonly db: DatabaseService, private readonly ai: AiGatewayService) {}
  async ingestAgentMail(userId:string,email?:string) {
    await this.db.ensureUser(userId,email);
    const messages=await listRecentMessages(process.env.AGENTMAIL_API_KEY!,process.env.AGENTMAIL_INBOX!,20);
    const stored=[]; for(const message of messages){
      const sender=message.from ?? ""; const claimed=await this.db.claimAgentMailMessage(message.message_id,userId,sender,message.subject,message.timestamp); if(!claimed) continue;
      const senderDomain=(sender.match(/@([^>\s]+)/)?.[1] ?? "unknown.local").toLowerCase(); const subject=message.subject ?? senderDomain;
      const classification=await this.ai.classifyMessage(subject,senderDomain);
      stored.push(await this.db.upsertAccount(userId,{name:classification.accountName,domain:classification.accountKey,category:classification.category,tier:classification.tier}));
    }
    return {messagesRead:messages.length,accounts:stored};
  }
}