import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { RequireAuthGuard } from "../../nest/route-guards.js";
import { CollectionsService } from "../collections/collections.service.js";

/**
 * Legacy material_receptions system (V1 reception flow).
 * Handles the older reception workflow that predates receptions_v2.
 */
@Controller("api/material-receptions")
@UseGuards(RequireAuthGuard)
export class MaterialReceptionsController {
  constructor(private readonly cs: CollectionsService) {}

  @Get()
  async list(@Query("status") status?: string, @Query("supplier_id") supplierId?: string) {
    const filters: any[] = [];
    if (status) filters.push({ type: "eq", column: "status", value: status });
    if (supplierId) filters.push({ type: "eq", column: "supplier_id", value: supplierId });
    const data = await this.cs.query({
      table: "material_receptions",
      filters,
      orderBy: { column: "received_at", ascending: false },
    });
    return { data };
  }

  @Get(":id")
  async getOne(@Param("id") id: string) {
    const rows = await this.cs.query({
      table: "material_receptions",
      filters: [{ type: "eq", column: "id", value: id }],
    });
    return { data: rows[0] ?? null };
  }

  @Post()
  async create(@Body() body: any) {
    const data = await this.cs.insert({ table: "material_receptions", values: body });
    return { data: data[0] };
  }

  @Get(":id/audit-logs")
  async auditLogs(@Param("id") id: string) {
    const data = await this.cs.query({
      table: "reception_audit_logs",
      filters: [{ type: "eq", column: "reception_id", value: id }],
      orderBy: { column: "created_at", ascending: false },
    });
    return { data };
  }

  @Post(":id/audit-logs")
  async createAuditLog(@Param("id") id: string, @Body() body: any) {
    const data = await this.cs.insert({
      table: "reception_audit_logs",
      values: { ...body, reception_id: id },
    });
    return { data: data[0] };
  }

