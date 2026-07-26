/**
 * Department membership + org-role permissions.
 * Stored on auth_users.user_metadata; MES roles remain for space access.
 */
import { AuthUserModel } from "../../models/auth-user.model.js";
import { DEPARTMENT_LABELS, normalizeDepartment, ROLE_DEFAULT_DEPARTMENT, } from "./departments.js";
export const ORG_ROLES = [
    "employee",
    "department_manager",
    "purchasing_officer",
    "purchasing_manager",
    "finance_director",
];
export const WORKFLOW_PERMISSIONS = [
    "create_request",
    "department_approve",
    "purchasing_approve",
    "finance_approve",
];
const ORG_ROLE_SET = new Set(ORG_ROLES);
const PERMISSIONS_BY_ORG_ROLE = {
    employee: ["create_request"],
    department_manager: ["create_request", "department_approve"],
    purchasing_officer: ["create_request", "purchasing_approve"],
    purchasing_manager: ["create_request", "purchasing_approve"],
    finance_director: ["create_request", "finance_approve"],
};
/** Legacy MES roles that imply org capabilities when org_roles is empty. */
const MES_ORG_ROLE_HINTS = {
    responsable_stock: ["department_manager"],
    chef_production: ["department_manager"],
    responsable_production: ["department_manager"],
    responsable_qualite: ["department_manager"],
    responsable_maintenance: ["department_manager"],
    responsable_rh: ["department_manager"],
    responsable_logistique: ["department_manager"],
    responsable_reception: ["department_manager"],
    chef_reception: ["department_manager"],
    responsable_achats: ["purchasing_officer"],
    acheteur: ["purchasing_officer"],
    directeur_achat: ["purchasing_manager"],
    daf: ["finance_director"],
    directeur_financier: ["finance_director"],
    directeur_general: ["finance_director"],
    direction: ["finance_director"],
    administrateur_systeme: [
        "department_manager",
        "purchasing_manager",
        "finance_director",
    ],
};
const unique = (values) => Array.from(new Set(values));
const readString = (value) => typeof value === "string" && value.trim() ? value.trim() : "";
const toStringArray = (value) => {
    if (Array.isArray(value)) {
        return value.map((entry) => readString(entry)).filter(Boolean);
    }
    const single = readString(value);
    return single ? [single] : [];
};
export const isOrgRole = (value) => ORG_ROLE_SET.has(value);
export const normalizeOrgRoles = (value) => unique(toStringArray(value)
    .map((role) => role.toLowerCase())
    .filter(isOrgRole));
export const normalizeDepartments = (value) => unique(toStringArray(value)
    .map((entry) => normalizeDepartment(entry))
    .filter((entry) => Boolean(entry)));
const mesRolesFromMetadata = (metadata) => unique([
    ...toStringArray(metadata.roles).map((role) => role.toLowerCase()),
    ...toStringArray(metadata.role).map((role) => role.toLowerCase()),
    ...toStringArray(metadata.domains).map((role) => role.toLowerCase()),
]);
const inferOrgRolesFromMes = (mesRoles) => unique(mesRoles.flatMap((role) => MES_ORG_ROLE_HINTS[role] ?? []));
const inferDepartmentsFromMes = (mesRoles) => unique(mesRoles
    .map((role) => ROLE_DEFAULT_DEPARTMENT[role])
    .filter((entry) => Boolean(entry)));
