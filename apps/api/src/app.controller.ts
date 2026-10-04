import { Body, Controller, Get, Post } from "@nestjs/common";
import { IsNotEmpty, IsString } from "class-validator";
import { Public } from "./auth/public.decorator.js";
import { PlannerService } from "./planner/planner.service.js";

class CreateMovePlanDto { @IsString() @IsNotEmpty() address!: string; }

@Controller()
export class AppController {
  constructor(private readonly planner: PlannerService) {}
  @Public() @Get("health") health() { return { ok: true, service: "life-event-agent-api" }; }
  @Post("v1/plans/move") createMovePlan(@Body() body: CreateMovePlanDto) { return this.planner.createMovingPlan(body.address); }
}