import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { COMMERCIAL_ROLES, STAFF_READ_ROLES } from "../../middleware/authorization.js";
import { Roles } from "../../nest/route-metadata.js";
import { RequireAuthGuard } from "../../nest/route-guards.js";
import { CollectionsService } from "../collections/collections.service.js";

@Controller("api/export-orders")
@UseGuards(RequireAuthGuard)
export class ExportOrdersController {
  constructor(private readonly cs: CollectionsService) {}

  @Get()
  @Roles(...STAFF_READ_ROLES)
  async list(@Query("status") status?: string, @Query("customer_country") country?: string) {
    const filters: any[] = [];
    if (status) filters.push({ type: "eq", column: "status", value: status });
    if (country) filters.push({ type: "eq", column: "customer_country", value: country });
    const data = await this.cs.query({
      table: "export_orders",
      filters,
      orderBy: { column: "created_at", ascending: false },
    });
    return { data };
  }

  @Get(":id")
  @Roles(...STAFF_READ_ROLES)
  async detail(@Param("id") id: string) {
    const rows = await this.cs.query({
      table: "export_orders",
      filters: [{ type: "eq", column: "id", value: id }],
      limit: 1,
    });
    return { data: rows[0] ?? null };
  }

  @Post()
  @Roles(...COMMERCIAL_ROLES)
  async create(@Body() body: any) {
    const data = await this.cs.insert({ table: "export_orders", values: body });
    return { data: data[0] };
  }

  @Patch(":id")
  @Roles(...COMMERCIAL_ROLES)
  async update(@Param("id") id: string, @Body() body: any) {
    const { after } = await this.cs.update({
      table: "export_orders",
      filters: [{ type: "eq", column: "id", value: id }],
      values: body,
    });
    return { data: after[0] };
  }

  @Delete(":id")
  @Roles(...COMMERCIAL_ROLES)
  async remove(@Param("id") id: string) {
    const data = await this.cs.remove({
      table: "export_orders",
      filters: [{ type: "eq", column: "id", value: id }],
    });
    return { data: data[0] };
  }
}
