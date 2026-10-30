import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { COA_WRITE_ROLES, STAFF_READ_ROLES } from "../../middleware/authorization.js";
import { Roles } from "../../nest/route-metadata.js";
import { RequireAuthGuard } from "../../nest/route-guards.js";
import { CollectionsService } from "../collections/collections.service.js";

@Controller("api/coa-documents")
@UseGuards(RequireAuthGuard)
export class COADocumentsController {
  constructor(private readonly cs: CollectionsService) {}

  @Get()
  @Roles(...STAFF_READ_ROLES)
  async list(@Query("batch_id") batchId?: string) {
    const filters: any[] = [];
    if (batchId) filters.push({ type: "eq", column: "batch_id", value: batchId });
    const data = await this.cs.query({
      table: "coa_documents",
      filters,
      orderBy: { column: "created_at", ascending: false },
    });
    return { data };
  }

  @Get(":id")
  @Roles(...STAFF_READ_ROLES)
  async detail(@Param("id") id: string) {
    const rows = await this.cs.query({
      table: "coa_documents",
      filters: [{ type: "eq", column: "id", value: id }],
      limit: 1,
    });
    return { data: rows[0] ?? null };
  }

  @Post()
  @Roles(...COA_WRITE_ROLES)
  async create(@Body() body: any) {
    const data = await this.cs.insert({ table: "coa_documents", values: body });
    return { data: data[0] };
  }

  @Patch(":id")
  @Roles(...COA_WRITE_ROLES)
  async update(@Param("id") id: string, @Body() body: any) {
    const { after } = await this.cs.update({
      table: "coa_documents",
      filters: [{ type: "eq", column: "id", value: id }],
      values: body,
    });
    return { data: after[0] };
  }

  @Delete(":id")
  @Roles(...COA_WRITE_ROLES)
  async remove(@Param("id") id: string) {
    const data = await this.cs.remove({
      table: "coa_documents",
      filters: [{ type: "eq", column: "id", value: id }],
    });
    return { data: data[0] };
  }
}
