import { Injectable } from "@nestjs/common";

import { getCollectionModel } from "../../db/dynamic-model.js";
  
const col = () => getCollectionModel("system_audit_logs");

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

    return { logs: docs, total };
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
