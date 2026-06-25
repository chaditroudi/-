import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { RequireAuthGuard } from "../../nest/route-guards.js";
import { CollectionsService } from "../collections/collections.service.js";

@Controller("api/materials")
@UseGuards(RequireAuthGuard)
export class MaterialsController {
  constructor(private readonly cs: CollectionsService) {}

  @Get()
  async list() {
    const data = await this.cs.query({ table: "materials", filters: [], orderBy: { column: "name", ascending: true } });
    return { data };
  }

  @Post()
  async create(@Body() body: any) {
    const data = await this.cs.insert({ table: "materials", values: body });
    return { data: data[0] };
  }

  @Patch(":id")
  async update(@Param("id") id: string, @Body() body: any) {
    const { after } = await this.cs.update({ table: "materials", filters: [{ type: "eq", column: "id", value: id }], values: body });
    return { data: after[0] };
  }

  @Delete(":id")
  async remove(@Param("id") id: string) {
    const data = await this.cs.remove({ table: "materials", filters: [{ type: "eq", column: "id", value: id }] });
    return { data: data[0] };
  }
}
