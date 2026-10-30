import { Module } from "@nestjs/common";
import { TrustModule } from "../trust/trust.module.js";
import { AiGuideContextService } from "./ai-guide-context.service.js";
import { AiGuideController } from "./ai-guide.controller.js";
import { AiGuideService } from "./ai-guide.service.js";
import { AiGuideToolsService } from "./ai-guide-tools.service.js";

@Module({
  imports: [TrustModule],
  controllers: [AiGuideController],
  providers: [AiGuideToolsService, AiGuideContextService, AiGuideService],
  exports: [AiGuideService],
})
export class AiGuideModule {}