  /**
   * Complex status update: when accepted creates a batch record;
   * when rejected/quarantine creates alerts and updates existing batch.
   */
  @Patch(":id/status")
  async updateStatus(@Param("id") id: string, @Body() body: any) {
    const {
      status,
      verified_by,
      quality_score,
      visual_appearance,
      defect_percentage,
      rejection_reason,
      document_compliance,
      origin_compliance,
      visual_compliance,
      temperature_compliance,
      humidity_compliance,
      contamination_check,
      packaging_compliance,
      qc_decision,
      quarantine_reason,
      critical_non_conformity_count,
      non_conformity_count,
    } = body as Record<string, any>;

    // Fetch current reception
    const [current] = await this.cs.query({
      table: "material_receptions",
      filters: [{ type: "eq", column: "id", value: id }],
    });

    const updateData: Record<string, unknown> = { status };
    if (["verified", "accepted", "rejected", "quarantine"].includes(status)) {
      updateData.verified_at = new Date().toISOString();
      updateData.verified_by = verified_by ?? null;
    }
    if (quality_score !== undefined) updateData.quality_score = quality_score;
    if (visual_appearance) updateData.visual_appearance = visual_appearance;
    if (defect_percentage !== undefined) updateData.defect_percentage = defect_percentage;
    if (rejection_reason && status === "rejected") updateData.rejection_reason = rejection_reason;
    if (document_compliance) updateData.document_compliance = document_compliance;
    if (origin_compliance) updateData.origin_compliance = origin_compliance;
    if (visual_compliance) updateData.visual_compliance = visual_compliance;
    if (temperature_compliance) updateData.temperature_compliance = temperature_compliance;
    if (humidity_compliance) updateData.humidity_compliance = humidity_compliance;
    if (contamination_check) updateData.contamination_check = contamination_check;
    if (packaging_compliance) updateData.packaging_compliance = packaging_compliance;
    if (qc_decision) {
      updateData.qc_decision = qc_decision;
      updateData.qc_decision_date = new Date().toISOString();
      updateData.qc_decision_by = verified_by ?? null;
    }
    if (quarantine_reason && status === "quarantine") updateData.quarantine_reason = quarantine_reason;
    if (critical_non_conformity_count !== undefined) updateData.critical_non_conformity_count = critical_non_conformity_count;
    if (non_conformity_count !== undefined) updateData.non_conformity_count = non_conformity_count;

    const { after } = await this.cs.update({
      table: "material_receptions",
      filters: [{ type: "eq", column: "id", value: id }],
      values: updateData,
    });
    const updated = after[0] as any;

    // Grade inference
    const inferGrade = (score?: number) => {
      if (!score) return null;
      if (score >= 8) return "premium";
      if (score >= 6) return "standard";
      if (score > 0) return "economy";
      return "rejected";
    };
    const grade = inferGrade(quality_score);

    if (status === "accepted") {
      const existingBatchId = (current as any)?.batch_id;
      if (!existingBatchId) {
        const [batch] = await this.cs.insert({
          table: "batches",
          values: {
            reception_id: id,
            supplier_id: (current as any)?.supplier_id ?? null,
            material_id: (current as any)?.material_id ?? null,
            origin_farm: (current as any)?.origin_farm ?? null,
            harvest_date: (current as any)?.harvest_date ?? null,
            initial_weight_kg: Number((current as any)?.quantity ?? 0),
            current_weight_kg: Number((current as any)?.quantity ?? 0),
            quality_grade: grade,
            status: "accepted",
            notes: (current as any)?.notes
              ? `Réception ${(current as any)?.reception_number}: ${(current as any)?.notes}`
              : `Réception ${(current as any)?.reception_number}`,
            created_by: verified_by ?? null,
          },
        });
        const batchRecord = batch as any;
        // Link batch to reception
        await this.cs.update({
          table: "material_receptions",
          filters: [{ type: "eq", column: "id", value: id }],
          values: { batch_id: batchRecord.id },
        });
        // Log batch movement
        this.cs.insert({
          table: "batch_movements",
          values: {
            batch_id: batchRecord.id,
            movement_type: "CREATION",
            to_status: "accepted",
            quantity_kg: Number((current as any)?.quantity ?? 0),
            performed_by: verified_by ?? null,
            reason: `Créé depuis la réception ${(current as any)?.reception_number}`,
          },
        }).catch(() => null);
        updated.batch_id = batchRecord.id;
      } else {
        this.cs.update({
          table: "batches",
          filters: [{ type: "eq", column: "id", value: existingBatchId }],
          values: { status: "accepted", quality_grade: grade, current_weight_kg: Number((current as any)?.quantity ?? 0) },
        }).catch(() => null);
      }
    }

    const existingBatchId = (current as any)?.batch_id;
    if (existingBatchId && (status === "rejected" || status === "quarantine")) {
      this.cs.update({
        table: "batches",
        filters: [{ type: "eq", column: "id", value: existingBatchId }],
        values: {
          status: status === "rejected" ? "rejected" : "quarantine",
          quality_grade: status === "rejected" ? "rejected" : grade,
        },
      }).catch(() => null);
    }

    if (status === "rejected" || status === "quarantine") {
      this.cs.insert({
        table: "alerts",
        values: {
          alert_type: status === "rejected" ? "RECEPTION_REJECTED" : "RECEPTION_QUARANTINE",
          title: status === "rejected" ? "Réception rejetée" : "Réception en quarantaine",
          message: status === "rejected"
            ? rejection_reason || `La réception ${(current as any)?.reception_number} a été rejetée.`
            : quarantine_reason || `La réception ${(current as any)?.reception_number} a été mise en quarantaine.`,
          severity: status === "rejected" ? "critical" : "warning",
        },
      }).catch(() => null);
    }

    // Audit log
    this.cs.insert({
      table: "reception_audit_logs",
      values: {
        reception_id: id,
        action: status === "rejected" ? "REJECTED" : status === "accepted" ? "ACCEPTED" : status === "quarantine" ? "QUARANTINE" : "STATUS_CHANGED",
        old_status: (current as any)?.status ?? null,
        new_status: status,
        performed_by: verified_by ?? null,
        details: { quality_score, visual_appearance, defect_percentage, rejection_reason, qc_decision, quarantine_reason, critical_non_conformity_count, non_conformity_count },
      },
    }).catch(() => null);

    return { data: updated };
  }
}
