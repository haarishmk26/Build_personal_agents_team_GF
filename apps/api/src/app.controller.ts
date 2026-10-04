import { Body, Controller, Get, Post, Req } from "@nestjs/common";
import { IsNotEmpty, IsString } from "class-validator";
import { Public } from "./auth/public.decorator.js";
import { PlannerService } from "./planner/planner.service.js";
import { DiscoveryService } from "./discovery/discovery.service.js";
import { DatabaseService } from "./database/database.service.js";
class CreateMovePlanDto { @IsString() @IsNotEmpty() address!: string; }
@Controller()
export class AppController { constructor(private readonly planner:PlannerService,private readonly discovery:DiscoveryService,private readonly db:DatabaseService){}
 @Public() @Get("health") health(){return {ok:true,service:"life-event-agent-api"};}
 @Post("v1/discovery/agentmail") ingest(@Req() req:any){return this.discovery.ingestAgentMail(req.user.id,req.user.email);}
 @Get("v1/accounts") accounts(@Req() req:any){return this.db.listAccounts(req.user.id);}
 @Post("v1/plans/move") createMovePlan(@Body() body:CreateMovePlanDto){return this.planner.createMovingPlan(body.address);}
}