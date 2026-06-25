import { Controller, Get, Req, Res } from "@nestjs/common";

import { getDatabaseStatus, isDatabaseConnected } from "../db/mongoose.js";

const buildHealthPayload = () => {
  const database = getDatabaseStatus();
  const ok = isDatabaseConnected();

  return {
    statusCode: ok ? 200 : 503,
    body: {
      ok,
      status: ok ? "ready" : "database_unavailable",
      hint: ok ? undefined : "Add the Docker host public IP to MongoDB Atlas Network Access.",
      database,
    },
  };
};

@Controller()
export class AppController {
  @Get("health")
  health(@Req() _req: any, @Res() res: any) {
    const payload = buildHealthPayload();
    res.status(payload.statusCode).json(payload.body);
  }

  @Get("api/health")
  apiHealth(@Req() _req: any, @Res() res: any) {
    const payload = buildHealthPayload();
    res.status(payload.statusCode).json(payload.body);
  }
}
