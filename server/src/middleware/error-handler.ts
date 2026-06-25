import { AppError } from "../core/app-error.js";
import { appendDeniedAccessAudit } from "./security-audit.js";

export const errorHandler = async (error: any, req: any, res: any, next: any) => {
  if (!error) return next();
  if (res.headersSent) return next(error);

  const statusCode = error instanceof AppError ? error.statusCode : 500;
  const code = error instanceof AppError ? error.code : "INTERNAL_SERVER_ERROR";
  const message = error instanceof AppError ? error.message : "Unexpected server error.";
  if (statusCode === 403) {
    try {
      await appendDeniedAccessAudit(req, error);
    } catch (auditError) {
      console.error("Failed to append denied-access audit log:", auditError);
    }
  }

  res.status(statusCode).json({
    error: {
      code,
      message,
      details: error instanceof AppError ? error.details : undefined,
    },
    requestId: req.requestId || null,
  });
};
