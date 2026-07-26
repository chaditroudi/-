import { describe, expect, it } from "vitest";
import { ROLE_DEFAULT_DEPARTMENT, normalizeDepartment } from "./departments.js";
import { canDepartmentApprove, readMembershipFromMetadata, } from "./membership.js";
describe("membership backfill inference", () => {
    it("maps magasinier_wms and domains to stock", () => {
        const membership = readMembershipFromMetadata("u1", "moez@test.local", {
            full_name: "Moez",
            roles: ["magasinier_wms"],
            domains: ["magasin"],
        });
        expect(membership.departments).toContain("stock");
        expect(membership.primaryDepartment).toBe("stock");
        expect(membership.orgRoles).toContain("employee");
        expect(canDepartmentApprove(membership, "stock")).toBe(false);
    });
    it("promotes responsable_stock to department_manager of stock", () => {
        const membership = readMembershipFromMetadata("u2", "sami@test.local", {
            full_name: "Sami",
            roles: ["responsable_stock"],
        });
        expect(membership.primaryDepartment).toBe("stock");
        expect(membership.orgRoles).toContain("department_manager");
        expect(canDepartmentApprove(membership, "stock")).toBe(true);
        expect(canDepartmentApprove(membership, "production")).toBe(false);
    });
    it("keeps explicit membership over MES inference", () => {
        const membership = readMembershipFromMetadata("u3", "x@test.local", {
            roles: ["magasinier_wms"],
            departments: ["production", "stock"],
            primary_department: "production",
            org_roles: ["employee"],
        });
        expect(membership.departments).toEqual(["production", "stock"]);
        expect(membership.primaryDepartment).toBe("production");
        expect(membership.orgRoles).toEqual(["employee"]);
    });
    it("covers seed actor roles in ROLE_DEFAULT_DEPARTMENT", () => {
        for (const role of [
            "operateur_reception",
            "magasinier_wms",
            "responsable_achats",
            "directeur_achat",
            "inspecteur_qualite",
        ]) {
            expect(ROLE_DEFAULT_DEPARTMENT[role], role).toBeTruthy();
            expect(normalizeDepartment(ROLE_DEFAULT_DEPARTMENT[role])).toBe(ROLE_DEFAULT_DEPARTMENT[role]);
        }
    });
});
