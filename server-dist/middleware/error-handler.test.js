import { describe, expect, it, vi, beforeEach } from "vitest";
import { AppError } from "../core/app-error.js";
const { appendDeniedAccessAuditMock } = vi.hoisted(() => ({
    appendDeniedAccessAuditMock: vi.fn(),
}));
vi.mock("./security-audit.js", () => ({
    appendDeniedAccessAudit: appendDeniedAccessAuditMock,
}));
import { errorHandler } from "./error-handler.js";
describe("error handler denied-access audit", () => {
    beforeEach(() => {
        appendDeniedAccessAuditMock.mockReset();
    });
    it("writes denied-access audit for 403 errors", async () => {
        const req = {
            requestId: "req-1",
            method: "POST",
            path: "/api/db/update",
            body: { table: "purchase_orders" },
            auth: { user: { id: "u-1" } },
            headers: {},
        };
        const status = vi.fn().mockReturnThis();
        const json = vi.fn();
        const res = {
            headersSent: false,
            status,
            json,
        };
        const next = vi.fn();
        const error = new AppError(403, "FORBIDDEN", "Denied");
        await errorHandler(error, req, res, next);
        expect(appendDeniedAccessAuditMock).toHaveBeenCalledTimes(1);
        expect(status).toHaveBeenCalledWith(403);
        expect(json).toHaveBeenCalled();
    });
    it("does not write denied-access audit for non-403 errors", async () => {
        const req = { requestId: "req-2", headers: {} };
        const status = vi.fn().mockReturnThis();
        const json = vi.fn();
        const res = {
            headersSent: false,
            status,
            json,
        };
        const next = vi.fn();
        const error = new AppError(400, "TABLE_REQUIRED", "Table is required.");
        await errorHandler(error, req, res, next);
        expect(appendDeniedAccessAuditMock).not.toHaveBeenCalled();
        expect(status).toHaveBeenCalledWith(400);
        expect(json).toHaveBeenCalled();
    });
});
