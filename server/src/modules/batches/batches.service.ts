import { Injectable } from "@nestjs/common";
import { badRequest, notFound } from "../../core/app-error.js";
import { getCollectionModel, sanitizeDocument } from "../../db/dynamic-model.js";
import { prepareInsertDocument } from "../../db/defaults.js";

const Batches = () => getCollectionModel("batches");
const Inspections = () => getCollectionModel("quality_inspections");
const NonConformities = () => getCollectionModel("non_conformities");
const Movements = () => getCollectionModel("batch_movements");
const Alerts = () => getCollectionModel("alerts");

// RG-Q07: grade from score
const inferGrade = (score: number): string => {
  if (score >= 85) return "EXTRA";
  if (score >= 70) return "CATEGORIE_I";
  if (score >= 50) return "CATEGORIE_II";
  return "REJETE";
};

@Injectable()
export class BatchesService {
  async createInspection(batchId: string, body: Record<string, unknown>, actor: string | null) {
    const batch = sanitizeDocument(
      await Batches().findOne({ id: batchId }).lean().exec(),
    ) as Record<string, unknown> | null;
    if (!batch) throw notFound("BATCH_NOT_FOUND", `Lot ${batchId} introuvable`);

    const doc = await prepareInsertDocument("quality_inspections", {
      ...body,
      batch_id: batchId,
      inspector_id: body.inspector_id ?? actor,
    });
    await Inspections().insertOne(doc as any);

    // Recompute batch quality_score from all inspections
    const allInspections = sanitizeDocument(
      await Inspections().find({ batch_id: batchId, score: { $ne: null } }).lean().exec(),
    ) as Array<Record<string, unknown>>;

    if (allInspections.length > 0) {
      const avgScore =
        allInspections.reduce((s, i) => s + Number(i.score ?? 0), 0) / allInspections.length;
      const roundedScore = Math.round(avgScore * 10) / 10;
      const grade = inferGrade(roundedScore);
      await Batches().updateOne(
        { id: batchId },
        { $set: { quality_score: roundedScore, quality_grade: grade, updated_at: new Date().toISOString() } },
      );
    }

    // RG-Q05: If critical NC count >= 1, auto-create quarantine alert
    const criticalNCs = await NonConformities().countDocuments({
      batch_id: batchId,
      severity: "CRITICAL",
      status: "OPEN",
    });
    if (criticalNCs >= 1 && batch.status === "pending") {
      const alertDoc = await prepareInsertDocument("alerts", {
        alert_type: "BATCH_CRITICAL_NC",
        title: "Non-conformité critique détectée",
        message: `Lot ${batch.batch_number} — ${criticalNCs} NC critique(s) ouverte(s)`,
        severity: "critical",
        batch_id: batchId,
      });
      Alerts().insertOne(alertDoc as any).catch(() => null);
    }

    return sanitizeDocument(await Inspections().findOne({ id: doc.id }).lean().exec()) as Record<string, unknown>;
  }

  // ── Create non-conformity with auto-alert ─────────────────────────────────

  async createNonConformity(batchId: string, body: Record<string, unknown>, actor: string | null) {
    const batch = sanitizeDocument(
      await Batches().findOne({ id: batchId }).lean().exec(),
    ) as Record<string, unknown> | null;
    if (!batch) throw notFound("BATCH_NOT_FOUND", `Lot ${batchId} introuvable`);

    const doc = await prepareInsertDocument("non_conformities", {
      ...body,
      batch_id: batchId,
      detected_by: body.detected_by ?? actor,
    });
    await NonConformities().insertOne(doc as any);

    // CRITICAL severity triggers alert immediately
    if (String(body.severity ?? "").toUpperCase() === "CRITICAL") {
      const alertDoc = await prepareInsertDocument("alerts", {
        alert_type: "BATCH_CRITICAL_NC",
        title: "NC critique",
        message: String(body.description ?? `NC critique sur lot ${batch.batch_number}`),
        severity: "critical",
        batch_id: batchId,
      });
      Alerts().insertOne(alertDoc as any).catch(() => null);
    }

    return sanitizeDocument(await NonConformities().findOne({ id: doc.id }).lean().exec()) as Record<string, unknown>;
  }

  // ── Summary KPIs ──────────────────────────────────────────────────────────

  async getSummary() {
    const today = new Date().toISOString().slice(0, 10);
    const batches = sanitizeDocument(
      await Batches().find({}).lean().exec(),
    ) as Array<Record<string, unknown>>;

    const pending = batches.filter((b) => b.status === "pending").length;
    const inQC = batches.filter((b) => b.status === "in_qc").length;
    const accepted = batches.filter((b) => b.status === "accepted").length;
    const rejected = batches.filter((b) => b.status === "rejected").length;
    const quarantine = batches.filter((b) => b.status === "quarantine").length;
    const decidedToday = batches.filter(
      (b) =>
        b.qc_decision_date && String(b.qc_decision_date).startsWith(today),
    ).length;
    const openNCs = await NonConformities().countDocuments({ status: "OPEN" });

    return { pending, inQC, accepted, rejected, quarantine, decidedToday, openNCs };
  }
}
