import { Injectable } from "@nestjs/common";
import { badRequest, notFound } from "../../core/app-error.js";
import { getCollectionModel, sanitizeDocument } from "../../db/dynamic-model.js";
import { prepareInsertDocument } from "../../db/defaults.js";

const Batches = () => getCollectionModel("batches");
const Inspections = () => getCollectionModel("quality_inspections");
const NonConformities = () => getCollectionModel("non_conformities");
const Movements = () => getCollectionModel("batch_movements");
const Alerts = () => getCollectionModel("alerts");
const ReceptionLots = () => getCollectionModel("reception_lots");

// RG-Q07: grade from score
const inferGrade = (score: number): string => {
  if (score >= 85) return "EXTRA";
  if (score >= 70) return "CATEGORIE_I";
  if (score >= 50) return "CATEGORIE_II";
  return "REJETE";
};

@Injectable()
export class BatchesService {
  // ── QC Decision ───────────────────────────────────────────────────────────

  async decideQC(batchId: string, body: Record<string, unknown>, actor: string | null) {
    const batch = sanitizeDocument(
      await Batches().findOne({ id: batchId }).lean().exec(),
    ) as Record<string, unknown> | null;
    if (!batch) throw notFound("BATCH_NOT_FOUND", `Lot ${batchId} introuvable`);

    if (batch.qc_decision) {
      throw badRequest("QC_ALREADY_DECIDED", `Décision QC déjà enregistrée : ${batch.qc_decision}`);
    }

    const decision = String(body.decision ?? "").toUpperCase();
    if (!["ACCEPT", "REJECT", "QUARANTINE"].includes(decision)) {
      throw badRequest("INVALID_DECISION", "Décision doit être ACCEPT, REJECT ou QUARANTINE");
    }

    const score = body.quality_score !== undefined ? Number(body.quality_score) : null;
    const grade = score !== null ? inferGrade(score) : (batch.quality_grade as string | null);
    const now = new Date().toISOString();

    const batchUpdate: Record<string, unknown> = {
      qc_decision: decision,
      qc_decision_date: now,
      qc_decision_by: actor,
      updated_at: now,
    };
    if (score !== null) {
      batchUpdate.quality_score = score;
      batchUpdate.quality_grade = grade;
    }

    let newStatus: string;
    let alertSeverity: string | null = null;
    let alertMsg: string | null = null;

    if (decision === "ACCEPT") {
      newStatus = "accepted";
    } else if (decision === "REJECT") {
      newStatus = "rejected";
      batchUpdate.rejection_reason = body.rejection_reason ?? null;
      alertSeverity = "critical";
      alertMsg = String(body.rejection_reason ?? `Lot ${batch.batch_number} rejeté`);
    } else {
      newStatus = "quarantine";
      batchUpdate.quarantine_reason = body.quarantine_reason ?? null;
      alertSeverity = "warning";
      alertMsg = String(body.quarantine_reason ?? `Lot ${batch.batch_number} mis en quarantaine`);
    }

    batchUpdate.status = newStatus;
    await Batches().updateOne({ id: batchId }, { $set: batchUpdate });

    // Propagate to linked reception_lot
    if (batch.reception_id) {
      const lotStatus =
        decision === "ACCEPT"
          ? "STOCK_LIBERE"
          : decision === "REJECT"
            ? "STOCK_REJETE"
            : "EN_QUARANTAINE";
      await ReceptionLots().updateMany(
        { reception_id: batch.reception_id as string },
        { $set: { stock_status: lotStatus, updated_at: now } },
      );
    }

    // Log batch movement
    const movDoc = await prepareInsertDocument("batch_movements", {
      batch_id: batchId,
      movement_type: "QC_DECISION",
      from_status: batch.status,
      to_status: newStatus,
      quantity_kg: batch.current_weight_kg ?? batch.initial_weight_kg ?? 0,
      performed_by: actor,
      reason: decision === "ACCEPT" ? "Accepté QC" : alertMsg,
    });
    Batches(); // keep model warm
    Movements().insertOne(movDoc as any).catch(() => null);

    // Create alert for reject/quarantine
    if (alertSeverity && alertMsg) {
      const alertDoc = await prepareInsertDocument("alerts", {
        alert_type: decision === "REJECT" ? "BATCH_REJECTED" : "BATCH_QUARANTINE",
        title: decision === "REJECT" ? "Lot rejeté" : "Lot en quarantaine",
        message: alertMsg,
        severity: alertSeverity,
        batch_id: batchId,
      });
      Alerts().insertOne(alertDoc as any).catch(() => null);
    }

    return sanitizeDocument(await Batches().findOne({ id: batchId }).lean().exec()) as Record<string, unknown>;
  }

  // ── Create inspection with auto-scoring ───────────────────────────────────

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
