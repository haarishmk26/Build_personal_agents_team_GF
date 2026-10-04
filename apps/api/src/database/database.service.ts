import { Injectable } from "@nestjs/common";
import { neon } from "@neondatabase/serverless";

export type StoredAccount = { id: string; name: string; domain: string; category: string; tier: string; last_seen_at: string | null };
const pause=(milliseconds:number)=>new Promise(resolve=>setTimeout(resolve,milliseconds));
@Injectable()
export class DatabaseService {
  private readonly sql = neon(process.env.DATABASE_URL ?? "");
  private async withRetry<T>(operation:()=>Promise<T>):Promise<T>{let lastError:unknown;for(let attempt=0;attempt<3;attempt++){try{return await operation()}catch(error){lastError=error;if(attempt<2)await pause(250*(attempt+1));}}throw lastError;}
  async ensureUser(id: string, email?: string) { await this.withRetry(()=>this.sql`insert into app_user (id,email) values (${id},${email ?? null}) on conflict (id) do update set email=coalesce(excluded.email,app_user.email)`); }
  async claimAgentMailMessage(messageId: string, userId: string, sender: string, subject: string | undefined, receivedAt: string) { const rows=await this.withRetry(()=>this.sql`insert into agentmail_message (message_id,user_id,sender,subject,received_at) values (${messageId},${userId},${sender},${subject ?? null},${receivedAt}) on conflict (message_id,user_id) do nothing returning message_id`);return rows.length>0; }
  async upsertAccount(userId: string, item: Omit<StoredAccount,"id"|"last_seen_at">) {const id=crypto.randomUUID();const rows=await this.withRetry(()=>this.sql`insert into account (id,user_id,name,domain,category,tier,stale_fields,last_seen_at) values (${id},${userId},${item.name},${item.domain},${item.category},${item.tier},${JSON.stringify(["address"])}::jsonb,now()) on conflict (user_id,domain) do update set name=excluded.name,category=excluded.category,tier=excluded.tier,last_seen_at=now() returning id,name,domain,category,tier,last_seen_at`);return rows[0];}
  async listAccounts(userId: string) { return this.withRetry(()=>this.sql`select id,name,domain,category,tier,last_seen_at from account where user_id=${userId} order by last_seen_at desc`); }
}