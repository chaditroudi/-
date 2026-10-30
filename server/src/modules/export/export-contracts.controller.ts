import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { COMMERCIAL_ROLES, STAFF_READ_ROLES } from "../../middleware/authorization.js";
import { Roles } from "../../nest/route-metadata.js";
import { RequireAuthGuard } from "../../nest/route-guards.js";
import { CollectionsService } from "../collections/collections.service.js";

@Controller("api/export-contracts")
@UseGuards(RequireAuthGuard)
export class ExportContractsController {
  constructor(private readonly cs: CollectionsService) {}

  @Get()
  @Roles(...STAFF_READ_ROLES)
  async list(@Query("order_id") orderId?: string, @Query("status") status?: string) {
    const filters: any[] = [];
    if (orderId) filters.push({ type: "eq", column: "order_id", value: orderId });
    if (status)  filters.push({ type: "eq", column: "status",   value: status });
    const data = await this.cs.query({
      table: "export_contracts",
      filters,
      orderBy: { column: "created_at", ascending: false },
    });
    return { data };
  }

  @Get(":id")
  @Roles(...STAFF_READ_ROLES)
  async detail(@Param("id") id: string) {
    const rows = await this.cs.query({
      table: "export_contracts",
      filters: [{ type: "eq", column: "id", value: id }],
      limit: 1,
    });
    return { data: rows[0] ?? null };
  }

  @Post()
  @Roles(...COMMERCIAL_ROLES)
  async create(@Body() body: any) {
    const data = await this.cs.insert({ table: "export_contracts", values: body });
    return { data: data[0] };
  }

  @Patch(":id")
  @Roles(...COMMERCIAL_ROLES)
  async update(@Param("id") id: string, @Body() body: any) {
    const { after } = await this.cs.update({
      table: "export_contracts",
      filters: [{ type: "eq", column: "id", value: id }],
      values: body,
    });
    return { data: after[0] };
  }
}
