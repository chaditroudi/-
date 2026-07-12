import { Injectable } from "@nestjs/common";

import { getCollectionModel } from "../../db/dynamic-model.js";

const col = () => getCollectionModel("system_audit_logs");
const receptionCol = () => getCollectionModel("reception_audit_logs_v2");

// Piste d'audit réception historique (schéma propre) → forme AuditLog commune.
const mapReceptionLog = (doc: any) => ({
  id: doc.id ?? String(doc._id ?? ""),
  event_type: "DATA_CHANGE",
  severity: "info",
  action: doc.action ?? "UPDATE",
  module: "Réception",
  table: doc.entity_type === "LOT" ? "reception_lots" : "receptions_v2",
  message: `${doc.action ?? "ACTION"} — Réception${doc.entity_id ? ` (${doc.entity_id})` : ""}`,
  user_id: null,
  user_email: null,
  user_name: doc.performed_by ?? null,
  user_roles: [],
  ip_address: null,
  affected_ids: doc.entity_id ? [doc.entity_id] : [],
  after_snapshot: doc.new_state ? [doc.new_state] : null,
  before_snapshot: doc.previous_state ? [doc.previous_state] : null,
  created_at: doc.created_at ?? null,
  performed_by: doc.performed_by ?? null,
  performed_at: doc.performed_at ?? doc.created_at ?? null,
  entity_type: doc.entity_type ?? null,
});

@Injectable()
export class AuditService {
  async getLogs(opts: {
    limit?: number;
    offset?: number;
    userId?: string;
    module?: string;
    eventType?: string;
    table?: string;
    from?: string;
    to?: string;
  }) {
    const { limit = 100, offset = 0, userId, module: mod, eventType, table, from, to } = opts;

    const filter: Record<string, any> = {};
    if (userId) filter.user_id = userId;
    if (mod) filter.module = mod;
    if (eventType) filter.event_type = eventType;
    if (table) filter.table = table;
    if (from || to) {
      filter.created_at = {};
      if (from) filter.created_at.$gte = from;
      if (to) filter.created_at.$lte = to;
    }

    const docs = await col()
      .find(filter)
      .sort({ created_at: -1 })
      .skip(offset)
      .limit(limit)
      .lean()
      .exec();

    const total = await col().countDocuments(filter).exec();

    // Fusionner la piste réception historique quand aucun filtre spécifique
    // system_audit_logs n'est demandé (ou quand le module Réception est visé).
    const includeReceptionTrail = !userId && !eventType && !table && (!mod || mod === "Réception");
    if (!includeReceptionTrail) {
      return { logs: docs, total };
    }

    const receptionFilter: Record<string, any> = {};
    if (from || to) {
      receptionFilter.created_at = {};
      if (from) receptionFilter.created_at.$gte = from;
      if (to) receptionFilter.created_at.$lte = to;
    }

    const receptionDocs = await receptionCol()
      .find(receptionFilter)
      .sort({ created_at: -1 })
      .limit(limit)
      .lean()
      .exec();
    const receptionTotal = await receptionCol().countDocuments(receptionFilter).exec();

    const merged = [...(docs as any[]), ...(receptionDocs as any[]).map(mapReceptionLog)]
      .sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")))
      .slice(0, limit);

    return { logs: merged, total: total + receptionTotal };
  }

  async getStats(from?: string) {
    const since = from ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const filter = { created_at: { $gte: since } };

    const all = await col().find(filter).lean().exec();

    const byModule: Record<string, number> = {};
    const byUser: Record<string, { email: string; name: string | null; count: number }> = {};
    const byAction: Record<string, number> = {};
    const byHour: Record<string, number> = {};
    let securityEvents = 0;

    for (const log of all as any[]) {
      const mod = log.module ?? "Système";
      byModule[mod] = (byModule[mod] || 0) + 1;

      if (log.user_id) {
        if (!byUser[log.user_id]) byUser[log.user_id] = { email: log.user_email ?? "", name: log.user_name ?? null, count: 0 };
        byUser[log.user_id].count++;
      }

      const action = log.action ?? "UNKNOWN";
      byAction[action] = (byAction[action] || 0) + 1;

      if (log.created_at) {
        const hour = String(log.created_at).slice(0, 13);
        byHour[hour] = (byHour[hour] || 0) + 1;
      }

      if (log.event_type === "SECURITY_DENIED" || log.event_type === "AUTH_FAILED") {
        securityEvents++;
      }
    }

    const now = new Date();
    const timeline = Array.from({ length: 24 }, (_, i) => {
      const h = new Date(now.getTime() - (23 - i) * 3600_000);
      const key = h.toISOString().slice(0, 13);
      return { hour: `${String(h.getHours()).padStart(2, "0")}h`, count: byHour[key] ?? 0 };
    });

    const topUsers = Object.entries(byUser)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([id, v]) => ({ id, ...v }));

    const topModules = Object.entries(byModule)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([module, count]) => ({ module, count }));

    return {
      total: all.length,
      securityEvents,
      byAction,
      topUsers,
      topModules,
      timeline,
    };
  }
}

export const auditService = new AuditService();
