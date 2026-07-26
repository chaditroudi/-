import { describe, expect, it } from "vitest";
import { AppError } from "../../core/app-error.js";
import { normalizeDepartment } from "../org/departments.js";
import { canDepartmentApprove, readMembershipFromMetadata } from "../org/membership.js";
import { approveRequisitionStep, rejectRequisitionStep, submitRequisition, } from "./purchase-requisition-workflow.js";
import { normalizePurchaseRequisitionStatus, requiredApprovalLevels, } from "./workflow-types.js";
const employee = {
    id: "u-emp",
    email: "emp@test.tn",
    user_metadata: {
        full_name: "Ali Stock",
        departments: ["stock"],
        primary_department: "stock",
        org_roles: ["employee"],
        roles: ["magasinier_wms"],
    },
};
const stockManager = {
    id: "u-mgr",
    email: "mgr@test.tn",
    user_metadata: {
        full_name: "Sara Stock Mgr",
        departments: ["stock"],
        primary_department: "stock",
        org_roles: ["department_manager"],
        roles: ["responsable_stock"],
    },
};
const otherStockUser = {
    id: "u-other",
    email: "other@test.tn",
    user_metadata: {
        full_name: "Other Stock",
        departments: ["stock"],
        primary_department: "stock",
        org_roles: ["employee"],
        roles: ["magasinier_wms"],
    },
};
const buyer = {
    id: "u-buy",
    email: "buy@test.tn",
    user_metadata: {
        full_name: "Buyer",
        departments: ["purchasing"],
        primary_department: "purchasing",
        org_roles: ["purchasing_officer"],
        roles: ["responsable_achats"],
    },
};
describe("org departments", () => {
    it("normalizes Magasin / qualité aliases", () => {
        expect(normalizeDepartment("Magasin")).toBe("stock");
        expect(normalizeDepartment("qualité")).toBe("quality");
        expect(normalizeDepartment("logistique")).toBe("logistics");
    });
    it("only department managers of that department can approve", () => {
        const mgr = readMembershipFromMetadata("u-mgr", "mgr@test.tn", stockManager.user_metadata);
        const peer = readMembershipFromMetadata("u-other", "other@test.tn", otherStockUser.user_metadata);
        expect(canDepartmentApprove(mgr, "stock")).toBe(true);
        expect(canDepartmentApprove(peer, "stock")).toBe(false);
    });
});
describe("purchase requisition workflow", () => {
    it("submits draft to SUBMITTED for department manager", () => {
        const decision = submitRequisition({
            status: "DRAFT",
            department: "stock",
            requester_id: employee.id,
            requester_name: "Ali Stock",
        }, employee);
        expect(decision.status).toBe("SUBMITTED");
        expect(decision.notify.nextApproverLevel).toBe("dept_manager");
        expect(decision.notify.confirmation).toBe(true);
        expect(decision.workflow_history[0]).toMatchObject({
            action: "submit",
            actor_id: "u-emp",
            department: "stock",
        });
    });
    it("blocks self-approval and non-manager peers", () => {
        const state = {
            status: "SUBMITTED",
            department: "stock",
            requester_id: employee.id,
            requester_name: "Ali Stock",
            estimated_cost: 500,
            approvals: [],
        };
        expect(() => approveRequisitionStep(state, employee)).toThrow(AppError);
        expect(() => approveRequisitionStep(state, otherStockUser)).toThrow(AppError);
    });
    it("routes department approval into PURCHASING_REVIEW then buyer to APPROVED under threshold", () => {
        const afterDept = approveRequisitionStep({
            status: "SUBMITTED",
            department: "stock",
            requester_id: employee.id,
            requester_name: "Ali Stock",
            estimated_cost: 400,
            approvals: [],
        }, stockManager);
        expect(afterDept.status).toBe("PURCHASING_REVIEW");
        expect(afterDept.approvals[0].level).toBe("dept_manager");
        expect(afterDept.approvals[0].approved_by_id).toBe("u-mgr");
        expect(afterDept.notify.nextApproverLevel).toBe("purchasing_officer");
        const afterBuy = approveRequisitionStep({
            ...afterDept,
            status: afterDept.status,
            approvals: afterDept.approvals,
            workflow_history: afterDept.workflow_history,
            department: "stock",
            requester_id: employee.id,
            estimated_cost: 400,
        }, buyer);
        expect(afterBuy.status).toBe("APPROVED");
        expect(afterBuy.notify.nextApproverLevel).toBeNull();
    });
    it("keeps purchasing_manager step when amount crosses threshold", () => {
        const levels = requiredApprovalLevels(2500).map((step) => step.level);
        expect(levels).toEqual(["dept_manager", "purchasing_manager"]);
        const afterDept = approveRequisitionStep({
            status: "SUBMITTED",
            department: "stock",
            requester_id: employee.id,
            estimated_cost: 2500,
            approvals: [],
        }, stockManager);
        expect(afterDept.status).toBe("PURCHASING_REVIEW");
        expect(afterDept.notify.nextApproverLevel).toBe("purchasing_manager");
    });
    it("records rejection with actor identity from session", () => {
        const decision = rejectRequisitionStep({
            status: "SUBMITTED",
            department: "stock",
            requester_id: employee.id,
            approvals: [],
        }, stockManager, "Hors budget");
        expect(decision.status).toBe("REJECTED");
        expect(decision.rejection_reason).toBe("Hors budget");
        expect(decision.transition.actor_id).toBe("u-mgr");
    });
    it("normalizes legacy pending_approval", () => {
        expect(normalizePurchaseRequisitionStatus("pending_approval")).toBe("SUBMITTED");
        expect(normalizePurchaseRequisitionStatus("draft")).toBe("DRAFT");
    });
});
