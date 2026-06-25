import { Injectable } from "@nestjs/common";

import { badRequest, notFound } from "../../core/app-error.js";
import { prepareInsertDocument } from "../../db/defaults.js";
import { getCollectionModel, sanitizeDocument } from "../../db/dynamic-model.js";

type NotificationRow = Record<string, unknown> & {
  id?: string;
  is_read?: boolean;
  read_at?: string | null;
  read_by?: string | null;
  created_at?: string;
};

type NotificationAuditRow = Record<string, unknown> & {
  id?: string;
  entity_type?: string | null;
  entity_id?: string | null;
  action?: string | null;
  action_label?: string | null;
  old_state?: Record<string, unknown> | null;
  new_state?: Record<string, unknown> | null;
  changed_fields?: string[] | null;
  performed_by?: string | null;
  performed_at?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string;
  message?: string | null;
  module?: string | null;
  table?: string | null;
  before_snapshot?: Record<string, unknown>[] | null;
  after_snapshot?: Record<string, unknown>[] | null;
  affected_ids?: string[] | null;
  user_name?: string | null;
  user_email?: string | null;
  policy_context?: Record<string, unknown> | null;
  ip_address?: string | null;
  user_agent?: string | null;
  session_id?: string | null;
};

type ActorContext = {
  id?: string | null;
  email?: string | null;
  name?: string | null;
};

type CreateAuditLogInput = {
  entityType?: string;
  entityId?: string;
  action?: string;
  actionLabel?: string;
  performedBy?: string;
  metadata?: Record<string, unknown> | null;
  oldState?: Record<string, unknown> | null;
  newState?: Record<string, unknown> | null;
  changedFields?: string[] | null;
  module?: string | null;
  table?: string | null;
  eventType?: string | null;
};

type CreateNotificationInput = {
  notificationType?: string;
  category?: string;
  title?: string;
  message?: string;
  severity?: "info" | "warning" | "error" | "success" | string;
  entityType?: string | null;
  entityId?: string | null;
  actionUrl?: string | null;
  status?: string | null;
  metadata?: Record<string, unknown> | null;
  expiresAt?: string | null;
};

const Notifications = () => getCollectionModel("system_notifications");
const AuditLogs = () => getCollectionModel("system_audit_logs");

const nowIso = () => new Date().toISOString();

const readString = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
};

const toObject = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const firstObject = (value: unknown): Record<string, unknown> | null => {
  if (!Array.isArray(value)) return null;
  for (const entry of value) {
    const objectValue = toObject(entry);
    if (objectValue) return objectValue;
  }
  return null;
};

const normalizeMetadata = (value: unknown): Record<string, unknown> | null => {
  const objectValue = toObject(value);
  return objectValue ? sanitizeDocument(objectValue) as Record<string, unknown> : null;
};

const inferEntityType = (row: NotificationAuditRow) => {
  const explicit = readString(row.entity_type).toUpperCase();
  if (explicit) return explicit;

  const haystack = `${readString(row.module)} ${readString(row.table)}`.toLowerCase();
  if (haystack.includes("reception")) return "RECEPTION";
  if (haystack.includes("quality") || haystack.includes("qualit") || haystack.includes("qc")) return "QUALITY";
  if (
    haystack.includes("fumigation")
    || haystack.includes("hydration")
    || haystack.includes("triage")
    || haystack.includes("cleaning")
    || haystack.includes("packaging")
    || haystack.includes("production")
    || haystack.includes("batch")
  ) {
    return "PRODUCTION";
  }
  if (
    haystack.includes("stock")
    || haystack.includes("storage")
    || haystack.includes("inventory")
  ) {
    return "STOCK";
  }
  if (
    haystack.includes("purchase")
    || haystack.includes("supplier")
    || haystack.includes("fournisseur")
    || haystack.includes("achat")
    || haystack.includes("material")
  ) {
    return "PURCHASING";
  }
  return "SYSTEM";
};

const diffChangedFields = (
  oldState: Record<string, unknown> | null,
  newState: Record<string, unknown> | null,
) => {
  if (!oldState || !newState) return null;

  const keys = Array.from(new Set([...Object.keys(oldState), ...Object.keys(newState)]));
  const changed = keys.filter((key) => JSON.stringify(oldState[key]) !== JSON.stringify(newState[key]));
  return changed.length > 0 ? changed : null;
};

