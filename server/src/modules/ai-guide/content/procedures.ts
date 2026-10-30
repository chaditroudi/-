/**
 * Curated procedure knowledge base. Short, structured, multilingual.
 * The LLM only ever receives the single relevant procedure, trimmed to the
 * configured character budget — never the whole library.
 */

import type { AiGuideLanguage } from "../ai-guide.types.js";
import type { MultiLang } from "./navigation.js";

export interface AiGuideProcedure {
  id: string;
  title: MultiLang;
  roles: string[];
  screens: string[];
  steps: MultiLang[];
  relatedRoutes: string[];
}

const p = (ar: string, fr: string, en: string): MultiLang => ({ ar, fr, en });

export const AI_GUIDE_PROCEDURES: Record<string, AiGuideProcedure> = {
  reception: {
    id: "reception",
    title: p("استقبال شحنة", "Réceptionner une livraison", "Receive a delivery"),
    roles: ["responsable_reception", "chef_reception", "operateur_reception"],
    screens: ["receptions"],
    relatedRoutes: ["/?tab=receptions"],
    steps: [
      p("اختر المورد وأدخل رقم وصل التسليم.", "Choisir le fournisseur et saisir le bon de livraison.", "Select the supplier and enter the delivery note."),
      p("سجّل الوزن القائم ثم الفارغ.", "Enregistrer le poids brut puis la tare.", "Record the gross weight then the tare."),
      p("اختر المسار الصناعي (Premium افتراضي).", "Choisir la route (Premium par défaut).", "Choose the manufacturing route (Premium by default)."),
      p("أكّد لإنشاء اللوط وإدخاله للمخزون.", "Valider pour créer le lot et l'entrée stock.", "Confirm to create the lot and the stock entry."),
    ],
  },
  qc: {
    id: "qc",
    title: p("قرار مراقبة الجودة", "Décision qualité", "Quality control decision"),
    roles: ["responsable_qualite", "inspecteur_qualite", "resp_qualite_haccp"],
    screens: ["quality"],
    relatedRoutes: ["/?tab=quality"],
    steps: [
      p("افتح فحص الجودة للوط.", "Ouvrir l'inspection QC du lot.", "Open the lot's QC inspection."),
      p("أدخل قياسات المخبر أو معدل الأرضية.", "Saisir la mesure labo ou la moyenne atelier.", "Enter the lab measurement or the floor average."),
      p("قرّر: تحرير أو حجر أو رفض.", "Décider : libérer, mettre en quarantaine ou rejeter.", "Decide: release, quarantine, or reject."),
      p("التحرير يسمح بمتابعة المسار.", "La libération autorise la suite du parcours.", "Release unlocks the rest of the flow."),
    ],
  },
  storage: {
    id: "storage",
    title: p("تخزين بارد", "Stockage froid", "Cold storage"),
    roles: ["responsable_stock", "magasinier_wms"],
    screens: ["storage"],
    relatedRoutes: ["/?tab=storage"],
    steps: [
      p("امسح رمز اللوط والموقع الوجهة.", "Scanner le lot et l'emplacement de destination.", "Scan the lot and the destination location."),
      p("تحقق من سعة الكيلوغرام في الوجهة.", "Vérifier la capacité kg de la destination.", "Check the destination kilogram capacity."),
      p("أكّد النقل؛ يُرفض إن تجاوز السعة.", "Valider le mouvement ; refusé si capacité dépassée.", "Confirm the move; rejected if capacity is exceeded."),
    ],
  },
  production: {
    id: "production",
    title: p("أمر إنتاج", "Ordre de production", "Production order"),
    roles: ["responsable_production"],
    screens: ["production"],
    relatedRoutes: ["/?tab=production"],
    steps: [
      p("أنشئ أمر إنتاج وخصّص اللوطات المحرّرة.", "Créer un OF et allouer les lots libérés.", "Create an order and allocate released lots."),
      p("ابدأ الأمر لاستهلاك الكميات المخصّصة.", "Démarrer l'OF pour consommer les quantités allouées.", "Start the order to consume the allocated quantities."),
      p("أدخل المخرج والفاقد الصريح عند الإقفال.", "Saisir la sortie et le déchet explicite à la clôture.", "Enter the output and explicit waste at completion."),
      p("بيان المادة يجب أن يتوازن: مدخل = مخرج + فاقد.", "Le bilan matière doit boucler : entrée = sortie + déchet.", "Mass balance must close: input = output + waste."),
    ],
  },
  triage: {
    id: "triage",
    title: p("فرز اللوط", "Triage du lot", "Lot triage"),
    roles: ["responsable_production", "operateur_triage_ia", "responsable_qualite"],
    screens: ["production"],
    relatedRoutes: ["/?tab=production"],
    steps: [
      p("افتح جلسة فرز للوط الأب.", "Ouvrir une session de triage pour le lot parent.", "Open a triage session for the parent lot."),
      p("وزّع الكميات على اللوطات الفرعية بالرتبة.", "Répartir en sous-lots par grade.", "Split into sub-lots by grade."),
      p("أقفل الجلسة مع توازن المادة.", "Clôturer avec le bilan matière.", "Close the session with mass balance."),
    ],
  },
  packaging: {
    id: "packaging",
    title: p("أمر تعليب", "Ordre de conditionnement", "Packaging order"),
    roles: ["responsable_production", "operateur_conditionnement", "operateur_emballage"],
    screens: ["packaging"],
    relatedRoutes: ["/?tab=packaging"],
    steps: [
      p("اختر لوط الفرز المحرّر كمصدر.", "Choisir le lot de triage libéré comme source.", "Choose the released triage lot as source."),
      p("أدخل الكمية المستهلكة (لا تتجاوز المتوفر).", "Saisir la quantité consommée (≤ disponible).", "Enter the consumed quantity (≤ available)."),
      p("أنشئ الأمر؛ يُخصم المخزون بشكل مغلق.", "Créer l'OF ; le stock est décrémenté en tout-ou-rien.", "Create the order; stock is decremented atomically."),
    ],
  },
  pallet: {
    id: "pallet",
    title: p("إنشاء وختم منصّة", "Créer et sceller une palette", "Create and seal a pallet"),
    roles: ["responsable_production", "operateur_emballage", "magasinier_wms"],
    screens: ["packaging"],
    relatedRoutes: ["/?tab=packaging"],
    steps: [
      p("أنشئ منصّة من أمر التعليب.", "Créer une palette depuis l'OF de conditionnement.", "Create a pallet from the packaging order."),
      p("أدخل عدد الصناديق والوزن.", "Saisir le nombre de cartons et le poids.", "Enter the box count and weight."),
      p("اختم المنصّة لإصدار SSCC ولوط منتج تام.", "Sceller la palette pour générer le SSCC et le lot PF.", "Seal the pallet to issue the SSCC and finished lot."),
      p("رمز placeholder لا يُنتج SSCC حقيقي.", "Un préfixe placeholder ne produit pas de vrai SSCC.", "A placeholder prefix does not produce a real SSCC."),
    ],
  },
  shipment: {
    id: "shipment",
    title: p("تحضير شحنة", "Préparer une expédition", "Prepare a shipment"),
    roles: ["responsable_stock", "responsable_logistique", "magasinier_wms"],
    screens: ["logistics"],
    relatedRoutes: ["/?tab=logistics"],
    steps: [
      p("افتح تحضير الشحنة واختر اللوطات المحرّرة.", "Ouvrir la préparation et choisir les lots libérés.", "Open the preparation and pick released lots."),
      p("امسح كل لوط؛ الكمية لا تتجاوز المتوفر.", "Scanner chaque lot ; quantité ≤ disponible.", "Scan each lot; quantity ≤ available."),
      p("أكّد الشحن؛ يُخصم المخزون ويُسجَّل الأثر.", "Valider ; le stock est décrémenté et tracé.", "Confirm; stock is decremented and traced."),
    ],
  },
};

export const procedureText = (procedureId: string, language: AiGuideLanguage): string | null => {
  const procedure = AI_GUIDE_PROCEDURES[procedureId];
  if (!procedure) return null;
  const title = procedure.title[language];
  const steps = procedure.steps.map((step, index) => `${index + 1}. ${step[language]}`);
  return [title, ...steps].join("\n");
};

/** Maps a screen/tab id to the procedure most relevant to it. */
export const PROCEDURE_BY_SCREEN: Record<string, string> = {
  receptions: "reception",
  quality: "qc",
  storage: "storage",
  production: "production",
  packaging: "packaging",
  logistics: "shipment",
};
