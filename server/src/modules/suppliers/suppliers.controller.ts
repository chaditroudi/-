import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { RequireAuthGuard } from "../../nest/route-guards.js";
import { CollectionsService } from "../collections/collections.service.js";
import { ReceptionsService } from "../receptions/receptions.service.js";

@Controller("api/suppliers")
@UseGuards(RequireAuthGuard)
export class SuppliersController {
  constructor(
    private readonly cs: CollectionsService,
    private readonly receptionsService: ReceptionsService,
  ) {}

  @Get()
  async list() {
    const data = await this.cs.query({ table: "suppliers", filters: [], orderBy: { column: "name", ascending: true } });
    return { data };
  }

  @Post()
  async create(@Body() body: any) {
    const data = await this.cs.insert({ table: "suppliers", values: body });
    return { data: data[0] };
  }

  @Patch(":id")
  async update(@Param("id") id: string, @Body() body: any) {
    const { after } = await this.cs.update({ table: "suppliers", filters: [{ type: "eq", column: "id", value: id }], values: body });
    return { data: after[0] };
  }

  @Delete(":id")
  async remove(@Param("id") id: string) {
    const data = await this.cs.remove({ table: "suppliers", filters: [{ type: "eq", column: "id", value: id }] });
    return { data: data[0] };
  }

  @Get(":id/reception-check")
  async receptionCheck(@Param("id") id: string) {
    const data = await this.cs.query({ table: "receptions", filters: [{ type: "eq", column: "supplier_id", value: id }], limit: 1 });
    return { data, hasReceptions: data.length > 0 };
  }

  @Get(":id/lots")
  async getLots(@Param("id") id: string) {
    const data = await this.cs.query({
      table: "receptions_v2",
      filters: [{ type: "eq", column: "supplier_id", value: id }],
      orderBy: { column: "actual_arrival_date", ascending: false },
    });
    return { data };
  }

  @Get(":id/orders")
  async getOrders(@Param("id") id: string) {
    const data = await this.cs.query({
      table: "purchase_orders",
      filters: [{ type: "eq", column: "supplier_id", value: id }],
      orderBy: { column: "order_date", ascending: false },
    });
    return { data };
  }

  @Get(":id/payments")
  async getPayments(@Param("id") id: string) {
    const data = await this.cs.query({
      table: "supplier_payments",
      filters: [{ type: "eq", column: "supplier_id", value: id }],
      orderBy: { column: "created_at", ascending: false },
    });
    return { data };
  }

  @Get(":id/audit-logs")
  async getAuditLogs(@Param("id") id: string) {
    const data = await this.cs.query({
      table: "audit_logs",
      filters: [
        { type: "eq", column: "entity_type", value: "supplier" },
        { type: "eq", column: "entity_id", value: id },
      ],
      orderBy: { column: "created_at", ascending: false },
    });
    return { data };
  }

  @Post(":id/audit-logs")
  async createAuditLog(@Param("id") id: string, @Body() body: any) {
    const data = await this.cs.insert({ table: "audit_logs", values: { ...body, entity_type: "supplier", entity_id: id } });
    return { data: data[0] };
  }

  @Post("check-expirations")
  async checkExpirations() {
    return this.receptionsService.checkSupplierContractExpirations();
  }
}