const mapAuditLog = (rawRow: NotificationAuditRow) => {
  const oldState = toObject(rawRow.old_state) || firstObject(rawRow.before_snapshot) || null;
  const newState = toObject(rawRow.new_state) || firstObject(rawRow.after_snapshot) || null;
  const changedFields = Array.isArray(rawRow.changed_fields)
    ? rawRow.changed_fields.map((field) => String(field || "")).filter(Boolean)
    : diffChangedFields(oldState, newState);
  const metadata = normalizeMetadata(rawRow.metadata) || normalizeMetadata(rawRow.policy_context);

  return {
    id: String(rawRow.id || ""),
    entity_type: inferEntityType(rawRow),
    entity_id: readString(rawRow.entity_id, Array.isArray(rawRow.affected_ids) ? rawRow.affected_ids[0] : null),
    action: readString(rawRow.action).toUpperCase() || "INFO",
    action_label: readString(rawRow.action_label, rawRow.message, rawRow.action) || "System event",
    old_state: oldState,
    new_state: newState,
    changed_fields: changedFields,
    performed_by: readString(rawRow.performed_by, rawRow.user_name, rawRow.user_email) || "system",
    performed_at: readString(rawRow.performed_at, rawRow.created_at) || nowIso(),
    ip_address: readString(rawRow.ip_address) || null,
    user_agent: readString(rawRow.user_agent) || null,
    session_id: readString(rawRow.session_id) || null,
    metadata,
  };
};

@Injectable()
export class NotificationsService {
  async listNotifications(opts?: { unreadOnly?: boolean; limit?: number }) {
    const filter = opts?.unreadOnly ? { is_read: { $ne: true } } : {};
    const limit = Math.min(Math.max(Number(opts?.limit ?? 200), 1), 500);

    return sanitizeDocument(
      await Notifications().find(filter).sort({ created_at: -1 }).limit(limit).lean().exec(),
    ) as NotificationRow[];
  }

  async getStats() {
    const now = new Date();
    const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    const [all, unread, last24h, auditLogs24h] = await Promise.all([
      Notifications().find({}).lean().exec(),
      Notifications().find({ is_read: { $ne: true } }).lean().exec(),
      Notifications().find({ created_at: { $gte: since24h } }).lean().exec(),
      AuditLogs().countDocuments({
        $or: [{ performed_at: { $gte: since24h } }, { created_at: { $gte: since24h } }],
      }).exec(),
    ]);

    const byCategory: Record<string, number> = {};
    const bySeverity = { error: 0, warning: 0, info: 0, success: 0 };

    for (const n of last24h) {
      const cat = String((n as any).category || "SYSTEM");
      byCategory[cat] = (byCategory[cat] || 0) + 1;
      const sev = String((n as any).severity || "info") as keyof typeof bySeverity;
      if (sev in bySeverity) bySeverity[sev]++;
    }

    const readNotifs = (all as any[]).filter((n) => n.is_read && n.read_at && n.created_at);
    let avgAckTimeMinutes: number | null = null;
    if (readNotifs.length > 0) {
      const totalMs = readNotifs.reduce((sum: number, n: any) => {
        return sum + (new Date(n.read_at).getTime() - new Date(n.created_at).getTime());
      }, 0);
      avgAckTimeMinutes = Math.round(totalMs / readNotifs.length / 60_000);
    }

    return {
      total: all.length,
      unread: unread.length,
      last24h: last24h.length,
      byCategory,
      bySeverity,
      avgAckTimeMinutes,
      resolutionRate: all.length > 0 ? Math.round((readNotifs.length / all.length) * 100) : 0,
      auditLogsLast24h: auditLogs24h,
    };
  }

  async createNotification(payload: CreateNotificationInput) {
    const notificationType = readString(payload.notificationType);
    const category = readString(payload.category);
    const title = readString(payload.title);
    const message = readString(payload.message);
    const severity = readString(payload.severity).toLowerCase();

    if (!notificationType) {
      throw badRequest("NOTIFICATION_TYPE_REQUIRED", "notificationType est requis.");
    }
    if (!category) {
      throw badRequest("NOTIFICATION_CATEGORY_REQUIRED", "category est requis.");
    }
    if (!title) {
      throw badRequest("NOTIFICATION_TITLE_REQUIRED", "title est requis.");
    }
    if (!message) {
      throw badRequest("NOTIFICATION_MESSAGE_REQUIRED", "message est requis.");
    }
    if (!["info", "warning", "error", "success"].includes(severity)) {
      throw badRequest("NOTIFICATION_SEVERITY_INVALID", "severity doit etre info, warning, error ou success.");
    }

    // Deduplication: suppress identical unread notification created in last 5 minutes
    const dedupSince = new Date(Date.now() - 5 * 60_000).toISOString();
    const duplicate = await Notifications().findOne({
      notification_type: notificationType,
      entity_id: readString(payload.entityId) || null,
      severity,
      is_read: { $ne: true },
      created_at: { $gte: dedupSince },
    }).lean().exec();
    if (duplicate) return sanitizeDocument(duplicate) as NotificationRow;

    const doc = await prepareInsertDocument("system_notifications", {
      notification_type: notificationType,
      category,
      title,
      message,
      severity,
      entity_type: readString(payload.entityType) || null,
      entity_id: readString(payload.entityId) || null,
      action_url: readString(payload.actionUrl) || null,
      status: readString(payload.status) || "ACTIVE",
      metadata: normalizeMetadata(payload.metadata),
      expires_at: readString(payload.expiresAt) || null,
      is_read: false,
    });

    await Notifications().create([doc]);
    return sanitizeDocument(doc) as NotificationRow;
  }

