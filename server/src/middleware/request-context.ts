import { randomUUID } from "node:crypto";

export const requestContextMiddleware = (req: any, res: any, next: any) => {
  req.requestId = randomUUID();
  res.setHeader("x-request-id", req.requestId);
  next();
};
