import { badRequest, conflict } from "../../core/app-error.js";
import { getCollectionModel, sanitizeDocument } from "../../db/dynamic-model.js";

/**
 * The evidence a QC decision must carry. Requirements come from the published
 * `qc_checklists` version for the reception type, never from the client and
 * never from this file: with no published policy a decision fails safely.
 */
export type QcCheckInput = {
  checklist_item_id?: string | null;
  check_code?: string;
  check_name?: string;
  category?: string | null;
  severity?: string;
  result?: string;
  note?: string | null;
  measured_value?: string | null;
  expected_value?: string | null;
};

export type QcRequirements = {
  checklist_id: string;
  checklist_code: string;
  checklist_version: number;
  items: Array<{ id: string; code: string; name: string; category: string | null; severity: string }>;
};

export type QcEvidenceRow = Required<Pick<QcCheckInput, "check_code" | "severity" | "result">> & QcCheckInput & {
  checklist_version: number | null;
};

const ANSWERED = new Set(["CONFORME", "NON_CONFORME"]);
/** RG-Q04: the justification length the inspection screen has always required. */
const OVERRIDE_JUSTIFICATION_MIN_LENGTH = 20;

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const upper = (value: unknown) => text(value).toUpperCase();

export const loadQcRequirements = async (receptionType: unknown): Promise<QcRequirements> => {
  const type = text(receptionType);
  const checklists = type
    ? sanitizeDocument(
      await getCollectionModel("qc_checklists").find({ reception_type: type, is_active: true }).lean().exec(),
    ) as Array<Record<string, unknown>>
    : [];

  if (checklists.length > 1) {
    throw conflict(
      "QC_POLICY_AMBIGUOUS",
      `Plusieurs grilles qualité sont actives pour le type ${type} : le responsable qualité doit n'en garder qu'une.`,
    );
  }
  const checklist = checklists[0];
  const items = checklist
    ? sanitizeDocument(
      await getCollectionModel("qc_checklist_items").find({ checklist_id: checklist.id, is_active: true }).sort({ sequence_order: 1 }).lean().exec(),
    ) as Array<Record<string, unknown>>
    : [];
  if (!checklist || items.length === 0) {
    throw conflict(
      "QC_POLICY_UNAVAILABLE",
      `Aucune grille qualité publiée pour le type ${type || "inconnu"} : la décision ne peut pas être enregistrée.`,
    );
  }

  return {
    checklist_id: String(checklist.id),
    checklist_code: String(checklist.code),
    checklist_version: Number(checklist.version),
    items: items.map((item) => ({
      id: String(item.id),
      code: String(item.code),
      name: String(item.name),
      category: (item.category as string) ?? null,
      severity: upper(item.severity),
    })),
  };
};

const toEvidenceRows = (requirements: QcRequirements, checkResults: unknown): QcEvidenceRow[] => {
  const inputs = (Array.isArray(checkResults) ? checkResults : []) as QcCheckInput[];
  const rows = inputs.map((input): QcEvidenceRow => {
    const item = requirements.items.find((entry) =>
      entry.id === input?.checklist_item_id || entry.code === input?.check_code);
    const result = upper(input?.result);
    return {
      ...input,
      checklist_item_id: item?.id ?? null,
      check_code: item?.code ?? text(input?.check_code),
      check_name: item?.name ?? text(input?.check_name),
      category: item?.category ?? input?.category ?? null,
      // A published severity cannot be lowered by the client.
      severity: item?.severity ?? (upper(input?.severity) || "MAJEUR"),
      result: ANSWERED.has(result) ? result : "NA",
      checklist_version: item ? requirements.checklist_version : null,
    };
  });

  const codes = rows.map((row) => row.check_code);
  if (codes.some((code) => !code) || new Set(codes).size !== codes.length) {
    throw badRequest("QC_EVIDENCE_INVALID", "Chaque contrôle doit apparaître une seule fois, avec son code.");
  }
  return rows;
};

export const evaluateQcEvidence = (input: {
  decision: string;
  requirements: QcRequirements;
  checkResults: unknown;
  automaticRejectReasons?: unknown;
  recommendedDecision?: unknown;
  overrideJustification?: unknown;
  overridePhoto?: unknown;
}): QcEvidenceRow[] => {
  const rows = toEvidenceRows(input.requirements, input.checkResults);
  const answered = rows.filter((row) => ANSWERED.has(row.result));

  // Holding or rejecting a lot must stay quick: one recorded check is enough to justify it.
  if (input.decision !== "ACCEPTE") {
    if (answered.length === 0) {
      throw badRequest("QC_EVIDENCE_INCOMPLETE", "Enregistrez au moins un contrôle pour justifier cette décision.");
    }
    return rows;
  }

  const missing = input.requirements.items
    .filter((item) => !answered.some((row) => row.check_code === item.code))
    .map((item) => item.code);
  if (missing.length > 0) {
    throw badRequest(
      "QC_EVIDENCE_INCOMPLETE",
      `Contrôles obligatoires manquants pour la grille ${input.requirements.checklist_code} v${input.requirements.checklist_version} : ${missing.join(", ")}.`,
      { missing },
    );
  }

  const critical = answered.filter((row) => row.severity === "CRITIQUE" && row.result === "NON_CONFORME");
  const automatic = Array.isArray(input.automaticRejectReasons) ? input.automaticRejectReasons.filter(Boolean) : [];
  if (critical.length > 0 || automatic.length > 0) {
    throw conflict(
      "QC_CRITICAL_NONCONFORMITY",
      "Une non-conformité critique interdit la libération : mettez le lot en quarantaine ou rejetez-le.",
      { checks: critical.map((row) => row.check_code), automaticRejectReasons: automatic },
    );
  }

  const overridden = answered.some((row) => row.result === "NON_CONFORME")
    || (Boolean(input.recommendedDecision) && input.recommendedDecision !== "ACCEPTE");
  if (overridden && (text(input.overrideJustification).length < OVERRIDE_JUSTIFICATION_MIN_LENGTH || !text(input.overridePhoto))) {
    throw badRequest(
      "QC_OVERRIDE_JUSTIFICATION_REQUIRED",
      `Une acceptation malgré un écart demande une justification d'au moins ${OVERRIDE_JUSTIFICATION_MIN_LENGTH} caractères et une photo (RG-Q04).`,
    );
  }

  return rows;
};
