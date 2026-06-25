import { Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards } from "@nestjs/common";
import { Roles } from "../../nest/route-metadata.js";
import { RequireAuthGuard, RolesGuard } from "../../nest/route-guards.js";
import { DocumentPrintsService } from "./document-prints.service.js";

const DOC_ROLES = [
  "responsable_reception", "chef_reception", "operateur_reception",
  "responsable_qualite", "inspecteur_qualite", "responsable_achats",
  "responsable_production", "directeur_usine", "administrateur_systeme",
];

@Controller("api/document-prints")
@UseGuards(RequireAuthGuard, RolesGuard)
export class DocumentPrintsController {
  constructor(private readonly service: DocumentPrintsService) {}

  @Get()
  @Roles(...DOC_ROLES)
  async getBySource(
    @Query("source_id") source_id: string,
    @Query("document_type") document_type?: string,
  ) {
    if (document_type) {
      const data = await this.service.findBySourceAndType(source_id, document_type);
      return { data };
    }
    const data = await this.service.listBySource(source_id);
    return { data };
  }

  @Post()
  @Roles(...DOC_ROLES)
  async upsert(@Body() body: Record<string, unknown>, @Req() req: any) {
    const actor = req.user?.sub || req.user?.id || "system";
    const data = await this.service.upsert(body, actor);
    return { data };
  }

  @Put(":id")
  @Roles(...DOC_ROLES)
  async update(@Param("id") id: string, @Body() body: Record<string, unknown>, @Req() req: any) {
    const actor = req.user?.sub || req.user?.id || "system";
    const data = await this.service.update(id, body, actor);
    return { data };
  }
}
