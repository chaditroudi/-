import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { RequireAuthGuard } from "../../nest/route-guards.js";
import { CollectionsService } from "../collections/collections.service.js";

@Controller("api/customers")
@UseGuards(RequireAuthGuard)
export class CustomersController {
  constructor(private readonly cs: CollectionsService) {}

  @Get()
  async list(
    @Query("is_active") isActive?: string,
    @Query("country") country?: string,
  ) {
    const filters: any[] = [];
    if (isActive === "true")  filters.push({ type: "eq", column: "is_active", value: true });
    if (isActive === "false") filters.push({ type: "eq", column: "is_active", value: false });
    if (country) filters.push({ type: "eq", column: "country", value: country });
    const data = await this.cs.query({
      table: "customers",
      filters,
      orderBy: { column: "name", ascending: true },
    });
    return { data };
  }

  @Get(":id")
  async detail(@Param("id") id: string) {
    const rows = await this.cs.query({
      table: "customers",
      filters: [{ type: "eq", column: "id", value: id }],
      limit: 1,
    });
    return { data: rows[0] ?? null };
  }

  @Post()
  async create(@Body() body: any) {
    const data = await this.cs.insert({ table: "customers", values: body });
    return { data: data[0] };
  }

  @Patch(":id")
  async update(@Param("id") id: string, @Body() body: any) {
    const { after } = await this.cs.update({
      table: "customers",
      filters: [{ type: "eq", column: "id", value: id }],
      values: body,
    });
    return { data: after[0] };
  }

  @Delete(":id")
  async remove(@Param("id") id: string) {
    const data = await this.cs.remove({
      table: "customers",
      filters: [{ type: "eq", column: "id", value: id }],
    });
    return { data: data[0] };
  }
}
