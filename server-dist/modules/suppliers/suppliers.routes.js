import express from "express";
import { asyncHandler } from "../../core/async-handler.js";
import { requireAuth } from "../../middleware/auth.js";
import { requireRoles } from "../../middleware/authorization.js";
import { checkSupplierContractExpirations } from "../receptions/receptions.service.js";
const router = express.Router();
const BUYER_ROLES = [
    "responsable_achats",
    "acheteur",
    "admin",
    "direction",
];
// RG-F05 — trigger contract expiry check (called by cron or manually)
router.post("/check-expirations", requireAuth, requireRoles(BUYER_ROLES), asyncHandler(async (_req, res) => {
    const result = await checkSupplierContractExpirations();
    res.json(result);
}));
export default router;
