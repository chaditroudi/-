import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { MASTER_DATA_ROLES, STAFF_READ_ROLES } from "../../middleware/authorization.js";
import { Roles } from "../../nest/route-metadata.js";
import { RequireAuthGuard } from "../../nest/route-guards.js";
import { CollectionsService } from "../collections/collections.service.js";

@Controller("api/materials")
@UseGuards(RequireAuthGuard)
export class MaterialsController {
  constructor(private readonly cs: CollectionsService) {}

  @Get()
  @Roles(...STAFF_READ_ROLES)
  async list() {
    const data = await this.cs.query({ table: "materials", filters: [], orderBy: { column: "name", ascending: true } });
    return { data };
  }

  @Post()
  @Roles(...MASTER_DATA_ROLES)
  async create(@Body() body: any) {
    const data = await this.cs.insert({ table: "materials", values: body });
    return { data: data[0] };
  }

  @Patch(":id")
  @Roles(...MASTER_DATA_ROLES)
  async update(@Param("id") id: string, @Body() body: any) {
    const { after } = await this.cs.update({ table: "materials", filters: [{ type: "eq", column: "id", value: id }], values: body });
    return { data: after[0] };
  }

  @Delete(":id")
  @Roles(...MASTER_DATA_ROLES)
  async remove(@Param("id") id: string) {
    const data = await this.cs.remove({ table: "materials", filters: [{ type: "eq", column: "id", value: id }] });
    return { data: data[0] };
  }
}