  async markNotificationRead(id: string, readBy: string) {
    const existing = sanitizeDocument(await Notifications().findOne({ id }).lean().exec()) as NotificationRow | null;
    if (!existing) throw notFound("NOTIFICATION_NOT_FOUND", "Notification introuvable.");

    const readAt = nowIso();
    await Notifications().updateOne(
      { id },
      {
        $set: {
          is_read: true,
          read_at: readAt,
          read_by: readString(readBy) || "operator",
          updated_at: readAt,
        },
      },
    ).exec();

    return sanitizeDocument(await Notifications().findOne({ id }).lean().exec()) as NotificationRow | null;
  }

  async markAllNotificationsRead(readBy: string) {
    const unread = sanitizeDocument(
      await Notifications().find({ is_read: { $ne: true } }).sort({ created_at: -1 }).lean().exec(),
    ) as NotificationRow[];
    const ids = unread.map((row) => String(row.id || "")).filter(Boolean);

    if (ids.length === 0) {
      return {
        ids: [] as string[],
        notifications: [] as NotificationRow[],
      };
    }

    const readAt = nowIso();
    await Notifications().updateMany(
      { id: { $in: ids } },
      {
        $set: {
          is_read: true,
          read_at: readAt,
          read_by: readString(readBy) || "operator",
          updated_at: readAt,
        },
      },
    ).exec();

    return {
      ids,
      notifications: sanitizeDocument(
        await Notifications().find({ id: { $in: ids } }).lean().exec(),
      ) as NotificationRow[],
    };
  }

  async listAuditLogs(opts?: { entityType?: string; entityId?: string; limit?: number }) {
    const filter: Record<string, unknown> = {};
    const entityType = readString(opts?.entityType);
    const entityId = readString(opts?.entityId);

    if (entityType) {
      filter.entity_type = new RegExp(`^${entityType}$`, "i");
    }
    if (entityId) {
      filter.entity_id = entityId;
    }

    const limit = Math.min(Math.max(Number(opts?.limit ?? 100), 1), 500);
    const rows = sanitizeDocument(
      await AuditLogs().find(filter).sort({ performed_at: -1, created_at: -1 }).limit(limit).lean().exec(),
    ) as NotificationAuditRow[];

    return rows.map(mapAuditLog);
  }

  async createAuditLog(payload: CreateAuditLogInput, actor?: ActorContext) {
    const entityType = readString(payload.entityType).toUpperCase();
    const entityId = readString(payload.entityId);
    const action = readString(payload.action).toUpperCase();

    if (!entityType) {
      throw badRequest("AUDIT_ENTITY_TYPE_REQUIRED", "entityType est requis.");
    }
    if (!entityId) {
      throw badRequest("AUDIT_ENTITY_ID_REQUIRED", "entityId est requis.");
    }
    if (!action) {
      throw badRequest("AUDIT_ACTION_REQUIRED", "action est requis.");
    }

    const oldState = normalizeMetadata(payload.oldState);
    const newState = normalizeMetadata(payload.newState);
    const changedFields = Array.isArray(payload.changedFields)
      ? payload.changedFields.map((field) => String(field || "")).filter(Boolean)
      : diffChangedFields(oldState, newState);
    const performedAt = nowIso();

    const doc = await prepareInsertDocument("system_audit_logs", {
      entity_type: entityType,
      entity_id: entityId,
      action,
      action_label: readString(payload.actionLabel, payload.action) || action,
      old_state: oldState,
      new_state: newState,
      changed_fields: changedFields,
      performed_by: readString(payload.performedBy, actor?.email, actor?.name) || "operator",
      performed_at: performedAt,
      metadata: normalizeMetadata(payload.metadata),
      module: readString(payload.module) || null,
      table: readString(payload.table) || null,
      event_type: readString(payload.eventType) || "USER_ACTION",
      message: readString(payload.actionLabel, payload.action) || action,
      user_id: readString(actor?.id) || null,
      user_email: readString(actor?.email) || null,
      user_name: readString(actor?.name) || null,
    });

    await AuditLogs().create([doc]);
    return mapAuditLog(sanitizeDocument(doc) as NotificationAuditRow);
  }
}
