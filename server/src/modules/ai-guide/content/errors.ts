/**
 * Known MES error codes the guide may explain. The LLM cannot invent a code;
 * the validator only accepts keys from this map (or a code already on the lot).
 */

import type { AiGuideLanguage } from "../ai-guide.types.js";
import type { MultiLang } from "./navigation.js";

const p = (ar: string, fr: string, en: string): MultiLang => ({ ar, fr, en });

export const AI_GUIDE_ERRORS: Record<string, MultiLang> = {
  LOT_NOT_RELEASED: p(
    "اللوط لم يُحرَّر بعد من مراقبة الجودة.",
    "Le lot n'a pas encore été libéré par la qualité.",
    "The lot has not been released by QC yet.",
  ),
  LOT_NOT_CONSUMABLE: p(
    "حالة اللوط لا تسمح بالاستهلاك (حجر أو غير محرّر).",
    "Le statut du lot n'autorise pas la consommation (quarantaine ou non libéré).",
    "The lot status does not allow consumption (quarantine or not released).",
  ),
  INSUFFICIENT_STOCK: p(
    "الكمية المطلوبة أكبر من المخزون المتاح.",
    "La quantité demandée dépasse le stock disponible.",
    "The requested quantity exceeds available stock.",
  ),
  LOT_NOT_FOUND: p(
    "اللوط غير موجود.",
    "Lot introuvable.",
    "Lot not found.",
  ),
  MASS_BALANCE_UNBALANCED: p(
    "بيان المادة غير متوازن: المدخل يجب أن يساوي المخرج زائد الفاقد الصريح.",
    "Bilan matière non bouclé : l'entrée doit égaler la sortie plus le déchet explicite.",
    "Mass balance is open: input must equal output plus explicit waste.",
  ),
  DESTINATION_KG_CAPACITY_EXCEEDED: p(
    "النقل يتجاوز سعة الوجهة بالكيلوغرام.",
    "Le mouvement dépasse la capacité kg de la destination.",
    "The move would exceed the destination kilogram capacity.",
  ),
  SOURCE_KG_EXCEEDED: p(
    "المصدر لا يحتوي على الكمية المطلوبة.",
    "La source ne contient pas assez de kilogrammes.",
    "The source does not contain enough kilograms.",
  ),
  TRIAGE_STOCK_NOT_FOUND: p(
    "لا يوجد لوط مخزون فرز لهذا المصدر.",
    "Aucun lot de stock triage pour cette source.",
    "No triage stock lot exists for this source.",
  ),
  LOT_QC_REQUIRED: p(
    "يلزم قرار مراقبة الجودة قبل هذه الخطوة.",
    "Une décision QC est requise avant cette étape.",
    "A QC decision is required before this step.",
  ),
  LOT_CCP_REQUIRED: p(
    "مسار Premium يتطلب إتمام تبخير CCP قبل الفرز أو التعليب.",
    "La route Premium exige la fumigation CCP avant triage ou conditionnement.",
    "The Premium route requires fumigation CCP before triage or packing.",
  ),
  LOT_TRIAGE_REQUIRED: p(
    "التعليب يتطلب إتمام الفرز.",
    "Le conditionnement exige un triage terminé.",
    "Packaging requires completed triage.",
  ),
  LOT_PACK_REQUIRED: p(
    "الشحن يتطلب منصّة مختومة.",
    "L'expédition exige une palette scellée.",
    "Shipment requires a sealed pallet.",
  ),
  LOT_REJECTED: p(
    "اللوط مرفوض ولا يمكنه التقدم.",
    "Lot rejeté : il ne peut plus avancer.",
    "The lot is rejected and cannot advance.",
  ),
  ROLE_NOT_PERMITTED: p(
    "دورك لا يسمح بتنفيذ هذه العملية. يمكنك الاطلاع على الشرح فقط.",
    "Votre rôle ne permet pas d'exécuter cette opération. Le guide explique seulement.",
    "Your role cannot execute this operation. The guide can only explain.",
  ),
  WAITING_ON_QUALITY: p(
    "بانتظار قرار مراقبة الجودة من فريق الجودة.",
    "En attente d'une décision du service qualité.",
    "Waiting for a quality decision from the QC team.",
  ),
  AI_GUIDE_UNAVAILABLE: p(
    "المساعد الذكي غير متاح. الإرشاد أدناه من حالة النظام الحالية.",
    "L'assistant IA est indisponible. Le guidage ci-dessous vient de l'état actuel du système.",
    "The AI assistant is unavailable. Guidance below comes from the current system state.",
  ),
  MUTATION_NOT_ALLOWED: p(
    "لا أستطيع تنفيذ العملية. يمكنني فقط شرحها وتوجيهك إلى الشاشة المناسبة.",
    "Je ne peux pas exécuter l'opération. Je peux seulement l'expliquer et ouvrir l'écran.",
    "I cannot perform the operation. I can only explain it and open the right screen.",
  ),
};

export const isKnownErrorCode = (code: string | null | undefined): boolean =>
  Boolean(code) && Object.prototype.hasOwnProperty.call(AI_GUIDE_ERRORS, String(code));

export const errorExplanation = (code: string | null | undefined, language: AiGuideLanguage): string | null => {
  if (!code) return null;
  const entry = AI_GUIDE_ERRORS[code];
  return entry ? entry[language] : null;
};
