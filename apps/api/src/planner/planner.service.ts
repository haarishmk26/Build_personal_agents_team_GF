import { Injectable } from "@nestjs/common";
import { DEFAULT_RULES, planMovingEvent, SEEDED_ACCOUNTS } from "@life-agent/core";
import { AiGatewayService } from "./ai-gateway.service.js";

@Injectable()
export class PlannerService {
  constructor(private readonly aiGateway: AiGatewayService) {}
  async createMovingPlan(address: string) {
    const items = planMovingEvent(SEEDED_ACCOUNTS, DEFAULT_RULES);
    const explanation = await this.aiGateway.explainPlan(address, items.map((item) => item.account.name));
    return { event: { type: "move", newAddress: address }, items, explanation, safety: "Tiers and user rules are enforced by code before any action." };
  }
}