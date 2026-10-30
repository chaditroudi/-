/**
 * Navigation whitelist and workflow → screen mapping.
 *
 * The MES shell is tab-based (`/?tab=<tab>`), so every navigation target the AI
 * Guide may return is one of these strings. The response validator rejects
 * anything outside this set, so the LLM can never invent a route.
 */

import {
  LOGISTICS_ROLES,
  PRODUCTION_ROLES,
  QUALITY_ROLES,
  RECEPTION_ROLES,
  STOCK_ROLES,
} from "../../../middleware/authorization.js";
import type { AiGuideLanguage } from "../ai-guide.types.js";

export type MultiLang = Record<AiGuideLanguage, string>;

export const navTarget = (tab: string) => `/?tab=${tab}`;

/** Whitelisted navigation targets. Nothing else may be returned. */
export const AI_GUIDE_NAV_TARGETS: ReadonlySet<string> = new Set(
  [
    "home",
    "scan",
    "receptions",
    "quality",
    "storage",
    "production",
    "packaging",
    "logistics",
    "purchasing",
    "maintenance",
    "analytics",
    "alerts",
  ].map(navTarget),
);

export const isWhitelistedNavTarget = (target: string | null | undefined): boolean =>
  Boolean(target) && AI_GUIDE_NAV_TARGETS.has(String(target));

/**
 * For each golden-thread stage that a lot can advance *into*, the screen where
 * the responsible operator performs it and the roles allowed to do so. Derived
 * from the same role constants the backend guards use.
 */
export interface StageAction {
  stage: string;
  tab: string;
  roles: string[];
  label: MultiLang;
}

export const STAGE_ACTIONS: Record<string, StageAction> = {
  SUPPLIER_INTAKE: {
    stage: "SUPPLIER_INTAKE",
    tab: "receptions",
    roles: [...RECEPTION_ROLES],
    label: { ar: "فتح الاستقبال", fr: "Ouvrir la réception", en: "Open reception" },
  },
  WEIGHED: {
    stage: "WEIGHED",
    tab: "receptions",
    roles: [...RECEPTION_ROLES],
    label: { ar: "الوزن في الاستقبال", fr: "Peser à la réception", en: "Weigh at reception" },
  },
  QC_DECIDED: {
    stage: "QC_DECIDED",
    tab: "quality",
    roles: [...QUALITY_ROLES],
    label: { ar: "فتح مراقبة الجودة", fr: "Ouvrir le contrôle qualité", en: "Open QC release" },
  },
  COLD_STORE: {
    stage: "COLD_STORE",
    tab: "storage",
    roles: [...STOCK_ROLES],
    label: { ar: "فتح التخزين البارد", fr: "Ouvrir le stockage", en: "Open cold storage" },
  },
  FUMIGATION_CCP: {
    stage: "FUMIGATION_CCP",
    tab: "production",
    roles: Array.from(new Set([...PRODUCTION_ROLES, ...QUALITY_ROLES])),
    label: { ar: "فتح التبخير CCP", fr: "Ouvrir la fumigation CCP", en: "Open fumigation CCP" },
  },
  TRIAGE: {
    stage: "TRIAGE",
    tab: "production",
    roles: Array.from(new Set([...PRODUCTION_ROLES, ...QUALITY_ROLES])),
    label: { ar: "فتح الفرز", fr: "Ouvrir le triage", en: "Open triage" },
  },
  PACKED: {
    stage: "PACKED",
    tab: "packaging",
    roles: Array.from(new Set([...PRODUCTION_ROLES, ...STOCK_ROLES])),
    label: { ar: "فتح التعليب", fr: "Ouvrir le conditionnement", en: "Open packaging" },
  },
  SHIPPED: {
    stage: "SHIPPED",
    tab: "logistics",
    roles: Array.from(new Set([...STOCK_ROLES, ...LOGISTICS_ROLES])),
    label: { ar: "فتح الشحن", fr: "Ouvrir l'expédition", en: "Open shipment" },
  },
};
