import { APP_GUARD } from "@nestjs/core";
import { Module } from "@nestjs/common";
import { AppController } from "./app.controller.js";
import { NeonAuthGuard } from "./auth/neon-auth.guard.js";
import { PlannerService } from "./planner/planner.service.js";
import { AiGatewayService } from "./planner/ai-gateway.service.js";

@Module({
  controllers: [AppController],
  providers: [PlannerService, AiGatewayService, { provide: APP_GUARD, useClass: NeonAuthGuard }]
})
export class AppModule {}