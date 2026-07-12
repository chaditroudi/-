var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Catch, HttpException } from "@nestjs/common";
import { AppError } from "../core/app-error.js";
import { appendDeniedAccessAudit } from "../middleware/security-audit.js";
let AppExceptionFilter = class AppExceptionFilter {
    async catch(error, host) {
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
            console.error(`[500] ${req.method} ${req.originalUrl || req.path} (req ${req.requestId || "?"})`, error instanceof Error ? error.stack : error);
        }
        if (statusCode === 403) {
            try {
                await appendDeniedAccessAudit(req, error);
            }
            catch (auditError) {
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
};
AppExceptionFilter = __decorate([
    Catch()
], AppExceptionFilter);
export { AppExceptionFilter };
