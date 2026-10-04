import { Injectable } from "@nestjs/common";
import OpenAI from "openai";

@Injectable()
export class AiGatewayService {
  async explainPlan(address: string, accountNames: string[]): Promise<string | null> {
    const token = process.env.NEON_AI_GATEWAY_TOKEN;
    const baseUrl = process.env.NEON_AI_GATEWAY_BASE_URL;
    if (!token || !baseUrl) return null;
    const client = new OpenAI({ apiKey: token, baseURL: `${baseUrl.replace(/\/$/, "")}/v1` });
    const completion = await client.chat.completions.create({
      model: process.env.NEON_AI_GATEWAY_MODEL ?? "gpt-5-mini",
      messages: [
        { role: "system", content: "You explain a moving-address plan in two concise sentences. Never override safety tiers or authorization rules." },
        { role: "user", content: `New address: ${address}. Selected accounts: ${accountNames.join(", ")}.` }
      ]
    });
    return completion.choices[0]?.message?.content ?? null;
  }
}