import express from "express";
import helmet from "helmet";

import { NestFactory } from "@nestjs/core";

import { isAllowedOrigin, parseAllowedOrigins } from "./config/cors.js";
import { env } from "./config/env.js";
import { getDatabaseStatus, isDatabaseConnected } from "./db/mongoose.js";
import { requestContextMiddleware } from "./middleware/request-context.js";
import { resolveAuthToken } from "./middleware/auth.js";
import { auditTrailMiddleware } from "./middleware/security-audit.js";
import { AppExceptionFilter } from "./nest/app-exception.filter.js";
import { AppModule } from "./nest/app.module.js";
import { factoryConnection, runWithFactory } from "./db/factory-context.js";
import { ensureTrustIndexes } from "./db/indexes.js";
import { resolveFactoryDeviceToken } from "./db/factory-device-token.js";
import { financialVisibilityMiddleware } from "./middleware/financial-visibility.js";

const readToken = (req: any) => {
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

  const allowedOrigins = parseAllowedOrigins(process.env.CORS_ORIGINS);

  // One proxy in front of the API; this makes req.ip the real client for login throttling.
  app.getHttpAdapter().getInstance().set("trust proxy", 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

  app.enableCors({
    origin: (origin, callback) => callback(null, isAllowedOrigin(origin, allowedOrigins, env.nodeEnv)),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  app.use(requestContextMiddleware);
  // Answers depend on who asks, so nothing between here and the browser may keep one.
  app.use((req: any, res: any, next: any) => {
    if (req.path.startsWith("/api/")) res.setHeader("Cache-Control", "no-store");
    next();
  });
  app.use(async (req: any, _res: any, next: any) => {
    req.auth = await resolveAuthToken(readToken(req));
    const channel = /^\/api\/(weighbridge|ccp-sensors)\/readings$/.exec(req.path)?.[1] as "weighbridge" | "ccp-sensors" | undefined;
    req.deviceFactory = !req.auth && channel ? resolveFactoryDeviceToken(String(req.headers["x-factory-device-token"] || ""), channel) : null;
    const factory = req.auth?.factory || req.deviceFactory;
    if (!factory) return next();
    return runWithFactory(factory, async () => {
      try {
        await ensureTrustIndexes(factoryConnection().db, true);
        next();
      } catch (error) {
        console.error("Factory database initialization failed", error);
        _res.status(503).json({ error: { code: "FACTORY_DATABASE_UNAVAILABLE", message: "La base de votre usine est indisponible." } });
      }
    });
  });
  app.use(financialVisibilityMiddleware);
  // Signed-in staff send photos and logos; nothing public needs more than a small payload.
  const staffBody = express.json({ limit: "10mb" });
  const publicBody = express.json({ limit: "64kb" });
  app.use((req: any, res: any, next: any) => (req.auth ? staffBody : publicBody)(req, res, next));
  app.use(auditTrailMiddleware);
  app.use((req: any, res: any, next: any) => {
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
