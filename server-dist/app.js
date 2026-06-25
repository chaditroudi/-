import express from "express";
import { NestFactory } from "@nestjs/core";
import { getDatabaseStatus, isDatabaseConnected } from "./db/mongoose.js";
import { requestContextMiddleware } from "./middleware/request-context.js";
import { decodeAuthToken } from "./middleware/auth.js";
import { AppExceptionFilter } from "./nest/app-exception.filter.js";
import { AppModule } from "./nest/app.module.js";
const readToken = (req) => {
    const queryToken = typeof req.query?.token === "string" ? req.query.token : "";
    if (queryToken)
        return queryToken;
    const header = String(req.headers?.authorization || "");
    if (!header.startsWith("Bearer ")) {
        return null;
    }
    return header.slice("Bearer ".length);
};
export const createApp = async () => {
    const app = await NestFactory.create(AppModule, {
        logger: ["log", "error", "warn"],
    });
    app.enableCors({ origin: true, credentials: true });
    app.use(express.json({ limit: "10mb" }));
    app.use(requestContextMiddleware);
    app.use((req, _res, next) => {
        req.auth = decodeAuthToken(readToken(req));
        next();
    });
    app.use((req, res, next) => {
        if (req.path === "/health" || req.path === "/api/health") {
            next();
            return;
        }
        if (isDatabaseConnected()) {
            next();
            return;
        }
        res.status(503).json({
            error: {
                code: "DATABASE_UNAVAILABLE",
                message: "MongoDB Atlas is not connected yet. The backend is retrying in the background.",
                details: {
                    database: getDatabaseStatus(),
                },
            },
        });
    });
    app.useGlobalFilters(new AppExceptionFilter());
    return app;
};
