import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from "@nestjs/common";

import { AppError } from "../core/app-error.js";
import { appendDeniedAccessAudit } from "../middleware/security-audit.js";

@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  async catch(error: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const req = http.getRequest();
    const res = http.getResponse();

    if (res.headersSent) {
      return;
    }

    // Les HttpException NestJS (404 route inconnue, 400 validation…) gardent
    // leur statut au lieu d'être aplaties en 500.
    const statusCode = error instanceof AppError
      ? error.statusCode
      : error instanceof HttpException
        ? error.getStatus()
        : 500;
    const code = error instanceof AppError
      ? error.code
      : error instanceof HttpException
        ? error.constructor.name.replace(/Exception$/, "").replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase()
        : "INTERNAL_SERVER_ERROR";
    const message = error instanceof AppError || error instanceof HttpException
      ? error.message
      : "Unexpected server error.";

    if (statusCode >= 500) {
      console.error(
        `[500] ${req.method} ${req.originalUrl || req.path} (req ${req.requestId || "?"})`,
        error instanceof Error ? error.stack : error,
      );
    }

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
  }
}
