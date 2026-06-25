import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { RequireAuthGuard } from "../../nest/route-guards.js";
import { getCollectionModel, sanitizeDocument } from "../../db/dynamic-model.js";
import { prepareInsertDocument } from "../../db/defaults.js";
import { notFound } from "../../core/app-error.js";

@Controller("api/flux")
@UseGuards(RequireAuthGuard)
export class FluxController {

  // ── Flux Production Runs ──────────────────────────────────────────────────────

  @Get("runs")
  async listRuns(
    @Query("flux_code") fluxCode?: string,
    @Query("status") status?: string,
    @Query("since") since?: string,
    @Query("limit") limit?: string,
    @Query("order_id") orderId?: string,
  ) {
    const filter: Record<string, unknown> = {};
    if (fluxCode) filter.flux_code = fluxCode;
    if (status) filter.status = status;
    if (since) filter.started_at = { $gte: since };
    if (orderId) filter.order_id = orderId;

    const query = getCollectionModel("flux_runs")
      .find(filter)
      .sort({ started_at: -1 });

    if (limit) query.limit(Number(limit));

    const raw = await query.lean().exec();
    return { data: sanitizeDocument(raw) };
  }

  @Post("runs")
  async createRun(@Body() body: Record<string, unknown>) {
    const doc = await prepareInsertDocument("flux_runs", body);
    await getCollectionModel("flux_runs").create([doc]);
    return { data: sanitizeDocument(doc) };
  }

  @Patch("runs/:id")
  async updateRun(@Param("id") id: string, @Body() body: Record<string, unknown>) {
    const now = new Date().toISOString();
    const update: Record<string, unknown> = { ...body, updated_at: now };
    delete update.id;
    delete update.created_at;

    const raw = await getCollectionModel("flux_runs")
      .findOneAndUpdate({ id }, { $set: update }, { returnDocument: "after" })
      .lean()
      .exec();

    if (!raw) throw notFound("FLUX_RUN_NOT_FOUND", `Flux run ${id} not found`);
    return { data: sanitizeDocument(raw) };
  }

  @Delete("runs/:id")
  async deleteRun(@Param("id") id: string) {
    const raw = await getCollectionModel("flux_runs")
      .findOneAndDelete({ id })
      .lean()
      .exec();

    if (!raw) throw notFound("FLUX_RUN_NOT_FOUND", `Flux run ${id} not found`);
    return { data: sanitizeDocument(raw) };
  }

  // ── HACCP States ──────────────────────────────────────────────────────────────

  @Get("haccp-states")
  async listHaccpStates() {
    const raw = await getCollectionModel("haccp_states")
      .find()
      .sort({ ccp_code: 1 })
      .lean()
      .exec();
    return { data: sanitizeDocument(raw) };
  }

  @Post("haccp-states")
  async upsertHaccpState(@Body() body: Record<string, unknown>) {
    const ccpCode = body.ccp_code;

    if (ccpCode) {
      const existing = await getCollectionModel("haccp_states")
        .findOne({ ccp_code: ccpCode })
        .lean()
        .exec();

      if (existing) {
        const now = new Date().toISOString();
        const update: Record<string, unknown> = { ...body, updated_at: now };
        delete update.id;
        delete update.created_at;
        const updated = await getCollectionModel("haccp_states")
          .findOneAndUpdate({ ccp_code: ccpCode }, { $set: update }, { returnDocument: "after" })
          .lean()
          .exec();
        return { data: sanitizeDocument(updated) };
      }
    }

    const doc = await prepareInsertDocument("haccp_states", body);
    await getCollectionModel("haccp_states").create([doc]);
    return { data: sanitizeDocument(doc) };
  }

  @Patch("haccp-states/:id")
  async updateHaccpState(@Param("id") id: string, @Body() body: Record<string, unknown>) {
    const now = new Date().toISOString();
    const update: Record<string, unknown> = { ...body, updated_at: now };
    delete update.id;
    delete update.created_at;

    const raw = await getCollectionModel("haccp_states")
      .findOneAndUpdate({ id }, { $set: update }, { returnDocument: "after" })
      .lean()
      .exec();

    if (!raw) throw notFound("HACCP_STATE_NOT_FOUND", `HACCP state ${id} not found`);
    return { data: sanitizeDocument(raw) };
  }
}
