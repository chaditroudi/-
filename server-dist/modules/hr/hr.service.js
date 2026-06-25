var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Injectable } from "@nestjs/common";
import { getCollectionModel, sanitizeDocument } from "../../db/dynamic-model.js";
const Timesheets = () => getCollectionModel("timesheets");
const Employees = () => getCollectionModel("employees");
const Tasks = () => getCollectionModel("employee_tasks");
// RG-H01: overtime calculation
const computeOvertime = (hoursWorked) => {
    if (hoursWorked <= 8)
        return { regular: hoursWorked, overtime: 0, extraHours: 0 };
    if (hoursWorked <= 10)
        return { regular: 8, overtime: hoursWorked - 8, extraHours: 0 };
    return { regular: 8, overtime: 2, extraHours: hoursWorked - 10 };
};
const workDaysInMonth = (year, month) => {
    let count = 0;
    const date = new Date(year, month - 1, 1);
    while (date.getMonth() === month - 1) {
        const dow = date.getDay();
        if (dow !== 0 && dow !== 6)
            count++;
        date.setDate(date.getDate() + 1);
    }
    return count;
};
let HrService = class HrService {
    // ── Per-employee monthly summary ─────────────────────────────────────────
    async getEmployeeSummary(employeeId, year, month) {
        const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
        const endDate = `${year}-${String(month).padStart(2, "0")}-31`;
        const sheets = sanitizeDocument(await Timesheets()
            .find({ employee_id: employeeId, work_date: { $gte: startDate, $lte: endDate } })
            .lean()
            .exec());
        const employee = sanitizeDocument(await Employees().findOne({ id: employeeId }).lean().exec());
        const tasks = sanitizeDocument(await Tasks().find({ assigned_to: employeeId }).lean().exec());
        let totalHours = 0;
        let regularHours = 0;
        let overtimeHours = 0;
        let extraHours = 0;
        const workDates = new Set();
        for (const sheet of sheets) {
            const h = Number(sheet.hours_worked ?? 0);
            const breakdown = computeOvertime(h);
            totalHours += h;
            regularHours += breakdown.regular;
            overtimeHours += breakdown.overtime;
            extraHours += breakdown.extraHours;
            if (sheet.work_date)
                workDates.add(String(sheet.work_date));
        }
        const totalWorkDays = workDaysInMonth(year, month);
        const presentDays = workDates.size;
        const absentDays = Math.max(0, totalWorkDays - presentDays);
        const absenceRate = totalWorkDays > 0 ? Math.round((absentDays / totalWorkDays) * 100 * 10) / 10 : 0;
        const completedTasks = tasks.filter((t) => t.status === "completed").length;
        const pendingTasks = tasks.filter((t) => t.status === "pending" || t.status === "in_progress").length;
        const taskCompletionRate = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : null;
        // Timesheets pending approval
        const pendingApproval = sheets.filter((s) => s.status === "submitted").length;
        const approvedSheets = sheets.filter((s) => s.status === "approved").length;
        return {
            employee,
            period: { year, month, totalWorkDays },
            hours: {
                total: Math.round(totalHours * 100) / 100,
                regular: Math.round(regularHours * 100) / 100,
                overtime: Math.round(overtimeHours * 100) / 100,
                extra: Math.round(extraHours * 100) / 100,
            },
            attendance: { presentDays, absentDays, absenceRate },
            timesheets: { total: sheets.length, pendingApproval, approved: approvedSheets },
            tasks: { total: tasks.length, completed: completedTasks, pending: pendingTasks, completionRate: taskCompletionRate },
        };
    }
    // ── Team-wide monthly summary ─────────────────────────────────────────────
    async getTeamMonthlySummary(year, month) {
        const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
        const endDate = `${year}-${String(month).padStart(2, "0")}-31`;
        const allSheets = sanitizeDocument(await Timesheets()
            .find({ work_date: { $gte: startDate, $lte: endDate } })
            .lean()
            .exec());
        const allEmployees = sanitizeDocument(await Employees().find({ status: "active" }).lean().exec());
        // Group timesheets by employee
        const byEmployee = {};
        for (const sheet of allSheets) {
            const empId = String(sheet.employee_id ?? "");
            if (!byEmployee[empId])
                byEmployee[empId] = [];
            byEmployee[empId].push(sheet);
        }
        const totalWorkDays = workDaysInMonth(year, month);
        let teamTotalHours = 0;
        let teamOvertimeHours = 0;
        let teamPresentDays = 0;
        let teamAbsentDays = 0;
        const perEmployee = allEmployees.map((emp) => {
            const empId = String(emp.id ?? "");
            const sheets = byEmployee[empId] ?? [];
            let hours = 0;
            let overtime = 0;
            const dates = new Set();
            for (const s of sheets) {
                const h = Number(s.hours_worked ?? 0);
                hours += h;
                overtime += Math.max(0, h - 8);
                if (s.work_date)
                    dates.add(String(s.work_date));
            }
            const present = dates.size;
            const absent = Math.max(0, totalWorkDays - present);
            teamTotalHours += hours;
            teamOvertimeHours += overtime;
            teamPresentDays += present;
            teamAbsentDays += absent;
            return {
                employeeId: empId,
                name: `${emp.first_name ?? ""} ${emp.last_name ?? ""}`.trim(),
                department: emp.department ?? null,
                hours: Math.round(hours * 100) / 100,
                overtime: Math.round(overtime * 100) / 100,
                presentDays: present,
                absentDays: absent,
            };
        });
        const teamSize = allEmployees.length;
        const avgAbsenceRate = teamSize > 0 && totalWorkDays > 0
            ? Math.round((teamAbsentDays / (teamSize * totalWorkDays)) * 100 * 10) / 10
            : 0;
        return {
            period: { year, month, totalWorkDays },
            team: {
                size: teamSize,
                totalHours: Math.round(teamTotalHours * 100) / 100,
                totalOvertimeHours: Math.round(teamOvertimeHours * 100) / 100,
                avgAbsenceRate,
            },
            perEmployee,
        };
    }
    // ── Real-time team presence overview (today) ──────────────────────────────
    async getTeamPresenceToday() {
        const today = new Date().toISOString().slice(0, 10);
        const sheets = sanitizeDocument(await Timesheets().find({ work_date: today }).lean().exec());
        const activeEmployees = sanitizeDocument(await Employees().find({ status: "active" }).lean().exec());
        const presentIds = new Set(sheets.map((s) => String(s.employee_id ?? "")));
        const present = activeEmployees.filter((e) => presentIds.has(String(e.id)));
        const absent = activeEmployees.filter((e) => !presentIds.has(String(e.id)));
        const totalHoursToday = sheets.reduce((s, t) => s + Number(t.hours_worked ?? 0), 0);
        return {
            date: today,
            totalActive: activeEmployees.length,
            presentCount: present.length,
            absentCount: absent.length,
            totalHoursToday: Math.round(totalHoursToday * 100) / 100,
            present: present.map((e) => ({ id: e.id, name: `${e.first_name ?? ""} ${e.last_name ?? ""}`.trim(), department: e.department })),
        };
    }
    // ── Compute timesheet hours (used by controller PATCH) ────────────────────
    computeHours(startTime, endTime, breakMinutes) {
        if (!startTime || !endTime)
            return null;
        const [sh, sm] = startTime.split(":").map(Number);
        const [eh, em] = endTime.split(":").map(Number);
        const mins = eh * 60 + em - (sh * 60 + sm) - breakMinutes;
        return Math.round(Math.max(0, mins) * 100) / 6000;
    }
};
HrService = __decorate([
    Injectable()
], HrService);
export { HrService };