export const readMembershipFromMetadata = (userId, email, metadata, isActive = true) => {
    const meta = metadata && typeof metadata === "object" ? metadata : {};
    const mesRoles = mesRolesFromMetadata(meta);
    const explicitDepartments = normalizeDepartments(meta.departments);
    const departments = explicitDepartments.length > 0 ? explicitDepartments : inferDepartmentsFromMes(mesRoles);
    const primaryExplicit = normalizeDepartment(meta.primary_department);
    const primaryDepartment = primaryExplicit && departments.includes(primaryExplicit)
        ? primaryExplicit
        : departments[0] ?? null;
    const explicitOrgRoles = normalizeOrgRoles(meta.org_roles);
    const orgRoles = explicitOrgRoles.length > 0
        ? explicitOrgRoles
        : unique(["employee", ...inferOrgRolesFromMes(mesRoles)]);
    return {
        userId,
        email,
        fullName: readString(meta.full_name) || email.split("@")[0] || userId,
        isActive,
        departments,
        primaryDepartment,
        orgRoles,
        mesRoles,
    };
};
export const membershipFromActor = (actor) => {
    const id = readString(actor?.id);
    if (!id)
        return null;
    const metadata = actor?.user_metadata && typeof actor.user_metadata === "object"
        ? actor.user_metadata
        : {};
    return readMembershipFromMetadata(id, readString(actor?.email), metadata, true);
};
export const permissionsForMembership = (membership) => {
    const perms = new Set();
    for (const role of membership.orgRoles) {
        for (const permission of PERMISSIONS_BY_ORG_ROLE[role] ?? []) {
            perms.add(permission);
        }
    }
    // Broad MES admin / direction can create requests even without org_roles.
    if (membership.mesRoles.some((role) => ["admin", "administrateur_systeme", "direction"].includes(role))) {
        perms.add("create_request");
    }
    return perms;
};
export const hasPermission = (membership, permission) => permissionsForMembership(membership).has(permission);
export const canDepartmentApprove = (membership, department) => {
    if (!department)
        return false;
    if (!hasPermission(membership, "department_approve"))
        return false;
    return membership.departments.includes(department);
};
export const canPurchasingApprove = (membership, level = "purchasing_officer") => {
    if (!hasPermission(membership, "purchasing_approve"))
        return false;
    if (level === "purchasing_manager") {
        return (membership.orgRoles.includes("purchasing_manager") ||
            membership.mesRoles.includes("directeur_achat") ||
            membership.mesRoles.includes("administrateur_systeme"));
    }
    return (membership.orgRoles.includes("purchasing_officer") ||
        membership.orgRoles.includes("purchasing_manager") ||
        membership.mesRoles.includes("responsable_achats") ||
        membership.mesRoles.includes("directeur_achat") ||
        membership.mesRoles.includes("acheteur") ||
        membership.mesRoles.includes("administrateur_systeme"));
};
export const canFinanceApprove = (membership, level = "daf") => {
    if (!hasPermission(membership, "finance_approve"))
        return false;
    if (level === "general_direction") {
        return (membership.mesRoles.some((role) => ["directeur_general", "direction", "administrateur_systeme"].includes(role)) || membership.departments.includes("direction"));
    }
    return (membership.orgRoles.includes("finance_director") ||
        membership.mesRoles.some((role) => ["daf", "directeur_financier", "directeur_general", "direction", "administrateur_systeme"].includes(role)));
};
export const serializeMembership = (membership) => ({
    departments: membership.departments,
    primary_department: membership.primaryDepartment,
    org_roles: membership.orgRoles,
    department_labels: membership.departments.map((code) => DEPARTMENT_LABELS[code]),
});
const toMembership = (user) => {
    const id = readString(user.id);
    if (!id)
        return null;
    if (user.is_active === false)
        return null;
    return readMembershipFromMetadata(id, readString(user.email), user.user_metadata, true);
};
/**
 * Resolve specific people who manage a department — not everyone with a stock role.
 */
export const findDepartmentManagers = async (department) => {
    const users = (await AuthUserModel.find({ is_active: { $ne: false } })
        .select("id email is_active user_metadata")
        .lean()
        .exec());
    return users
        .map(toMembership)
        .filter((membership) => Boolean(membership))
        .filter((membership) => membership.orgRoles.includes("department_manager") &&
        membership.departments.includes(department));
};
export const findPurchasingApprovers = async (level) => {
    const users = (await AuthUserModel.find({ is_active: { $ne: false } })
        .select("id email is_active user_metadata")
        .lean()
        .exec());
    return users
        .map(toMembership)
        .filter((membership) => Boolean(membership))
        .filter((membership) => canPurchasingApprove(membership, level));
};
export const findFinanceApprovers = async (level) => {
    const users = (await AuthUserModel.find({ is_active: { $ne: false } })
        .select("id email is_active user_metadata")
        .lean()
        .exec());
    return users
        .map(toMembership)
        .filter((membership) => Boolean(membership))
        .filter((membership) => canFinanceApprove(membership, level));
};
export const loadMembershipByUserId = async (userId) => {
    if (!readString(userId))
        return null;
    const user = (await AuthUserModel.findOne({ id: userId })
        .select("id email is_active user_metadata")
        .lean()
        .exec());
    if (!user)
        return null;
    return toMembership(user);
};
