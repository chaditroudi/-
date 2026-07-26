import { prepareInsertDocument } from "../../db/defaults.js";
import { getCollectionModel, sanitizeDocument } from "../../db/dynamic-model.js";
import { rolesForSpace } from "../../middleware/authorization.js";
import { publishRealtimeDbChange } from "../realtime/realtime.bus.js";

/**
 * Central notification emitter.
 *
 * Every shop-floor action (reception → QC → stock → phase2 → packaging →
 * expedition) routes notifications through here so that:
 *   1. the document shape is consistent (single writer of target_roles/space),
 *   2. a 5-minute dedup window suppresses alert storms,
 *   3. the realtime db-change is published targeted at the owning actors/space.
 *
 * Exported as a plain singleton (not a Nest provider) so non-DI services can
 * import it without constructor changes — mirrors lotLifecycleService.
 */

export type NotificationSeverity = "info" | "warning" | "error" | "success";

export type EmitNotificationInput = {
  notificationType: string;
  category: string;
  title: string;
  message: string;
  severity?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  actionUrl?: string | null;
  status?: string | null;
  metadata?: Record<string, unknown> | null;
  expiresAt?: string | null;
  /** Espace (AppTab-aligned) this notification belongs to; drives role targeting. */
  space?: string | null;
  /** Explicit role targets; when omitted they are derived from space/category. */
  targetRoles?: string[];
  /** Explicit user targets (in addition to role targets). */
  targetUserIds?: string[];
  actorId?: string | null;
};

const Notifications = () => getCollectionModel("system_notifications");

// Legacy category → espace mapping so existing writers gain targeting for free.
const CATEGORY_TO_SPACE: Record<string, string> = {
  supplier: "suppliers",
  fournisseur: "suppliers",
  quality: "quality",
  qualite: "quality",
  reception: "receptions",
  phase2: "production",
  production: "production",
  packaging: "packaging",
  conditionnement: "packaging",
  stockage: "stock",
  stock: "stock",
  storage: "storage",
  logistics: "logistics",
  logistique: "logistics",
  expedition: "logistics",
  export: "export",
  purchasing: "purchasing",
  achats: "purchasing",
  system: "alerts",
};

const normalizeSeverity = (value?: string | null): NotificationSeverity => {
  const sev = String(value || "").trim().toLowerCase();
  if (sev === "critical" || sev === "fatal" || sev === "danger") return "error";
  if (sev === "warn") return "warning";
  if (sev === "info" || sev === "warning" || sev === "error" || sev === "success") {
    return sev as NotificationSeverity;
  }
  return "info";
};

const readString = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const resolveSpace = (input: EmitNotificationInput): string | null => {
  const explicit = readString(input.space);
  if (explicit) return explicit;
  const category = readString(input.category).toLowerCase();
  return CATEGORY_TO_SPACE[category] ?? null;
};

const resolveTargetRoles = (input: EmitNotificationInput, space: string | null): string[] => {
  const explicit = (input.targetRoles ?? [])
    .map((role) => String(role || "").trim().toLowerCase())
    .filter(Boolean);
  if (explicit.length > 0) return Array.from(new Set(explicit));
  return Array.from(new Set(rolesForSpace(space)));
};

export class NotificationEmitter {
  /**
   * Create + broadcast a notification. Never throws for callers on the write
   * path — failures are logged and swallowed so shop-floor writes are never
   * blocked by the notification subsystem.
   */
  async emit(input: EmitNotificationInput) {
    try {
      return await this.emitOrThrow(input);
    } catch (error) {
      console.error("[notifications] emit failed:", error);
      return null;
    }
  }

  async emitOrThrow(input: EmitNotificationInput) {
    const notificationType = readString(input.notificationType);
    const category = readString(input.category) || "system";
    const title = readString(input.title);
    const message = readString(input.message);
    const severity = normalizeSeverity(input.severity);
    const entityId = readString(input.entityId) || null;
    const space = resolveSpace(input);
    const targetRoles = resolveTargetRoles(input, space);
    const targetUserIds = Array.from(
      new Set((input.targetUserIds ?? []).map((u) => String(u || "")).filter(Boolean)),
    );

    if (!notificationType || !title || !message) {
      throw new Error("notificationType, title and message are required to emit a notification.");
    }

    // Dedup: suppress identical unread notification created in the last 5 minutes.
    const dedupSince = new Date(Date.now() - 5 * 60_000).toISOString();
    const duplicate = await Notifications()
      .findOne({
        notification_type: notificationType,
        entity_id: entityId,
        severity,
        is_read: { $ne: true },
        created_at: { $gte: dedupSince },
      })
      .lean()
      .exec();
    if (duplicate) return sanitizeDocument(duplicate) as Record<string, unknown>;

    const doc = await prepareInsertDocument("system_notifications", {
      notification_type: notificationType,
      category,
      title,
      message,
      severity,
      entity_type: readString(input.entityType) || null,
      entity_id: entityId,
      action_url: readString(input.actionUrl) || null,
      status: readString(input.status) || "ACTIVE",
      metadata: input.metadata && typeof input.metadata === "object" ? input.metadata : null,
      expires_at: readString(input.expiresAt) || null,
      is_read: false,
      space,
      target_roles: targetRoles,
      target_user_ids: targetUserIds,
    });

    await Notifications().create([doc]);
    const row = sanitizeDocument(doc) as Record<string, unknown>;

    publishRealtimeDbChange({
      type: "notification_created",
      table: "system_notifications",
      action: "INSERT",
      actorId: input.actorId || null,
      rowIds: [String(row.id || "")].filter(Boolean),
      rows: [row],
      targetRoles,
      targetUserIds,
    });

    return row;
  }
}

export const notificationEmitter = new NotificationEmitter();

/** Convenience free function for non-DI call sites. */
export const emitNotification = (input: EmitNotificationInput) => notificationEmitter.emit(input);
