/**
 * Short role-facing guidance. Used when no lot is selected so the employee
 * still hears what *their* station does, not a generic plant tour.
 */

import type { AiGuideLanguage } from "../ai-guide.types.js";
import type { MultiLang } from "./navigation.js";

const p = (ar: string, fr: string, en: string): MultiLang => ({ ar, fr, en });

const ROLE_HELP: Record<string, MultiLang> = {
  operateur_reception: p("أنت في الاستقبال: وزن وتسجيل الشحنات.", "Vous êtes à la réception : peser et enregistrer.", "You are at reception: weigh and record deliveries."),
  responsable_reception: p("أنت مسؤول الاستقبال: أكمل الوزن ثم أرسل للجودة.", "Vous pilotez la réception : pesée puis envoi qualité.", "You run reception: weigh, then send to QC."),
  inspecteur_qualite: p("أنت مفتش جودة: قرّر التحرير أو الحجر أو الرفض.", "Vous inspectez : libérer, quarantaine ou rejet.", "You inspect: release, quarantine, or reject."),
  responsable_qualite: p("أنت مسؤول الجودة: حرّر اللوطات المطابقة فقط.", "Vous libérez uniquement les lots conformes.", "You release only conforming lots."),
  magasinier_wms: p("أنت أمين المخزن: حرّك اللوطات دون تجاوز السعة.", "Vous déplacez les lots sans dépasser la capacité.", "You move lots without exceeding capacity."),
  responsable_stock: p("أنت مسؤول المخزون: تخزين ثم تحضير الشحن.", "Vous gérez le stock : stockage puis préparation.", "You manage stock: storage then shipment prep."),
  responsable_production: p("أنت في الإنتاج: فرز وتعليب مع توازن المادة.", "Vous êtes en production : triage et conditionnement, bilan matière.", "You are in production: triage and packing with mass balance."),
  operateur_conditionnement: p("أنت في التعليب: استهلاك لوط محرّر ثم إنشاء منصّة.", "Vous conditionnez : consommer un lot libéré puis créer une palette.", "You pack: consume a released lot, then create a pallet."),
  operateur_emballage: p("أنت في التغليف: أنشئ المنصّة واختمها.", "Vous emballez : créer et sceller la palette.", "You pack pallets: create and seal."),
  responsable_logistique: p("أنت في الشحن: اختر لوطات محرّرة فقط.", "Vous expédiez : uniquement des lots libérés.", "You ship: pick released lots only."),
};

export const roleHelpText = (roles: string[], language: AiGuideLanguage): string | null => {
  for (const role of roles) {
    const entry = ROLE_HELP[role];
    if (entry) return entry[language];
  }
  return null;
};
