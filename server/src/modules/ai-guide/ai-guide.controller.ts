import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { STAFF_READ_ROLES } from "../../middleware/authorization.js";
import { Roles } from "../../nest/route-metadata.js";
import { RequireAuthGuard } from "../../nest/route-guards.js";
import { AiGuideService } from "./ai-guide.service.js";
import type { AiGuideMessageInput } from "./ai-guide.types.js";

@Controller("api/ai-guide")
@UseGuards(RequireAuthGuard)
export class AiGuideController {
  constructor(private readonly guide: AiGuideService) {}

  @Get("status")
  @Roles(...STAFF_READ_ROLES)
  status() {
    return { data: this.guide.status() };
  }

  @Post("ask")
  @Roles(...STAFF_READ_ROLES)
  async ask(@Req() req: { auth?: { user?: { id?: string } } }, @Body() body: AiGuideMessageInput) {
    const data = await this.guide.ask(req, body ?? {});
    return { data };
  }
}
