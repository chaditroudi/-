import { describe, expect, it } from "vitest";

import {
  getNotificationFingerprint,
  getNotificationTarget,
  isAlertsExperience,
  isInternalNotificationTarget,
} from "@/lib/notifications";
import type { SystemNotification } from "@/types/notifications";

const buildNotification = (overrides: Partial<SystemNotification> = {}): SystemNotification => ({
  id: "notif-1",
  notification_type: "INSPECTION_DELAY",
  category: "qualite",
  title: "Inspection en retard",
  message: "Le lot attend un controle qualite.",
  severity: "warning",
  entity_type: "reception",
  entity_id: "rec-1",
  action_url: null,
  is_read: false,
  read_at: null,
  read_by: null,
  created_at: "2026-06-15T08:00:00.000Z",
  expires_at: null,
  metadata: null,
  status: null,
  ...overrides,
});

describe("notifications helpers", () => {
  it("prefers action_url when one is provided", () => {
    const target = getNotificationTarget(
      buildNotification({
        severity: "info",
        action_url: "/alerts?mode=focused",
      }),
    );

    expect(target).toBe("/alerts?mode=focused");
  });

  it("routes warning and error notifications to the alerts workspace", () => {
    expect(getNotificationTarget(buildNotification({ severity: "warning" }))).toBe("/?tab=alerts");
    expect(getNotificationTarget(buildNotification({ severity: "error" }))).toBe("/?tab=alerts");
  });

  it("routes non-critical notifications to their operational module when possible", () => {
    const target = getNotificationTarget(
      buildNotification({
        severity: "success",
        entity_type: "supplier",
        category: "suppliers",
      }),
    );

    expect(target).toBe("/?tab=suppliers");
  });

  it("creates a stable fingerprint from core notification identity", () => {
    const fingerprint = getNotificationFingerprint(
      buildNotification({
        title: " Inspection en retard ",
        severity: "error",
      }),
    );

    expect(fingerprint).toBe("INSPECTION_DELAY|reception|rec-1|error|inspection en retard");
  });

  it("detects both alerts route styles used by the app shell", () => {
    expect(isAlertsExperience("/alerts", "")).toBe(true);
    expect(isAlertsExperience("/", "?tab=alerts")).toBe(true);
    expect(isAlertsExperience("/", "?tab=receptions")).toBe(false);
  });

  it("distinguishes internal routes from external targets", () => {
    expect(isInternalNotificationTarget("/?tab=alerts")).toBe(true);
    expect(isInternalNotificationTarget("https://example.com")).toBe(false);
  });
});
