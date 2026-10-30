/**
 * Screen and field help. Static, multilingual, cache-friendly. Only the single
 * relevant definition is handed to the LLM (or returned directly as fallback).
 */

import type { AiGuideLanguage } from "../ai-guide.types.js";
import type { MultiLang } from "./navigation.js";

const p = (ar: string, fr: string, en: string): MultiLang => ({ ar, fr, en });

export interface AiGuideScreenHelp {
  id: string;
  summary: MultiLang;
  fields: Record<string, MultiLang>;
}

export const AI_GUIDE_SCREENS: Record<string, AiGuideScreenHelp> = {
  receptions: {
    id: "receptions",
    summary: p(
      "شاشة استقبال الشحنات ووزنها وإنشاء اللوطات.",
      "Écran de réception, pesée et création des lots.",
      "Reception, weighing, and lot creation screen.",
    ),
    fields: {
      manufacturing_route: p(
        "المسار الصناعي؛ Premium يتطلب التبخير قبل الفرز.",
        "Route industrielle ; Premium exige la fumigation avant triage.",
        "Manufacturing route; Premium requires fumigation before triage.",
      ),
    },
  },
  quality: {
    id: "quality",
    summary: p(
      "شاشة مراقبة الجودة والقرار: تحرير أو حجر أو رفض.",
      "Écran QC et décision : libérer, quarantaine ou rejet.",
      "QC screen and decision: release, quarantine, or reject.",
    ),
    fields: {
      measured_value: p(
        "القيمة المقاسة في المخبر فقط، لا معدل الأرضية.",
        "Valeur mesurée en labo uniquement, pas la moyenne atelier.",
        "Lab-measured value only, not the floor average.",
      ),
    },
  },
  storage: {
    id: "storage",
    summary: p(
      "شاشة التخزين البارد وحركات المواقع.",
      "Écran de stockage froid et mouvements d'emplacement.",
      "Cold storage and location movement screen.",
    ),
    fields: {
      capacity_kg: p(
        "سعة الموقع بالكيلوغرام؛ يُرفض النقل إن تجاوزها.",
        "Capacité kg de l'emplacement ; mouvement refusé si dépassée.",
        "Location kilogram capacity; a move is refused if it exceeds it.",
      ),
    },
  },
  packaging: {
    id: "packaging",
    summary: p(
      "شاشة التعليب والمنصّات وختم SSCC.",
      "Écran de conditionnement, palettes et scellage SSCC.",
      "Packaging, pallets, and SSCC sealing screen.",
    ),
    fields: {
      available_quantity: p(
        "الكمية المتاحة للاستهلاك؛ لا تتجاوز المخزون المحرّر للوط.",
        "Quantité disponible à la consommation ; ne peut dépasser le stock libéré du lot.",
        "Quantity available for consumption; cannot exceed the released stock for the lot.",
      ),
      sscc: p(
        "رمز المنصّة العالمي؛ رمز placeholder لا يُعدّ إنتاجيًا.",
        "Code SSCC de la palette ; un préfixe placeholder n'est pas de production.",
        "Pallet SSCC; a placeholder prefix is not a production code.",
      ),
    },
  },
  production: {
    id: "production",
    summary: p(
      "شاشة أوامر الإنتاج والفرز وتوازن المادة.",
      "Écran des ordres de production, triage et bilan matière.",
      "Production orders, triage, and mass balance screen.",
    ),
    fields: {
      waste_kg: p(
        "الفاقد الصريح؛ مدخل = مخرج + فاقد.",
        "Déchet explicite ; entrée = sortie + déchet.",
        "Explicit waste; input = output + waste.",
      ),
    },
  },
  logistics: {
    id: "logistics",
    summary: p(
      "شاشة تحضير الشحنات والتصدير.",
      "Écran de préparation des expéditions et export.",
      "Shipment preparation and export screen.",
    ),
    fields: {},
  },
};

export const screenHelpText = (
  screenId: string,
  element: string | null,
  language: AiGuideLanguage,
): string | null => {
  const screen = AI_GUIDE_SCREENS[screenId];
  if (!screen) return null;
  if (element && screen.fields[element]) {
    return screen.fields[element][language];
  }
  return screen.summary[language];
};

export const hasScreenHelp = (screenId: string | null | undefined): boolean =>
  Boolean(screenId) && Boolean(AI_GUIDE_SCREENS[String(screenId)]);
