import { forbidden } from "../../core/app-error.js";
import { getCollectionModel, sanitizeDocument } from "../../db/dynamic-model.js";
import { getRequestRoles, hasAnyRole, STAFF_READ_ROLES, SUPPLIER_PORTAL_ROLE } from "../../middleware/authorization.js";

type Row = Record<string, unknown>;

const Suppliers = () => getCollectionModel("suppliers");

const normalizeEmail = (value: unknown) => String(value ?? "").trim().toLowerCase();

const belongsTo = (req: any, supplier: Row | null | undefined) => {
  const email = normalizeEmail(req.auth?.user?.email);
  return Boolean(email) && normalizeEmail(supplier?.email) === email;
};

export const isSupplierPortalUser = (req: any) =>
  getRequestRoles(req).includes(SUPPLIER_PORTAL_ROLE) && !hasAnyRole(req, STAFF_READ_ROLES);

export const filterOwnSuppliers = <T extends Row>(req: any, suppliers: T[]) =>
  isSupplierPortalUser(req) ? suppliers.filter((supplier) => belongsTo(req, supplier)) : suppliers;

export const assertOwnSupplier = async (req: any, supplierId: string) => {
  if (!isSupplierPortalUser(req)) return;
  const supplier = sanitizeDocument(await Suppliers().findOne({ id: supplierId }).lean().exec()) as Row | null;
  if (!belongsTo(req, supplier)) throw forbidden("You do not have access to this supplier.");
};

export const ownSupplierId = async (req: any) => {
  const suppliers = sanitizeDocument(await Suppliers().find({}).lean().exec()) as Row[];
  const own = suppliers.find((supplier) => belongsTo(req, supplier));
  return own ? String(own.id) : null;
};
