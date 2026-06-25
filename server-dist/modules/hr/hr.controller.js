var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { RequireAuthGuard } from "../../nest/route-guards.js";
import { CollectionsService } from "../collections/collections.service.js";
import { HrService } from "./hr.service.js";
let HrController = class HrController {
    cs;
    hrService;
    constructor(cs, hrService) {
        this.cs = cs;
        this.hrService = hrService;
    }
    // ── Employees ─────────────────────────────────────────────────────────────
    async listEmployees(status) {
        const filters = [];
        if (status)
            filters.push({ type: "eq", column: "status", value: status });
        const data = await this.cs.query({ table: "employees", filters, orderBy: { column: "last_name", ascending: true } });
        return { data };
    }
    async getTeamPresence() {
        const data = await this.hrService.getTeamPresenceToday();
        return { data };
    }
    async getEmployeeSummary(id, year, month) {
        const now = new Date();
        const y = year ? Number(year) : now.getFullYear();
        const m = month ? Number(month) : now.getMonth() + 1;
        const data = await this.hrService.getEmployeeSummary(id, y, m);
        return { data };
    }
    async getEmployee(id) {
        const rows = await this.cs.query({ table: "employees", filters: [{ type: "eq", column: "id", value: id }] });
        return { data: rows[0] ?? null };
    }
    async createEmployee(body) {
        const data = await this.cs.insert({ table: "employees", values: body });
        return { data: data[0] };
    }
    async updateEmployee(id, body) {
        const { after } = await this.cs.update({ table: "employees", filters: [{ type: "eq", column: "id", value: id }], values: body });
        return { data: after[0] };
    }
    async deleteEmployee(id) {
        const data = await this.cs.remove({ table: "employees", filters: [{ type: "eq", column: "id", value: id }] });
        return { data: data[0] };
    }
    // ── Timesheets ────────────────────────────────────────────────────────────
    async getMonthlySummary(year, month) {
        const now = new Date();
        const y = year ? Number(year) : now.getFullYear();
        const m = month ? Number(month) : now.getMonth() + 1;
        const data = await this.hrService.getTeamMonthlySummary(y, m);
        return { data };
    }
    async listTimesheets(employeeId, startDate, endDate) {
        const filters = [];
        if (employeeId)
            filters.push({ type: "eq", column: "employee_id", value: employeeId });
        if (startDate)
            filters.push({ type: "gte", column: "work_date", value: startDate });
        if (endDate)
            filters.push({ type: "lte", column: "work_date", value: endDate });
        const data = await this.cs.query({ table: "timesheets", filters, orderBy: { column: "work_date", ascending: false } });
        return { data };
    }
    async createTimesheet(body) {
        const data = await this.cs.insert({ table: "timesheets", values: body });
        return { data: data[0] };
    }
    async updateTimesheet(id, body) {
        const updateBody = { ...body };
        if (updateBody.start_time !== undefined || updateBody.end_time !== undefined || updateBody.break_minutes !== undefined) {
            const rows = await this.cs.query({ table: "timesheets", filters: [{ type: "eq", column: "id", value: id }] });
            const cur = rows[0];
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
    async deleteTimesheet(id) {
        const data = await this.cs.remove({ table: "timesheets", filters: [{ type: "eq", column: "id", value: id }] });
        return { data: data[0] };
    }
    // ── Employee Tasks ────────────────────────────────────────────────────────
    async listTasks(assignedTo, status) {
        const filters = [];
        if (assignedTo)
            filters.push({ type: "eq", column: "assigned_to", value: assignedTo });
        if (status)
            filters.push({ type: "eq", column: "status", value: status });
        const data = await this.cs.query({ table: "employee_tasks", filters, orderBy: { column: "created_at", ascending: false } });
        return { data };
    }
    async createTask(body) {
        const data = await this.cs.insert({ table: "employee_tasks", values: body });
        return { data: data[0] };
    }
    async updateTask(id, body) {
        const { after } = await this.cs.update({ table: "employee_tasks", filters: [{ type: "eq", column: "id", value: id }], values: body });
        return { data: after[0] };
    }
    async deleteTask(id) {
        const data = await this.cs.remove({ table: "employee_tasks", filters: [{ type: "eq", column: "id", value: id }] });
        return { data: data[0] };
    }
};
__decorate([
    Get("employees"),
    __param(0, Query("status")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], HrController.prototype, "listEmployees", null);
__decorate([
    Get("employees/metrics/team"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], HrController.prototype, "getTeamPresence", null);
__decorate([
    Get("employees/:id/summary"),
    __param(0, Param("id")),
    __param(1, Query("year")),
    __param(2, Query("month")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], HrController.prototype, "getEmployeeSummary", null);
__decorate([
    Get("employees/:id"),
    __param(0, Param("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], HrController.prototype, "getEmployee", null);
__decorate([
    Post("employees"),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], HrController.prototype, "createEmployee", null);
__decorate([
    Patch("employees/:id"),
    __param(0, Param("id")),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], HrController.prototype, "updateEmployee", null);
__decorate([
    Delete("employees/:id"),
    __param(0, Param("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], HrController.prototype, "deleteEmployee", null);
__decorate([
    Get("timesheets/monthly-summary"),
    __param(0, Query("year")),
    __param(1, Query("month")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], HrController.prototype, "getMonthlySummary", null);
__decorate([
    Get("timesheets"),
    __param(0, Query("employee_id")),
    __param(1, Query("start_date")),
    __param(2, Query("end_date")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], HrController.prototype, "listTimesheets", null);
__decorate([
    Post("timesheets"),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], HrController.prototype, "createTimesheet", null);
__decorate([
    Patch("timesheets/:id"),
    __param(0, Param("id")),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], HrController.prototype, "updateTimesheet", null);
__decorate([
    Delete("timesheets/:id"),
    __param(0, Param("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], HrController.prototype, "deleteTimesheet", null);
__decorate([
    Get("employee-tasks"),
    __param(0, Query("assigned_to")),
    __param(1, Query("status")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], HrController.prototype, "listTasks", null);
__decorate([
    Post("employee-tasks"),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], HrController.prototype, "createTask", null);
__decorate([
    Patch("employee-tasks/:id"),
    __param(0, Param("id")),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], HrController.prototype, "updateTask", null);
__decorate([
    Delete("employee-tasks/:id"),
    __param(0, Param("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], HrController.prototype, "deleteTask", null);
HrController = __decorate([
    Controller("api"),
    UseGuards(RequireAuthGuard),
    __metadata("design:paramtypes", [CollectionsService,
        HrService])
], HrController);
export { HrController };
