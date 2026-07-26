import { describe, expect, it } from "vitest";
import { AppError } from "../../core/app-error.js";
import { approveMaintenanceRequest, cancelMaintenanceRequest, completeMaintenanceRequest, normalizeMaintenanceRequestStatus, rejectMaintenanceRequest, submitMaintenanceRequest, } from "./maintenance-request-workflow.js";
const productionEmployee = {
    id: "u-prod-emp",
    email: "prod.emp@test.tn",
    user_metadata: {
        full_name: "Prod Operator",
        departments: ["production"],
        primary_department: "production",
        org_roles: ["employee"],
        roles: ["operateur_emballage"],
    },
};
const productionManager = {
    id: "u-prod-mgr",
    email: "prod.mgr@test.tn",
    user_metadata: {
        full_name: "Prod Manager",
        departments: ["production"],
        primary_department: "production",
        org_roles: ["department_manager"],
        roles: ["responsable_production"],
    },
};
const maintenanceManager = {
    id: "u-maint-mgr",
    email: "maint.mgr@test.tn",
    user_metadata: {
        full_name: "Maintenance Manager",
        departments: ["maintenance"],
        primary_department: "maintenance",
        org_roles: ["department_manager"],
        roles: ["responsable_maintenance"],
    },
};
const daf = {
    id: "u-daf",
    email: "daf@test.tn",
    user_metadata: {
        full_name: "Directeur Financier",
        departments: ["finance"],
        primary_department: "finance",
        org_roles: ["finance_director"],
        roles: ["daf"],
    },
};
const maintenanceTech = {
    id: "u-maint-tech",
    email: "maint.tech@test.tn",
    user_metadata: {
        full_name: "Maintenance Tech",
        departments: ["maintenance"],
        primary_department: "maintenance",
        org_roles: ["employee"],
        roles: ["technicien_maintenance"],
    },
};
const baseRequest = (overrides = {}) => ({
    status: "DRAFT",
    department: "production",
    requester_id: productionEmployee.id,
    requester_name: "Prod Operator",
    equipment_name: "Convoyeur ligne 2",
    estimated_cost: 400,
    approvals: [],
    workflow_history: [],
    ...overrides,
});
describe("maintenance request workflow", () => {
    it("submits a draft to SUBMITTED and targets the requester's department manager", () => {
        const decision = submitMaintenanceRequest(baseRequest(), productionEmployee);
        expect(decision.status).toBe("SUBMITTED");
        expect(decision.notify.nextApproverLevel).toBe("dept_manager");
        expect(decision.notify.confirmation).toBe(true);
        expect(decision.workflow_history[0]).toMatchObject({
            action: "submit",
            actor_id: "u-prod-emp",
            department: "production",
        });
    });
    it("routes dept approval to MAINTENANCE_REVIEW then maintenance manager to APPROVED under threshold", () => {
        const afterDept = approveMaintenanceRequest(baseRequest({ status: "SUBMITTED" }), productionManager);
        expect(afterDept.status).toBe("MAINTENANCE_REVIEW");
        expect(afterDept.approvals[0].level).toBe("dept_manager");
        expect(afterDept.approvals[0].approved_by_id).toBe("u-prod-mgr");
        expect(afterDept.notify.nextApproverLevel).toBe("maintenance_manager");
        const afterMaint = approveMaintenanceRequest(baseRequest({
            status: "MAINTENANCE_REVIEW",
            approvals: afterDept.approvals,
            workflow_history: afterDept.workflow_history,
        }), maintenanceManager);
        expect(afterMaint.status).toBe("APPROVED");
        expect(afterMaint.notify.nextApproverLevel).toBeNull();
        expect(afterMaint.approved_by).toBe("Maintenance Manager");
    });
    it("adds a finance step when the estimated cost crosses the threshold", () => {
        const afterDept = approveMaintenanceRequest(baseRequest({ status: "SUBMITTED", estimated_cost: 8000 }), productionManager);
        expect(afterDept.status).toBe("MAINTENANCE_REVIEW");
        expect(afterDept.notify.nextApproverLevel).toBe("maintenance_manager");
        const afterMaint = approveMaintenanceRequest(baseRequest({
            status: "MAINTENANCE_REVIEW",
            estimated_cost: 8000,
            approvals: afterDept.approvals,
            workflow_history: afterDept.workflow_history,
        }), maintenanceManager);
        expect(afterMaint.status).toBe("FINANCE_APPROVAL");
        expect(afterMaint.notify.nextApproverLevel).toBe("daf");
        const afterDaf = approveMaintenanceRequest(baseRequest({
            status: "FINANCE_APPROVAL",
            estimated_cost: 8000,
            approvals: afterMaint.approvals,
            workflow_history: afterMaint.workflow_history,
        }), daf);
        expect(afterDaf.status).toBe("APPROVED");
        expect(afterDaf.notify.nextApproverLevel).toBeNull();
    });
    it("collapses the dept-manager level for maintenance-originated requests", () => {
        const decision = submitMaintenanceRequest(baseRequest({ department: "maintenance", requester_id: maintenanceTech.id }), maintenanceTech);
        expect(decision.status).toBe("MAINTENANCE_REVIEW");
        expect(decision.notify.nextApproverLevel).toBe("maintenance_manager");
    });
    it("blocks self-approval and non-managers", () => {
        const state = baseRequest({ status: "SUBMITTED" });
        expect(() => approveMaintenanceRequest(state, productionEmployee)).toThrow(AppError);
        expect(() => approveMaintenanceRequest(state, maintenanceManager)).toThrow(AppError);
    });
    it("blocks the same person signing two levels", () => {
        const state = baseRequest({
            status: "MAINTENANCE_REVIEW",
            approvals: [
                {
                    level: "dept_manager",
                    label: "Responsable du département demandeur",
                    approved_by: "Maintenance Manager",
                    approved_by_id: "u-maint-mgr",
                    approved_at: new Date().toISOString(),
                },
            ],
        });
        expect(() => approveMaintenanceRequest(state, maintenanceManager)).toThrow(AppError);
    });
    it("records rejection with the session actor identity", () => {
        const decision = rejectMaintenanceRequest(baseRequest({ status: "SUBMITTED" }), productionManager, "Budget insuffisant ce trimestre");
        expect(decision.status).toBe("REJECTED");
        expect(decision.rejection_reason).toBe("Budget insuffisant ce trimestre");
        expect(decision.transition.actor_id).toBe("u-prod-mgr");
    });
    it("lets the requester cancel and maintenance close an approved request", () => {
        const cancelled = cancelMaintenanceRequest(baseRequest({ status: "SUBMITTED" }), productionEmployee, "Plus nécessaire");
        expect(cancelled.status).toBe("CANCELLED");
        const completed = completeMaintenanceRequest(baseRequest({ status: "APPROVED" }), maintenanceTech, "Intervention réalisée");
        expect(completed.status).toBe("COMPLETED");
    });
    it("normalizes legacy statuses", () => {
        expect(normalizeMaintenanceRequestStatus("pending_approval")).toBe("SUBMITTED");
        expect(normalizeMaintenanceRequestStatus("scheduled")).toBe("APPROVED");
        expect(normalizeMaintenanceRequestStatus("done")).toBe("COMPLETED");
        expect(normalizeMaintenanceRequestStatus("")).toBe("DRAFT");
    });
});
