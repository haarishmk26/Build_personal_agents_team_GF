import { APP_GUARD } from "@nestjs/core";
import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { AppController } from "./app.controller.js";
import { NeonAuthGuard } from "./auth/neon-auth.guard.js";
import { DatabaseService } from "./database/database.service.js";
import { DiscoveryService } from "./discovery/discovery.service.js";
import { AgentMailPoller } from "./discovery/agentmail.poller.js";
import { RealtimeGateway } from "./realtime/realtime.gateway.js";
import { PlannerService } from "./planner/planner.service.js";
import { AiGatewayService } from "./planner/ai-gateway.service.js";
@Module({imports:[ScheduleModule.forRoot()],controllers:[AppController],providers:[DatabaseService,DiscoveryService,AgentMailPoller,RealtimeGateway,PlannerService,AiGatewayService,{provide:APP_GUARD,useClass:NeonAuthGuard}]})
export class AppModule {}