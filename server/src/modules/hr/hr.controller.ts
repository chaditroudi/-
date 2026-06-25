import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { RequireAuthGuard } from "../../nest/route-guards.js";
import { CollectionsService } from "../collections/collections.service.js";
import { HrService } from "./hr.service.js";

@Controller("api")
@UseGuards(RequireAuthGuard)
export class HrController {
  constructor(
    private readonly cs: CollectionsService,
    private readonly hrService: HrService,
  ) {}

  // ── Employees ─────────────────────────────────────────────────────────────

  @Get("employees")
  async listEmployees(@Query("status") status?: string) {
    const filters: any[] = [];
    if (status) filters.push({ type: "eq", column: "status", value: status });
    const data = await this.cs.query({ table: "employees", filters, orderBy: { column: "last_name", ascending: true } });
    return { data };
  }

  @Get("employees/metrics/team")
  async getTeamPresence() {
    const data = await this.hrService.getTeamPresenceToday();
    return { data };
  }

  @Get("employees/:id/summary")
  async getEmployeeSummary(
    @Param("id") id: string,
    @Query("year") year?: string,
    @Query("month") month?: string,
  ) {
    const now = new Date();
    const y = year ? Number(year) : now.getFullYear();
    const m = month ? Number(month) : now.getMonth() + 1;
    const data = await this.hrService.getEmployeeSummary(id, y, m);
    return { data };
  }

  @Get("employees/:id")
  async getEmployee(@Param("id") id: string) {
    const rows = await this.cs.query({ table: "employees", filters: [{ type: "eq", column: "id", value: id }] });
    return { data: rows[0] ?? null };
  }

  @Post("employees")
  async createEmployee(@Body() body: any) {
    const data = await this.cs.insert({ table: "employees", values: body });
    return { data: data[0] };
  }

  @Patch("employees/:id")
  async updateEmployee(@Param("id") id: string, @Body() body: any) {
    const { after } = await this.cs.update({ table: "employees", filters: [{ type: "eq", column: "id", value: id }], values: body });
    return { data: after[0] };
  }

  @Delete("employees/:id")
  async deleteEmployee(@Param("id") id: string) {
    const data = await this.cs.remove({ table: "employees", filters: [{ type: "eq", column: "id", value: id }] });
    return { data: data[0] };
  }

  // ── Timesheets ────────────────────────────────────────────────────────────

  @Get("timesheets/monthly-summary")
  async getMonthlySummary(
    @Query("year") year?: string,
    @Query("month") month?: string,
  ) {
    const now = new Date();
    const y = year ? Number(year) : now.getFullYear();
    const m = month ? Number(month) : now.getMonth() + 1;
    const data = await this.hrService.getTeamMonthlySummary(y, m);
    return { data };
  }

  @Get("timesheets")
  async listTimesheets(
    @Query("employee_id") employeeId?: string,
    @Query("start_date") startDate?: string,
    @Query("end_date") endDate?: string,
  ) {
    const filters: any[] = [];
    if (employeeId) filters.push({ type: "eq", column: "employee_id", value: employeeId });
    if (startDate) filters.push({ type: "gte", column: "work_date", value: startDate });
    if (endDate) filters.push({ type: "lte", column: "work_date", value: endDate });
    const data = await this.cs.query({ table: "timesheets", filters, orderBy: { column: "work_date", ascending: false } });
    return { data };
  }

  @Post("timesheets")
  async createTimesheet(@Body() body: any) {
    const data = await this.cs.insert({ table: "timesheets", values: body });
    return { data: data[0] };
  }

  @Patch("timesheets/:id")
  async updateTimesheet(@Param("id") id: string, @Body() body: any) {
    const updateBody = { ...body };
    if (updateBody.start_time !== undefined || updateBody.end_time !== undefined || updateBody.break_minutes !== undefined) {
      const rows = await this.cs.query({ table: "timesheets", filters: [{ type: "eq", column: "id", value: id }] });
      const cur = rows[0] as any;
      if (cur) {
        const st = updateBody.start_time ?? cur.start_time;
        const et = updateBody.end_time !== undefined ? updateBody.end_time : cur.end_time;
        const brk = Number(updateBody.break_minutes ?? cur.break_minutes ?? 0);
        updateBody.hours_worked = this.hrService.computeHours(st, et, brk);
      }
    }
    const { after } = await this.cs.update({ table: "timesheets", filters: [{ type: "eq", column: "id", value: id }], values: updateBody });
    return { data: after[0] };
  }

  @Delete("timesheets/:id")
  async deleteTimesheet(@Param("id") id: string) {
    const data = await this.cs.remove({ table: "timesheets", filters: [{ type: "eq", column: "id", value: id }] });
    return { data: data[0] };
  }

  // ── Employee Tasks ────────────────────────────────────────────────────────

  @Get("employee-tasks")
  async listTasks(
    @Query("assigned_to") assignedTo?: string,
    @Query("status") status?: string,
  ) {
    const filters: any[] = [];
    if (assignedTo) filters.push({ type: "eq", column: "assigned_to", value: assignedTo });
    if (status) filters.push({ type: "eq", column: "status", value: status });
    const data = await this.cs.query({ table: "employee_tasks", filters, orderBy: { column: "created_at", ascending: false } });
    return { data };
  }

  @Post("employee-tasks")
  async createTask(@Body() body: any) {
    const data = await this.cs.insert({ table: "employee_tasks", values: body });
    return { data: data[0] };
  }

  @Patch("employee-tasks/:id")
  async updateTask(@Param("id") id: string, @Body() body: any) {
    const { after } = await this.cs.update({ table: "employee_tasks", filters: [{ type: "eq", column: "id", value: id }], values: body });
    return { data: after[0] };
  }

  @Delete("employee-tasks/:id")
  async deleteTask(@Param("id") id: string) {
    const data = await this.cs.remove({ table: "employee_tasks", filters: [{ type: "eq", column: "id", value: id }] });
    return { data: data[0] };
  }
}
