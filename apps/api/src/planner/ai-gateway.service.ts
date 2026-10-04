import { Injectable } from "@nestjs/common";
import OpenAI from "openai";

type Classification = { accountName: string; accountKey: string; category: string; tier: string };
const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"").slice(0,80) || "unknown-service";
const fallbackFor = (subject: string, domain: string): Classification => {
  const cleaned = subject.replace(/^fwd:\s*/i,"").replace(/\s+(invoice|statement|bill|purchase confirmation).*$/i,"").replace(/^welcome to\s+/i,"").trim() || domain;
  const category = /electric|water|utility|bill/i.test(subject) ? "utility" : /gym|fitness|membership/i.test(subject) ? "gym" : /bank|statement/i.test(subject) ? "bank" : /invoice|subscription|stream/i.test(subject) ? "subscription" : "other";
  return { accountName: cleaned.slice(0,100), accountKey: slug(cleaned) + ".mail.local", category, tier: category === "bank" ? "assist" : "act" };
};
@Injectable()
export class AiGatewayService {
  private client(){const token=process.env.NEON_AI_GATEWAY_TOKEN,base=process.env.NEON_AI_GATEWAY_BASE_URL;if(!token||!base)return null;return new OpenAI({apiKey:token,baseURL:`${base.replace(/\/$/,"")}/v1`});}
  async classifyMessage(subject:string,domain:string):Promise<Classification>{const fallback=fallbackFor(subject,domain);const client=this.client();if(!client)return fallback;try{const r=await client.chat.completions.create({model:process.env.NEON_AI_GATEWAY_MODEL??"gpt-5-5",response_format:{type:"json_object"},messages:[{role:"system",content:"Extract the service named in a life-admin email. Return JSON only with accountName, accountKey, category, tier. accountKey must be a stable lowercase slug plus .mail.local. category is gym,gaming,forum,subscription,bank,utility,other. tier is mock,act,assist. Banks must be assist."},{role:"user",content:`sender domain=${domain}; subject=${subject}`} ]});const parsed=JSON.parse(r.choices[0]?.message.content??"{}");return {accountName:typeof parsed.accountName==="string"?parsed.accountName:fallback.accountName,accountKey:typeof parsed.accountKey==="string"?slug(parsed.accountKey.replace(/\.mail\.local$/,""))+".mail.local":fallback.accountKey,category:typeof parsed.category==="string"?parsed.category:fallback.category,tier:parsed.category==="bank"?"assist":typeof parsed.tier==="string"?parsed.tier:fallback.tier};}catch{return fallback}}
  async explainPlan(address:string,names:string[]){const c=this.client();if(!c)return null;const r=await c.chat.completions.create({model:process.env.NEON_AI_GATEWAY_MODEL??"gpt-5-5",messages:[{role:"system",content:"Explain this approved moving plan in two concise sentences. Never authorize actions."},{role:"user",content:`Address ${address}; accounts ${names.join(", ")}`} ]});return r.choices[0]?.message.content??null;}
}