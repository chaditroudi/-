import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertTriangle, ArrowLeft, ArrowRight, CheckCircle, CheckCircle2, Clock, FlaskConical, MapPin, Play, Printer, Shield, XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { FieldGroup, ReviewList } from "@/components/shared/task";
import { receptionErrorMessage, useCalibrationStatus, useQcChecklist, useCreateQCInspection, useQCInspections, useSubmitQCDecision } from "@/hooks/useReceptionsV2";
import { useModule3StorageZones } from "@/hooks/useStorageModule3";
import { Module3StorageZone } from "@/types/storage";
import { QCDecisionType, RQCData, RQCCritere, ReceptionV2 } from "@/types/reception";
import { printRQC } from "./printRQC";
import { computeQcScore, getQcClassificationLabel } from "@/lib/royalPalmPhase1";
import { PhotoCapture } from "./PhotoCapture";
import { useAuth } from "@/hooks/useAuth";
import {
  checkQCWindowRGQ01,
  createRejectionNotification,
} from "@/lib/phase1RuleEngine";
import { QC_NC_CODES, getAutoTriggeredNCs } from "@/lib/qcNCCodes";
import { NumericSignaturePad } from "@/components/shared/NumericSignatureDialog";
import { QcChecklistAnswers } from "./QcChecklistAnswers";
import type { SubmitQcDecisionInput } from "@/lib/api/receptions";
import { checklistResults, hasNonConformity, unansweredCount, type QcChecklistAnswers as ChecklistAnswers } from "@/lib/qcChecklist";
import { darijaTitle } from "@/i18n/workerDarija";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Recommandation déterministe d'une chambre froide basée sur les données d'occupation réelles et la compatibilité Bio
 */
export function getRecommendedColdStorageZone(
  zones: Module3StorageZone[],
  options: {
    isBio?: boolean;
    variety?: string | null;
    lotWeightKg?: number | null;
  }
): { zone: Module3StorageZone; occupancyPct: number } | null {
  const activeZones = zones.filter((z) => z.is_active);

  // Filtrer les zones de froid (FRIGO, CHAMBRE_FROIDE ou famille COLD ou code C- / ZF)
  const coldZones = activeZones.filter((z) => {
    const code = (z.code || '').toLowerCase();
    const name = (z.name || '').toLowerCase();
    const type = (z.zone_type || '').toLowerCase();
    const isCold =
      type.includes('frigo') ||
      type.includes('chambre') ||
      type.includes('cold') ||
      name.includes('chambre') ||
      name.includes('frigo') ||
      code.startsWith('c-') ||
      code.startsWith('zf');
    const isQuarantine = name.includes('quarantaine') || code.includes('quar');
    return isCold && !isQuarantine;
  });

  if (coldZones.length === 0) return null;

  // Filtrer selon la filière Bio vs Conventionnel
  const bioFiltered = coldZones.filter((z) => {
    const isBioZone = (z as any).is_bio_only === true || (z.name || '').toLowerCase().includes('bio');
    if (options.isBio) {
      return isBioZone;
    } else {
      return !(z as any).is_bio_only;
    }
  });

  const candidates = bioFiltered.length > 0 ? bioFiltered : coldZones;

  // Calculer l'occupation
  const withOccupancy = candidates.map((z) => {
    const cap = (z.capacity_kg && z.capacity_kg > 0)
      ? z.capacity_kg
      : ((z.capacity_palettes && z.capacity_palettes > 0) ? z.capacity_palettes : 10000);
    const load = (z as any).current_load_kg ?? (z as any).current_occupancy_kg ?? (z as any).current_load_palettes ?? (z as any).current_occupancy_palettes ?? 0;
    const occPct = cap > 0 ? Math.round((load / cap) * 100) : 0;
    return { zone: z, occupancyPct: Math.min(100, Math.max(0, occPct)) };
  });

  withOccupancy.sort((a, b) => a.occupancyPct - b.occupancyPct);

  if (withOccupancy[0].occupancyPct >= 100) return null;

  return withOccupancy[0];
}

interface QCInspectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reception: ReceptionV2;
  /** Opens the reception's storage assignment once the lot is released. */
  onAssignStorage?: () => void;
}

// Instrument readings start empty: a value is recorded only once the inspector measures it.
type Measurement = number | null;
const defaultHumidity = (): Measurement[] => [null, null, null];
const defaultCalibers = (): Measurement[] => Array<Measurement>(10).fill(null);
const isMeasured = (value: Measurement): value is number => value != null && Number.isFinite(value);
const parseMeasurement = (raw: string): Measurement => (raw.trim() === "" ? null : Number(raw));

type RqcCritereKey = keyof Pick<RQCData,'infestee'|'fermentee'|'immature'|'craquellee'|'grasse'|'seche'|'tachee'|'ridee'|'petit_calibre'>;

const emptyRqcCritere = (): RQCCritere => ({ test1: null, test2: null, test3: null, taux_moyen: null });
const defaultRqc = (): RQCData => ({
  conventionnel: false, bio_certifie: false, ggp: false,
  bon_de_reception_ref: null,
  poids_echantillon_branche_kg: null, poids_tb_kg: null, taux_tb_percent: null,
  poids_vrac_kg: null, type_dattes_branche: true, type_dattes_vrac: false,
  infestee: emptyRqcCritere(), fermentee: emptyRqcCritere(), immature: emptyRqcCritere(),
  craquellee: emptyRqcCritere(), grasse: emptyRqcCritere(), seche: emptyRqcCritere(),
  tachee: emptyRqcCritere(), ridee: emptyRqcCritere(), petit_calibre: emptyRqcCritere(),
  taux_dechet_percent: null, endommage_percent: null, db_score: null,
  td_percent: null, conclusion: null,
  responsable_qc1: null, responsable_qc2: null, directeur_qc: null,
});

type QcSection = 'mesures' | 'defauts' | 'labo' | 'rqc' | 'verdict';
const QC_SECTION_KEYS: QcSection[] = ['mesures', 'defauts', 'labo', 'rqc', 'verdict'];

/** Floor limits already applied by the decision checks below (INS, MOLD); shown so the inspector sees them while typing. */
const DEFECT_FIELDS = [
  { field: "insectsPercent", limit: 5 },
  { field: "moldPercent", limit: 2 },
  { field: "fermentationPercent", limit: 1 },
  { field: "mechanicalDamagePercent" },
  { field: "crystallizationPercent" },
  { field: "discolorationPercent" },
] as const;

const RQC_CRITERIA: { field: RqcCritereKey; waste: boolean }[] = [
  { field: 'infestee', waste: true },
  { field: 'fermentee', waste: true },
  { field: 'immature', waste: true },
  { field: 'craquellee', waste: true },
  { field: 'grasse', waste: false },
  { field: 'seche', waste: false },
  { field: 'tachee', waste: false },
  { field: 'ridee', waste: false },
  { field: 'petit_calibre', waste: false },
];

const NC_SELECTED: Record<string, string> = {
  CRITIQUE: 'border-destructive bg-destructive/5',
  MAJEUR: 'border-warning bg-sand',
  MINEUR: 'border-warning/50 bg-sand/60',
};

/** A rule or state the inspector must see. Tone only, no decoration. */
function Notice({ tone, icon, title, children }: { tone: 'warning' | 'danger' | 'info'; icon?: ReactNode; title?: ReactNode; children?: ReactNode }) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-3 rounded-xl border p-4 text-sm [&_svg]:mt-0.5 [&_svg]:h-5 [&_svg]:w-5 [&_svg]:shrink-0',
        tone === 'danger' && 'border-destructive/30 bg-destructive/5 text-foreground [&_svg]:text-destructive',
        tone === 'warning' && 'border-warning/30 bg-sand text-foreground [&_svg]:text-warning',
        tone === 'info' && 'border-primary/20 bg-accent text-foreground [&_svg]:text-primary',
      )}
    >
      {icon}
      <div className="min-w-0 space-y-0.5">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="text-muted-foreground">{children}</div>}
      </div>
    </div>
  );
}

export const QCInspectionDialog = ({ open, onOpenChange, reception, onAssignStorage }: QCInspectionDialogProps) => {
  const { t } = useTranslation();
  const { user, isAdmin, profile } = useAuth();
  const { data: calibration } = useCalibrationStatus();
  const [caliberFillValue, setCaliberFillValue] = useState("");
  // Inspection form is split into numbered sections so operators do one thing at a time
  const QC_SECTIONS = QC_SECTION_KEYS.map((key, index) => ({ key, label: `${index + 1} · ${t(`qcInspect.section.${key}`)}` }));
  const [qcSection, setQcSection] = useState<QcSection>('mesures');
  const qcSectionIndex = QC_SECTIONS.findIndex((section) => section.key === qcSection);
  const goQcSection = (delta: number) => {
    const next = QC_SECTIONS[qcSectionIndex + delta];
    if (next) setQcSection(next.key);
  };
  const [phase, setPhase] = useState<"start" | "inspection" | "confirmed">("start");
  const [inspectorName, setInspectorName] = useState("");
  const [secondaryInspectorName, setSecondaryInspectorName] = useState("");
  const [inspectionId, setInspectionId] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [confirmedDecision, setConfirmedDecision] = useState<QCDecisionType | null>(null);
  const [humidity, setHumidity] = useState<Measurement[]>(defaultHumidity);
  const [calibers, setCalibers] = useState<Measurement[]>(defaultCalibers);
  const [defects, setDefects] = useState({
    insectsPercent: 0,
    moldPercent: 0,
    fermentationPercent: 0,
    mechanicalDamagePercent: 0,
    crystallizationPercent: 0,
    discolorationPercent: 0,
  });
  const [organoleptic, setOrganoleptic] = useState({
    tasteScore: 5,
    textureScore: 5,
    appearanceScore: 5,
  });
  const [labSampleRequired, setLabSampleRequired] = useState(false);
  const [labAnalyses, setLabAnalyses] = useState<string[]>([]);
  const [labStorageLocation, setLabStorageLocation] = useState("");
  /** Lab-confirmed values that lock into the QC decision trail (B1). */
  const [labHumidityPct, setLabHumidityPct] = useState<string>("");
  const [labDefectsPct, setLabDefectsPct] = useState<string>("");
  const [overrideDecision, setOverrideDecision] = useState<QCDecisionType | null>(null);
  const [overridePhoto, setOverridePhoto] = useState<string[]>([]);
  const qcChecklist = useQcChecklist(reception.reception_type);
  const [checklistAnswers, setChecklistAnswers] = useState<ChecklistAnswers>({});
  const [selectedNcCodes, setSelectedNcCodes] = useState<string[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Signature numérique — la libération QC (ACCEPTE) exige un code signature, saisi dans ce même écran.
  const [releasePinOpen, setReleasePinOpen] = useState(false);
  const [rqc, setRqc] = useState<RQCData>(defaultRqc);

  const { data: storageZones = [] } = useModule3StorageZones();

  // Recommandation déterministe basée sur les données d'occupation réelles et filière Bio
  const recommendedColdZone = useMemo(() => {
    return getRecommendedColdStorageZone(storageZones, {
      isBio: reception.bio_declared,
      variety: reception.variety,
      lotWeightKg: reception.quantity_total,
    });
  }, [storageZones, reception.bio_declared, reception.variety, reception.quantity_total]);

  const updateRqcCritere = useCallback((field: RqcCritereKey, test: 'test1'|'test2'|'test3', value: number | null) => {
    setRqc(prev => {
      const critere = { ...prev[field], [test]: value };
      const vals = [critere.test1, critere.test2, critere.test3].filter((v): v is number => v != null);
      critere.taux_moyen = vals.length ? Math.round((vals.reduce((a,b)=>a+b,0)/vals.length)*10)/10 : null;
      return { ...prev, [field]: critere };
    });
  }, []);

  const createInspection = useCreateQCInspection();
  const submitDecision = useSubmitQCDecision();
  const { data: existingInspections = [] } = useQCInspections(reception.id);

  const openInspection = existingInspections.find((inspection) => !inspection.decision);
  const doubleInspectionRequired = reception.quantity_total > 10000;
  const labRequiredByRule =
    reception.quantity_total > 5000 || (reception.supplier?.delivered_lots_count ?? 0) === 0;
  const isOwnReceptionInspector = Boolean(user?.id && reception.created_by === user.id);
  const canOverrideRoleSeparation = isOwnReceptionInspector && isAdmin;

  useEffect(() => {
    if (!open) return;

    setLabSampleRequired(labRequiredByRule);

    // Auto-fill inspector name from logged-in user
    if (!inspectorName) {
      const autoName = profile?.full_name || user?.email || "";
      if (autoName) setInspectorName(autoName);
    }

    if (openInspection && reception.status === "EN_QC") {
      setInspectorName(openInspection.inspector_name);
      setInspectionId(openInspection.id);
      setPhase("inspection");
    }
  }, [labRequiredByRule, open, openInspection, reception.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const score = useMemo(
    () =>
      computeQcScore({
        humidity: humidity.filter(isMeasured),
        calibers: calibers.filter(isMeasured),
        ...defects,
        ...organoleptic,
      }),
    [calibers, defects, humidity, organoleptic],
  );

  const selectedDecision = overrideDecision || score.recommendedDecision;
  const humidityMissing = humidity.filter((value) => !isMeasured(value)).length;
  const caliberMissing = calibers.filter((value) => !isMeasured(value)).length;
  const missingMeasurements = humidityMissing + caliberMissing;
  const labIncomplete = labSampleRequired && (labAnalyses.length === 0 || !labStorageLocation.trim());
  const sectionState = (key: QcSection, index: number): 'done' | 'current' | 'todo' | 'blocked' => {
    if (key === qcSection) return 'current';
    if (index < qcSectionIndex) {
      if (key === 'mesures' && missingMeasurements > 0) return 'blocked';
      if (key === 'labo' && labIncomplete) return 'blocked';
      return 'done';
    }
    return 'todo';
  };
  const decisionLabel = (decision: QCDecisionType) => t(`qcInspect.decision.${decision}`);
  const qcNow = phase === "start"
    ? (isOwnReceptionInspector && !canOverrideRoleSeparation
        ? t("qcInspect.now.ownReception")
        : t("qcInspect.now.start"))
    : phase === "confirmed"
      ? t("qcInspect.now.confirmed")
      : qcSection === "mesures"
        ? (missingMeasurements > 0
            ? t("qcInspect.now.measuresMissing", { humidity: humidityMissing, caliber: caliberMissing })
            : t("qcInspect.now.measuresDone"))
        : qcSection === "labo" && labIncomplete
          ? t("qcInspect.now.labIncomplete")
          : qcSection === "verdict"
            ? (missingMeasurements > 0
                ? t("qcInspect.now.verdictBlocked", { n: missingMeasurements })
                : t("qcInspect.now.verdictReady", { decision: decisionLabel(selectedDecision) }))
            : t(`qcInspect.now.${qcSection}`);

  const totalDefectsFloor = useMemo(
    () =>
      defects.insectsPercent +
      defects.moldPercent +
      defects.fermentationPercent +
      defects.mechanicalDamagePercent +
      defects.crystallizationPercent +
      defects.discolorationPercent,
    [defects],
  );

  const labHumidityForDecision = useMemo(() => {
    const n = Number(labHumidityPct);
    return Number.isFinite(n) && labHumidityPct.trim() !== '' ? n : score.humidityAverage;
  }, [labHumidityPct, score.humidityAverage]);

  const labDefectsForDecision = useMemo(() => {
    const n = Number(labDefectsPct);
    return Number.isFinite(n) && labDefectsPct.trim() !== '' ? n : totalDefectsFloor;
  }, [labDefectsPct, totalDefectsFloor]);

  // RG-Q01: time since gate arrival
  const qcWindow = useMemo(
    () => checkQCWindowRGQ01(reception.gate_arrival_at),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reception.gate_arrival_at, phase],
  );

  // NC codes auto-suggested from non-conformant check results
  const autoSuggestedNcs = useMemo(() => {
    const ncCheckCodes = score.humidityScore < 60 ? ['HUM'] : [];
    if (score.caliberScore < 60) ncCheckCodes.push('CAL');
    if (defects.insectsPercent > 5) ncCheckCodes.push('INS');
    if (defects.moldPercent > 2 || defects.fermentationPercent > 1) ncCheckCodes.push('MOLD');
    if (score.organolepticScore < 60) ncCheckCodes.push('ORG');
    return getAutoTriggeredNCs(ncCheckCodes);
  }, [score, defects]);

  const resetState = () => {
    setPhase("start");
    setQcSection("mesures");
    setInspectorName("");
    setSecondaryInspectorName("");
    setInspectionId(null);
    setComment("");
    setConfirmedDecision(null);
    setHumidity(defaultHumidity());
    setCalibers(defaultCalibers());
    setDefects({
      insectsPercent: 0,
      moldPercent: 0,
      fermentationPercent: 0,
      mechanicalDamagePercent: 0,
      crystallizationPercent: 0,
      discolorationPercent: 0,
    });
    setOrganoleptic({
      tasteScore: 5,
      textureScore: 5,
      appearanceScore: 5,
    });
    setLabSampleRequired(false);
    setLabAnalyses([]);
    setLabStorageLocation("");
    setOverrideDecision(null);
    setChecklistAnswers({});
    setOverridePhoto([]);
    setSelectedNcCodes([]);
    setSubmitError(null);
    setReleasePinOpen(false);
    setRqc(defaultRqc());
  };

  const closeDialog = () => {
    resetState();
    onOpenChange(false);
  };

  const updateHumidity = (index: number, value: Measurement) => {
    const next = [...humidity];
    next[index] = value;
    setHumidity(next);
  };

  const updateCaliber = (index: number, value: Measurement) => {
    const next = [...calibers];
    next[index] = value;
    setCalibers(next);
  };

  const toggleAnalysis = (value: string) => {
    setLabAnalyses((current) =>
      current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value],
    );
  };

  const startInspection = async () => {
    if (!inspectorName.trim()) return;

    let inspection;
    try {
      inspection = await createInspection.mutateAsync({
        reception_id: reception.id,
        inspector_name: inspectorName.trim(),
        sampling_method: "3 mesures humidite + 10 mesures calibre",
        nb_samples: 10,
      });
    } catch (error) {
      toast.error(receptionErrorMessage(error, t("qcInspect.error.startFailed")));
      return;
    }

    setInspectionId(inspection.id);
    setPhase("inspection");
  };

  const isOverriding = !!overrideDecision && overrideDecision !== score.recommendedDecision;
  const needsJustification = isOverriding
    || (selectedDecision === 'ACCEPTE' && hasNonConformity(qcChecklist.items, checklistAnswers));

  const submit = async (pin?: string) => {
    if (!inspectionId) return;
    setSubmitError(null);

    if (missingMeasurements > 0) {
      setReleasePinOpen(false);
      setSubmitError(t("qcInspect.error.measuresIncomplete", { n: missingMeasurements }));
      return;
    }

    if (qcChecklist.unavailable) {
      setSubmitError(t("qcInspect.error.noChecklist"));
      return;
    }
    const unanswered = unansweredCount(qcChecklist.items, checklistAnswers);
    if (selectedDecision === 'ACCEPTE' && unanswered > 0) {
      setReleasePinOpen(false);
      setSubmitError(t("qcInspect.error.checklistIncomplete", { n: unanswered }));
      return;
    }

    if (selectedDecision === 'REJETE' && selectedNcCodes.length === 0) {
      setSubmitError(t("qcInspect.error.ncRequired"));
      return;
    }
    if (doubleInspectionRequired && secondaryInspectorName.trim().length < 3) {
      setSubmitError(t("qcInspect.error.secondInspector"));
      return;
    }
    if (labSampleRequired && labAnalyses.length === 0) {
      setSubmitError(t("qcInspect.error.labAnalysis"));
      return;
    }
    if (labSampleRequired && !labStorageLocation.trim()) {
      setSubmitError(t("qcInspect.error.labLocation"));
      return;
    }
    // RG-Q04: override requires ≥ 20 char justification + 1 photo
    if (needsJustification && comment.trim().length < 20) {
      setSubmitError(t("qcInspect.error.justificationShort", { n: comment.trim().length }));
      return;
    }
    if (needsJustification && overridePhoto.length === 0) {
      setSubmitError(t("qcInspect.error.justificationPhoto"));
      return;
    }

    // Signature numérique — la libération (ACCEPTE) est la transition à plus
    // fort risque légal: on demande le code signature avant d'écrire.
    if (selectedDecision === 'ACCEPTE' && !pin) {
      setReleasePinOpen(true);
      return;
    }

    const details = [
      `Humidité moyenne sol: ${score.humidityAverage}%`,
      `Humidité décision labo: ${labHumidityForDecision}%`,
      `Défauts totaux décision: ${labDefectsForDecision}%`,
      `Calibre moyen: ${score.caliberAverage} mm`,
      `Score final: ${score.finalScore}/100`,
      `Classement: ${getQcClassificationLabel(score.classification)}`,
      labSampleRequired ? `Analyses labo: ${labAnalyses.join(", ")}` : null,
      doubleInspectionRequired ? `Second inspecteur: ${secondaryInspectorName}` : null,
      comment.trim() || null,
    ]
      .filter(Boolean)
      .join(" | ");

    try {
      await submitDecision.mutateAsync({
        inspectionId,
        decision: selectedDecision,
        comment: details,
        qualitySummary: {
          score: score.finalScore,
          grade: score.classification,
          automaticRejectReasons: score.automaticRejectReasons,
          lab_humidity_pct: labHumidityForDecision,
          lab_defects_pct: labDefectsForDecision,
        },
        labSampleRequired,
        labAnalyses,
        labStorageLocation,
        secondaryInspectorName: doubleInspectionRequired ? secondaryInspectorName.trim() : undefined,
        recommendedDecision: score.recommendedDecision,
        overrideJustification: needsJustification ? comment.trim() : undefined,
        overridePhoto: needsJustification && overridePhoto.length > 0 ? overridePhoto[0] : undefined,
        nonconformityCodes: selectedNcCodes.length > 0 ? selectedNcCodes : undefined,
        rqc,
        pin: pin ?? undefined,
        checkResults: [
          ...checklistResults(qcChecklist.items, checklistAnswers),
          ...([
          { check_code: "HUM", check_name: "Humidité", severity: "MAJEUR", result: score.humidityScore >= 60 ? "CONFORME" : "NON_CONFORME", note: `${labHumidityForDecision}% (sol ${score.humidityAverage}%)`, measured_value: String(labHumidityForDecision), expected_value: "20-26" },
          { check_code: "DEF", check_name: "Défauts totaux", severity: "MAJEUR", result: labDefectsForDecision <= 10 ? "CONFORME" : "NON_CONFORME", note: `${labDefectsForDecision}%`, measured_value: String(labDefectsForDecision), expected_value: "<= 10" },
          { check_code: "CAL", check_name: "Calibre", severity: "MAJEUR", result: score.caliberScore >= 60 ? "CONFORME" : "NON_CONFORME", note: `${score.caliberAverage} mm`, measured_value: String(score.caliberAverage), expected_value: ">= 40" },
          { check_code: "INS", check_name: "Insectes", severity: "CRITIQUE", result: defects.insectsPercent > 5 ? "NON_CONFORME" : "CONFORME", note: `${defects.insectsPercent}%`, measured_value: String(defects.insectsPercent), expected_value: "<= 5" },
          { check_code: "MOLD", check_name: "Moisissure/Fermentation", severity: "CRITIQUE", result: defects.moldPercent > 2 || defects.fermentationPercent > 1 ? "NON_CONFORME" : "CONFORME", note: `M ${defects.moldPercent}% / F ${defects.fermentationPercent}%`, measured_value: `${defects.moldPercent}/${defects.fermentationPercent}`, expected_value: "<= 2 / <= 1" },
          { check_code: "ORG", check_name: "Organoleptique", severity: "MINEUR", result: score.organolepticScore >= 60 ? "CONFORME" : "NON_CONFORME", note: `${score.organolepticAverage}/5`, measured_value: String(score.organolepticAverage), expected_value: ">= 3/5" },
          ] as SubmitQcDecisionInput['checkResults']).filter((row) => !qcChecklist.items.some((item) => item.code === row.check_code)),
        ],
      });
    } catch (error) {
      // Inputs stay as entered; re-sending the same decision completes a partial update.
      setReleasePinOpen(false);
      setSubmitError(receptionErrorMessage(error, t("qcInspect.error.submitFailed")));
      return;
    }

    setReleasePinOpen(false);
    setConfirmedDecision(selectedDecision);
    setPhase("confirmed");

    // Supplier metrics / RG-F03 are recalculated server-side after QC close.
    const supplierId = reception.supplier_id;
    const supplierName = reception.supplier?.name ?? reception.supplier_name_snapshot ?? "";

    // RG-Q03: notification on rejection
    if (selectedDecision === "REJETE") {
      createRejectionNotification({
        receptionNumber: reception.reception_number,
        supplierId,
        supplierName,
        receptionId: reception.id,
        score: score.finalScore,
        grade: score.classification,
        autoRejectReasons: score.automaticRejectReasons,
        variety: reception.variety,
        weightKg: reception.quantity_total,
      }).catch(console.error);
    }
  };

  // ── Presentation helpers (read-only views of the state above) ──────────────
  const measuredHumidity = humidity.filter(isMeasured).length;
  const measuredCalibers = calibers.filter(isMeasured).length;
  const supplierName = reception.supplier?.name ?? reception.supplier_name_snapshot ?? undefined;
  const wasteRate = (() => {
    const vals = [rqc.infestee, rqc.fermentee, rqc.immature, rqc.craquellee]
      .map(c => c.taux_moyen)
      .filter((v): v is number => v != null);
    return vals.length ? `${Math.round(vals.reduce((a,b)=>a+b,0)*10)/10}%` : '—';
  })();
  const headerTitle = phase === "start"
    ? t("qcInspect.title.start")
    : phase === "confirmed"
      ? t("qcInspect.title.confirmed")
      : t(`qcInspect.title.${qcSection}`);
  const numberInput = "h-14 text-2xl font-semibold tabular-nums";
  const DecisionIcon = { ACCEPTE: CheckCircle, QUARANTAINE: AlertTriangle, REJETE: XCircle } as const;

  return (
    <>
    <Dialog open={open} onOpenChange={closeDialog}>
      <DialogContent
        className="flex h-[100dvh] max-h-[100dvh] w-full max-w-5xl flex-col gap-0 overflow-hidden rounded-none p-0 sm:h-[94vh] sm:p-0 sm:max-h-[94vh] sm:rounded-2xl"
        onInteractOutside={(event) => event.preventDefault()}
      >
        {/* ── Task header: what this is, where we are, what to do now ── */}
        <header className="shrink-0 space-y-3 border-b bg-card px-4 pb-3 pt-4 sm:px-6 sm:pt-5">
          <div className="flex items-start gap-3 pe-10">
            <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground sm:flex">
              <Shield className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-semibold text-primary">
                {t("qcInspect.eyebrow")} · <span className="font-mono">{reception.reception_number}</span>
              </p>
              <DialogTitle className="font-display text-2xl font-semibold leading-tight sm:text-[1.75rem]">{headerTitle}</DialogTitle>
              {qcNow && <DialogDescription className="text-sm text-muted-foreground sm:text-base">{qcNow}</DialogDescription>}
            </div>
          </div>

          {phase !== "confirmed" && (
            <dl className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
              {supplierName && <div className="flex gap-1.5"><dt className="text-muted-foreground">{t("qcInspect.facts.supplier")}</dt><dd className="font-semibold">{supplierName}</dd></div>}
              <div className="flex gap-1.5"><dt className="text-muted-foreground">{t("qcInspect.facts.quantity")}</dt><dd dir="ltr" className="font-semibold tabular-nums">{formatNumber(reception.quantity_total, 0)} {reception.unit}</dd></div>
              {reception.variety && <div className="flex gap-1.5"><dt className="text-muted-foreground">{t("qcInspect.facts.variety")}</dt><dd className="font-semibold">{reception.variety}</dd></div>}
            </dl>
          )}

          {phase === "inspection" && (
            <nav aria-label={t("qcInspect.sectionsLabel")}>
              <ol className="grid grid-cols-5 gap-1.5">
                {QC_SECTIONS.map(({ key, label }, index) => {
                  const state = sectionState(key, index);
                  const count = key === "mesures" && missingMeasurements > 0 ? missingMeasurements : null;
                  return (
                    <li key={key}>
                      <button
                        type="button"
                        onClick={() => setQcSection(key)}
                        aria-current={state === "current" ? "step" : undefined}
                        className="group flex min-h-11 w-full flex-col justify-end gap-1.5 rounded-md text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span className={cn(
                          "truncate text-xs sm:text-sm",
                          state === "current" ? "font-semibold text-foreground" : "font-medium text-muted-foreground group-hover:text-foreground",
                          state === "blocked" && "text-destructive",
                        )}>
                          {label}
                          {count !== null && <span className="ms-1 tabular-nums">({count})</span>}
                        </span>
                        <span className={cn("h-1.5 w-full rounded-full",
                          state === "done" && "bg-primary",
                          state === "current" && "bg-primary",
                          state === "todo" && "bg-border",
                          state === "blocked" && "bg-destructive")} />
                      </button>
                    </li>
                  );
                })}
              </ol>
            </nav>
          )}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto bg-background">
          <div className="mx-auto w-full max-w-4xl space-y-4 px-4 py-5 sm:px-6">
          {phase === "start" && (
            <>
              {/* RG-Q12: reception operator cannot inspect their own lot */}
              {isOwnReceptionInspector && (
                <Notice
                  tone={canOverrideRoleSeparation ? "warning" : "danger"}
                  icon={canOverrideRoleSeparation ? <AlertTriangle aria-hidden /> : <XCircle aria-hidden />}
                  title={t("qcInspect.rules.q12.title")}
                >
                  {canOverrideRoleSeparation ? t("qcInspect.rules.q12.adminOverride") : t("qcInspect.rules.q12.blocked")}
                </Notice>
              )}

              {/* RG-Q01: QC window alert */}
              {qcWindow.status !== 'ok' && (
                <Notice
                  tone={qcWindow.status === 'overdue' ? "danger" : "warning"}
                  icon={<Clock aria-hidden />}
                  title={qcWindow.status === 'overdue' ? t("qcInspect.rules.q01.overdueTitle") : t("qcInspect.rules.q01.soonTitle")}
                >
                  {t("qcInspect.rules.q01.elapsed", { hours: qcWindow.hoursElapsed })}{" "}
                  {qcWindow.status === 'overdue' ? t("qcInspect.rules.q01.overdue") : t("qcInspect.rules.q01.soon")}
                </Notice>
              )}

              {calibration && !calibration.calibrated && (
                <Notice tone="warning" icon={<AlertTriangle aria-hidden />} title={t("qcInspect.rules.q08.title")}>
                  {t("qcInspect.rules.q08.body")}
                </Notice>
              )}

              <ReviewList
                items={[
                  { label: t("qcInspect.facts.supplier"), value: reception.supplier?.name },
                  { label: t("qcInspect.facts.quantity"), value: <bdi dir="ltr">{formatNumber(reception.quantity_total, 0)} {reception.unit}</bdi>, emphasis: true },
                  { label: t("qcInspect.facts.variety"), value: reception.variety || undefined },
                  { label: t("qcInspect.facts.arrivalTemp"), value: reception.arrival_temperature_c != null ? <bdi dir="ltr">{formatNumber(reception.arrival_temperature_c)} °C</bdi> : undefined },
                ]}
              />

              <FieldGroup title={t("qcInspect.start.inspector")}>
                <div className="space-y-1.5">
                  <Label htmlFor="qc-inspector" className="text-sm font-medium">{t("qcInspect.start.primaryInspector")}</Label>
                  <Input id="qc-inspector" className="h-12 text-lg" value={inspectorName} onChange={(event) => setInspectorName(event.target.value)} />
                </div>
                {doubleInspectionRequired && (
                  <Notice tone="warning" icon={<AlertTriangle aria-hidden />}>{t("qcInspect.start.doubleInspection")}</Notice>
                )}
              </FieldGroup>
            </>
          )}

          {phase === "inspection" && (
            <>
              {/* All sections stay mounted so typed values survive moving between them. */}
              <div className={qcSection === 'mesures' ? 'space-y-4' : 'hidden'}>
                <FieldGroup
                  title={t("qcInspect.humidity.title")}
                  description={t("qcInspect.humidity.target")}
                  complete={humidityMissing === 0}
                  summary={t("qcInspect.progress", { done: measuredHumidity, total: humidity.length })}
                >
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {humidity.map((value, index) => (
                      <div key={index} className="space-y-1.5">
                        <Label htmlFor={`qc-hum-${index}`} className="text-sm font-medium">{t("qcInspect.humidity.reading", { n: index + 1 })}</Label>
                        <Input
                          id={`qc-hum-${index}`}
                          type="number"
                          min="10"
                          max="40"
                          step="0.1"
                          inputMode="decimal"
                          placeholder="%"
                          value={value ?? ""}
                          onFocus={(e) => e.target.select()}
                          onChange={(event) => updateHumidity(index, parseMeasurement(event.target.value))}
                          className={numberInput}
                        />
                      </div>
                    ))}
                    <div className={cn("flex flex-col justify-end rounded-xl border px-3 py-2",
                      humidityMissing === 0 ? (score.humidityScore >= 60 ? "border-primary/30 bg-accent" : "border-destructive/30 bg-destructive/5") : "bg-card")}>
                      <span className="text-sm text-muted-foreground">{t("qcInspect.average")}</span>
                      <span className="text-2xl font-semibold tabular-nums">{humidity.every(isMeasured) ? `${formatNumber(score.humidityAverage)} %` : "—"}</span>
                    </div>
                  </div>
                </FieldGroup>

                <FieldGroup
                  title={t("qcInspect.caliber.title")}
                  description={t("qcInspect.caliber.hint")}
                  complete={caliberMissing === 0}
                  summary={t("qcInspect.progress", { done: measuredCalibers, total: calibers.length })}
                >
                  <div className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed bg-card p-3">
                    <div className="space-y-1">
                      <Label htmlFor="qc-cal-fill" className="text-sm font-medium">{t("qcInspect.caliber.sameValue")}</Label>
                      <Input
                        id="qc-cal-fill"
                        type="number"
                        min="20"
                        max="70"
                        step="0.1"
                        inputMode="decimal"
                        placeholder="mm"
                        value={caliberFillValue}
                        onChange={(e) => setCaliberFillValue(e.target.value)}
                        className="h-12 w-28 text-lg tabular-nums"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-12"
                      disabled={!caliberFillValue}
                      onClick={() => {
                        const v = Number(caliberFillValue);
                        if (v > 0) setCalibers(Array(10).fill(v));
                      }}
                    >
                      {t("qcInspect.caliber.applyAll")}
                    </Button>
                    {measuredCalibers === calibers.length && (
                      <p className="ms-auto self-center text-sm text-muted-foreground">
                        {t("qcInspect.average")} <span className="font-semibold text-foreground tabular-nums">{formatNumber(score.caliberAverage)} mm</span>
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3 min-[480px]:grid-cols-5">
                    {calibers.map((value, index) => (
                      <div key={index} className="space-y-1">
                        <Label htmlFor={`qc-cal-${index}`} className="text-sm text-muted-foreground">L{index + 1}</Label>
                        <Input
                          id={`qc-cal-${index}`}
                          type="number"
                          min="20"
                          max="70"
                          step="0.1"
                          inputMode="decimal"
                          placeholder="mm"
                          value={value ?? ""}
                          onFocus={(e) => e.target.select()}
                          onChange={(event) => updateCaliber(index, parseMeasurement(event.target.value))}
                          className="h-12 text-xl tabular-nums"
                        />
                      </div>
                    ))}
                  </div>
                </FieldGroup>
              </div>

              <div className={qcSection === 'defauts' ? 'space-y-4' : 'hidden'}>
                <FieldGroup
                  title={t("qcInspect.defects.title")}
                  description={t("qcInspect.defects.hint")}
                  summary={t("qcInspect.defects.total", { value: formatNumber(totalDefectsFloor) })}
                >
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                    {DEFECT_FIELDS.map((item) => {
                      const field = item.field;
                      const limit = "limit" in item ? item.limit : undefined;
                      const over = limit !== undefined && defects[field] > limit;
                      return (
                        <div key={field} className="space-y-1">
                          <Label htmlFor={`qc-def-${field}`} className="text-sm font-medium">{t(`qcInspect.defects.${field}`)}</Label>
                          <Input
                            id={`qc-def-${field}`}
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            inputMode="decimal"
                            aria-describedby={limit !== undefined ? `qc-def-${field}-limit` : undefined}
                            className={cn("h-12 text-xl tabular-nums", over && "border-destructive")}
                            value={defects[field]}
                            onFocus={(e) => e.target.select()}
                            onChange={(event) =>
                              setDefects((current) => ({
                                ...current,
                                [field]: Number(event.target.value),
                              }))
                            }
                          />
                          {limit !== undefined && (
                            <p id={`qc-def-${field}-limit`} className={cn("text-xs", over ? "font-semibold text-destructive" : "text-muted-foreground")}>
                              {t("qcInspect.defects.limit", { limit })}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </FieldGroup>

                <FieldGroup title={t("qcInspect.organoleptic.title")} description={t("qcInspect.organoleptic.hint")}>
                  <div className="grid gap-4 lg:grid-cols-3">
                    {(["tasteScore", "textureScore", "appearanceScore"] as const).map((field) => {
                      const current = organoleptic[field];
                      const name = t(`qcInspect.organoleptic.${field}`);
                      return (
                        <div key={field} className="space-y-1.5" role="group" aria-label={name}>
                          <div className="flex items-baseline justify-between">
                            <span className="text-sm font-medium">{name}</span>
                            <span className="text-sm tabular-nums text-muted-foreground">{current}/5</span>
                          </div>
                          <div className="grid grid-cols-5 gap-1.5">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                type="button"
                                aria-pressed={star === current}
                                aria-label={t("qcInspect.organoleptic.scoreOf", { name, score: star })}
                                onClick={() => setOrganoleptic((prev) => ({ ...prev, [field]: star }))}
                                className={cn(
                                  "h-12 rounded-lg border text-base font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                  star <= current ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
                                )}
                              >
                                {star}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </FieldGroup>
              </div>

              <div className={qcSection === 'labo' ? 'space-y-4' : 'hidden'}>
                <FieldGroup title={t("qcInspect.lab.title")} complete={labSampleRequired && !labIncomplete}>
                  <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border bg-card px-3 py-2">
                    <Checkbox
                      checked={labSampleRequired}
                      onCheckedChange={(checked) => setLabSampleRequired(Boolean(checked))}
                    />
                    <span className="text-sm">
                      <span className="font-medium">{t("qcInspect.lab.sample")}</span>{" "}
                      <span className="text-muted-foreground">{labRequiredByRule ? t("qcInspect.lab.requiredByRule") : t("qcInspect.lab.optional")}</span>
                    </span>
                  </label>
                  {labSampleRequired && (
                    <>
                      <div className="space-y-2">
                        <p className="text-sm font-medium">{t("qcInspect.lab.analyses")}</p>
                        <div className="flex flex-wrap gap-2">
                          {["Pesticides", "Metaux lourds", "Aflatoxines", "Microbiologie"].map((analysis) => (
                            <Button
                              key={analysis}
                              type="button"
                              aria-pressed={labAnalyses.includes(analysis)}
                              variant={labAnalyses.includes(analysis) ? "default" : "outline"}
                              className="h-11"
                              onClick={() => toggleAnalysis(analysis)}
                            >
                              {labAnalyses.includes(analysis) && <CheckCircle2 aria-hidden />}
                              {analysis}
                            </Button>
                          ))}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label htmlFor="qc-lab-hum" className="text-sm font-medium">{t("qcInspect.lab.humidity")}</Label>
                          <Input
                            id="qc-lab-hum"
                            type="number"
                            inputMode="decimal"
                            min={10}
                            max={40}
                            step={0.1}
                            className="h-12 text-lg tabular-nums"
                            placeholder={String(score.humidityAverage)}
                            value={labHumidityPct}
                            onChange={(e) => setLabHumidityPct(e.target.value)}
                          />
                          <p className="text-xs text-muted-foreground">
                            {t("qcInspect.lab.humidityFloor", { value: score.humidityAverage })}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="qc-lab-def" className="text-sm font-medium">{t("qcInspect.lab.defects")}</Label>
                          <Input
                            id="qc-lab-def"
                            type="number"
                            inputMode="decimal"
                            min={0}
                            max={100}
                            step={0.1}
                            className="h-12 text-lg tabular-nums"
                            placeholder={String(totalDefectsFloor)}
                            value={labDefectsPct}
                            onChange={(e) => setLabDefectsPct(e.target.value)}
                          />
                          <p className="text-xs text-muted-foreground">
                            {t("qcInspect.lab.defectsFloor", { value: totalDefectsFloor.toFixed(1) })}
                          </p>
                        </div>
                      </div>
                      <Notice tone="info" icon={<FlaskConical aria-hidden />} title={t("qcInspect.lab.linkTitle")}>
                        {t("qcInspect.lab.link", {
                          humidity: labHumidityForDecision,
                          defects: labDefectsForDecision,
                          decision: decisionLabel(score.recommendedDecision),
                        })}
                      </Notice>
                      <div className="space-y-1">
                        <Label htmlFor="qc-lab-location" className="text-sm font-medium">{t("qcInspect.lab.location")}</Label>
                        <Input id="qc-lab-location" className="h-12 text-lg" value={labStorageLocation} onChange={(event) => setLabStorageLocation(event.target.value)} />
                      </div>
                    </>
                  )}
                </FieldGroup>
              </div>

              {/* ── RQC — Rapport Contrôle Qualité Réception Achat ── */}
              <div className={qcSection === 'rqc' ? 'space-y-4' : 'hidden'}>
                <FieldGroup title={t("qcInspect.rqc.certification")}>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { key: 'conventionnel', label: 'Conventionnel' },
                      { key: 'bio_certifie', label: 'TN-Bio 001' },
                      { key: 'ggp', label: 'GGP' },
                    ].map(({ key, label }) => (
                      <label key={key} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border bg-card px-3">
                        <Checkbox
                          checked={rqc[key as 'conventionnel'|'bio_certifie'|'ggp']}
                          onCheckedChange={(v) => setRqc(p => ({ ...p, [key]: Boolean(v) }))}
                        />
                        <span className="text-sm font-medium">{label}</span>
                      </label>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-muted-foreground">{t("qcInspect.rqc.dateType")}</span>
                    {[['type_dattes_branche', t("qcInspect.rqc.branch")], ['type_dattes_vrac', t("qcInspect.rqc.bulk")]].map(([key, label]) => (
                      <label key={key} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border bg-card px-3">
                        <Checkbox
                          checked={rqc[key as 'type_dattes_branche'|'type_dattes_vrac']}
                          onCheckedChange={(v) => setRqc(p => ({ ...p, [key]: Boolean(v) }))}
                        />
                        <span className="text-sm font-medium">{label}</span>
                      </label>
                    ))}
                  </div>
                </FieldGroup>

                <FieldGroup title={t("qcInspect.rqc.weights")}>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    {[
                      { key: 'poids_echantillon_branche_kg', label: 'Poids Ech. (kg)' },
                      { key: 'poids_tb_kg', label: 'Poids T.B. (kg)' },
                      { key: 'taux_tb_percent', label: '% T.B.' },
                      { key: 'poids_vrac_kg', label: 'VRAC (kg)' },
                    ].map(({ key, label }) => (
                      <div key={key} className="space-y-1">
                        <Label htmlFor={`qc-rqc-${key}`} className="text-sm font-medium">{label}</Label>
                        <Input
                          id={`qc-rqc-${key}`}
                          type="number" min="0" step="0.1" inputMode="decimal" className="h-12 text-lg tabular-nums"
                          value={(rqc[key as keyof RQCData] as number | null) ?? ''}
                          onChange={e => setRqc(p => ({ ...p, [key]: e.target.value === '' ? null : Number(e.target.value) }))}
                        />
                      </div>
                    ))}
                  </div>
                </FieldGroup>

                <FieldGroup
                  title={t("qcInspect.rqc.criteria")}
                  description={t("qcInspect.rqc.criteriaHint")}
                  summary={<>{t("qcInspect.rqc.wasteRate")} <span className="font-semibold text-foreground tabular-nums">{wasteRate}</span></>}
                >
                  <div className="hidden grid-cols-[minmax(7rem,1.4fr)_repeat(3,minmax(0,1fr))_5rem] gap-2 px-1 text-xs font-semibold text-muted-foreground sm:grid">
                    <span>{t("qcInspect.rqc.criterion")}</span>
                    <span>TEST 1 (%)</span>
                    <span>TEST 2 (%)</span>
                    <span>TEST 3 (%)</span>
                    <span className="text-end">{t("qcInspect.rqc.average")}</span>
                  </div>
                  <ul className="space-y-2">
                    {RQC_CRITERIA.map(({ field, waste }) => {
                      const name = t(`qcInspect.rqc.c.${field}`);
                      return (
                        <li
                          key={field}
                          className={cn(
                            "grid grid-cols-4 items-center gap-2 rounded-lg border bg-card p-2 sm:grid-cols-[minmax(7rem,1.4fr)_repeat(3,minmax(0,1fr))_5rem]",
                            waste && "border-s-4 border-s-warning",
                          )}
                        >
                          <span className="col-span-4 text-sm font-medium sm:col-span-1">
                            {name}
                            {waste && <span className="ms-1.5 text-xs font-normal text-muted-foreground">{t("qcInspect.rqc.countsAsWaste")}</span>}
                          </span>
                          {(['test1','test2','test3'] as const).map((testKey, i) => (
                            <Input
                              key={testKey}
                              type="number" min="0" max="100" step="0.1" inputMode="decimal"
                              aria-label={t("qcInspect.rqc.testOf", { name, n: i + 1 })}
                              className="h-11 text-base tabular-nums"
                              value={rqc[field][testKey] ?? ''}
                              onChange={e => updateRqcCritere(field, testKey, e.target.value === '' ? null : Number(e.target.value))}
                            />
                          ))}
                          <span className="text-end text-base font-semibold tabular-nums">
                            {rqc[field].taux_moyen != null ? `${rqc[field].taux_moyen}%` : '—'}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warning/30 bg-sand px-3 py-2.5">
                    <span className="text-sm">
                      <span className="font-semibold">{t("qcInspect.rqc.wasteRate")}</span>{" "}
                      <span className="text-muted-foreground">{t("qcInspect.rqc.wasteFormula")}</span>
                    </span>
                    <span className="text-lg font-semibold tabular-nums">{wasteRate}</span>
                  </div>
                </FieldGroup>

                <FieldGroup title={t("qcInspect.rqc.conclusionTitle")}>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <div className="col-span-2 space-y-1">
                      <Label htmlFor="qc-rqc-conclusion" className="text-sm font-medium">{t("qcInspect.rqc.conclusion")}</Label>
                      <Input id="qc-rqc-conclusion" className="h-12" value={rqc.conclusion ?? ''} onChange={e => setRqc(p => ({ ...p, conclusion: e.target.value || null }))} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="qc-rqc-damaged" className="text-sm font-medium">{t("qcInspect.rqc.damaged")}</Label>
                      <Input id="qc-rqc-damaged" type="number" min="0" max="100" step="0.1" inputMode="decimal" className="h-12 tabular-nums"
                        value={rqc.endommage_percent ?? ''}
                        onChange={e => setRqc(p => ({ ...p, endommage_percent: e.target.value === '' ? null : Number(e.target.value) }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="qc-rqc-db" className="text-sm font-medium">DB</Label>
                      <Input id="qc-rqc-db" className="h-12" value={rqc.db_score ?? ''}
                        onChange={e => setRqc(p => ({ ...p, db_score: e.target.value || null }))}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {[
                      { key: 'responsable_qc1', label: 'Responsable QC 1' },
                      { key: 'responsable_qc2', label: 'Responsable QC 2' },
                      { key: 'directeur_qc', label: 'Directeur QC' },
                    ].map(({ key, label }) => (
                      <div key={key} className="space-y-1">
                        <Label htmlFor={`qc-rqc-${key}`} className="text-sm font-medium">{label}</Label>
                        <Input id={`qc-rqc-${key}`} className="h-12"
                          value={(rqc[key as keyof RQCData] as string | null) ?? ''}
                          onChange={e => setRqc(p => ({ ...p, [key]: e.target.value || null }))}
                        />
                      </div>
                    ))}
                  </div>
                </FieldGroup>
              </div>

              <div className={qcSection === 'verdict' ? 'space-y-4' : 'hidden'}>
                {/* Automatic result: the proposal the decision starts from */}
                <section className="space-y-4 rounded-2xl border bg-card p-4 sm:p-5" aria-label={t("qcInspect.verdict.result")}>
                  {missingMeasurements > 0 && (
                    <Notice tone="warning" icon={<AlertTriangle aria-hidden />} title={t("qcInspect.verdict.provisional", { n: missingMeasurements })}>
                      <button type="button" className="font-semibold text-primary underline-offset-4 hover:underline" onClick={() => setQcSection("mesures")}>
                        {t("qcInspect.verdict.goToMeasures")}
                      </button>
                    </Notice>
                  )}
                  <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">{missingMeasurements > 0 ? t("qcInspect.verdict.provisionalScore") : t("qcInspect.verdict.finalScore")}</p>
                      <p dir="ltr" className="font-display text-5xl font-semibold leading-none tabular-nums">{score.finalScore}<span className="text-2xl text-muted-foreground">/100</span></p>
                    </div>
                    {missingMeasurements === 0 && (
                      <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                        <div>
                          <dt className="text-muted-foreground">{t("qcInspect.verdict.classification")}</dt>
                          <dd><Badge variant="outline" className="mt-1 text-sm">{getQcClassificationLabel(score.classification)}</Badge></dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">{t("qcInspect.verdict.proposed")}</dt>
                          <dd>
                            <Badge variant={score.recommendedDecision === "REJETE" ? "destructive" : "secondary"} className="mt-1 text-sm">
                              {decisionLabel(score.recommendedDecision)}
                            </Badge>
                          </dd>
                        </div>
                      </dl>
                    )}
                  </div>
                  <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {[
                      ["humidity", score.humidityScore],
                      ["caliber", score.caliberScore],
                      ["insects", score.insectsScore],
                      ["moldFermentation", score.moldFermentationScore],
                      ["organoleptic", score.organolepticScore],
                      ["otherDefects", score.otherDefectsScore],
                    ].map(([key, value]) => (
                      <div key={key as string} className="rounded-lg border bg-secondary/60 px-3 py-2">
                        <dt className="text-xs text-muted-foreground">{t(`qcInspect.verdict.sub.${key}`)}</dt>
                        <dd className={cn("text-lg font-semibold tabular-nums", (value as number) < 60 && "text-destructive")}>{value}</dd>
                      </div>
                    ))}
                  </dl>
                </section>

                {score.automaticReject && (
                  <Notice tone="danger" icon={<AlertTriangle aria-hidden />} title={t("qcInspect.verdict.autoReject")}>
                    <ul className="list-disc space-y-0.5 ps-4">
                      {score.automaticRejectReasons.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  </Notice>
                )}

                <FieldGroup title={t("qcInspect.verdict.checklist")}>
                  <QcChecklistAnswers
                    checklist={qcChecklist.checklist}
                    items={qcChecklist.items}
                    unavailable={qcChecklist.unavailable}
                    answers={checklistAnswers}
                    onChange={setChecklistAnswers}
                  />
                </FieldGroup>

                {doubleInspectionRequired && (
                  <FieldGroup title={t("qcInspect.verdict.secondInspectorTitle")} complete={secondaryInspectorName.trim().length >= 3}>
                    <div className="space-y-1">
                      <Label htmlFor="qc-second-inspector" className="text-sm font-medium">{t("qcInspect.verdict.secondInspector")}</Label>
                      <Input
                        id="qc-second-inspector"
                        className="h-12 text-lg"
                        value={secondaryInspectorName}
                        onChange={(event) => setSecondaryInspectorName(event.target.value)}
                        placeholder={t("qcInspect.verdict.secondInspectorPlaceholder")}
                      />
                    </div>
                  </FieldGroup>
                )}

                <FieldGroup title={t("qcInspect.verdict.decisionTitle")} description={t("qcInspect.verdict.decisionHint")}>
                  <div className="grid gap-2 sm:grid-cols-3" role="group" aria-label={t("qcInspect.verdict.decisionTitle")}>
                    {(["ACCEPTE", "QUARANTAINE", "REJETE"] as QCDecisionType[]).map((decision) => {
                      const Icon = DecisionIcon[decision];
                      const active = selectedDecision === decision;
                      const proposed = decision === score.recommendedDecision;
                      return (
                        <button
                          key={decision}
                          type="button"
                          aria-pressed={active}
                          title={darijaTitle(decision === "ACCEPTE" ? "qc.accept" : decision === "REJETE" ? "qc.reject" : "qc.quarantine")}
                          onClick={() => {
                            setOverrideDecision(proposed ? null : decision);
                            setSubmitError(null);
                          }}
                          className={cn(
                            "flex min-h-16 items-center gap-3 rounded-xl border-2 bg-card px-4 py-3 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            active
                              ? decision === "ACCEPTE" ? "border-primary bg-accent" : decision === "QUARANTAINE" ? "border-warning bg-sand" : "border-destructive bg-destructive/5"
                              : "border-border hover:border-primary/40",
                          )}
                        >
                          <Icon className={cn("h-6 w-6 shrink-0",
                            decision === "ACCEPTE" ? "text-primary" : decision === "QUARANTAINE" ? "text-warning" : "text-destructive")} aria-hidden />
                          <span className="min-w-0">
                            <span className="block text-base font-semibold">{decisionLabel(decision)}</span>
                            {proposed && <span className="block text-xs text-muted-foreground">{t("qcInspect.verdict.proposedTag")}</span>}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {isOverriding && (
                    <Notice tone="warning" icon={<AlertTriangle aria-hidden />} title={t("qcInspect.verdict.overrideTitle")}>
                      {t("qcInspect.verdict.overrideBody", { from: decisionLabel(score.recommendedDecision), to: decisionLabel(overrideDecision as QCDecisionType) })}
                    </Notice>
                  )}

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="qc-comment" className="text-sm font-medium">
                        {needsJustification ? t("qcInspect.verdict.justification") : t("qcInspect.verdict.observations")}
                      </Label>
                      {needsJustification && (
                        <span className={cn("text-sm font-semibold tabular-nums", comment.trim().length >= 20 ? "text-primary" : "text-warning")}>
                          {comment.trim().length}/20
                        </span>
                      )}
                    </div>
                    <Textarea
                      id="qc-comment"
                      value={comment}
                      onChange={(event) => { setComment(event.target.value); setSubmitError(null); }}
                      rows={4}
                      className={cn("text-base", needsJustification && comment.trim().length < 20 && "border-warning")}
                      placeholder={needsJustification ? t("qcInspect.verdict.justificationPlaceholder") : t("qcInspect.verdict.observationsPlaceholder")}
                    />
                  </div>

                  {/* RG-Q04 override photo */}
                  {needsJustification && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">{t("qcInspect.verdict.photo")}</p>
                      <PhotoCapture
                        photos={overridePhoto}
                        onPhotosChange={setOverridePhoto}
                        maxPhotos={1}
                      />
                    </div>
                  )}
                </FieldGroup>

                {/* NC codes — mandatory when REJETE, optional for QUARANTAINE */}
                {(selectedDecision === 'REJETE' || selectedDecision === 'QUARANTAINE') && (
                  <FieldGroup
                    title={t("qcInspect.nc.title")}
                    description={selectedDecision === 'REJETE' ? t("qcInspect.nc.required") : t("qcInspect.nc.optional")}
                    complete={selectedNcCodes.length > 0}
                    summary={selectedNcCodes.length > 0 ? t("qcInspect.nc.selected", { n: selectedNcCodes.length }) : undefined}
                  >
                    {autoSuggestedNcs.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm text-muted-foreground">{t("qcInspect.nc.suggested")}</span>
                        {autoSuggestedNcs.map((nc) => (
                          <Button
                            key={nc.code}
                            type="button"
                            variant="outline"
                            size="sm"
                            className="font-mono"
                            onClick={() => setSelectedNcCodes((prev) =>
                              prev.includes(nc.code) ? prev : [...prev, nc.code]
                            )}
                          >
                            + {nc.code}
                          </Button>
                        ))}
                      </div>
                    )}
                    <div className="grid max-h-72 grid-cols-1 gap-2 overflow-y-auto pe-1 md:grid-cols-2">
                      {QC_NC_CODES.map((nc) => (
                        <label
                          key={nc.code}
                          className={cn(
                            "flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border bg-card px-3 py-2 text-sm transition-colors",
                            selectedNcCodes.includes(nc.code) ? NC_SELECTED[nc.severity] : "hover:bg-muted/40",
                          )}
                        >
                          <Checkbox
                            checked={selectedNcCodes.includes(nc.code)}
                            onCheckedChange={(checked) =>
                              setSelectedNcCodes((prev) =>
                                checked
                                  ? [...prev, nc.code]
                                  : prev.filter((c) => c !== nc.code),
                              )
                            }
                          />
                          <span className="font-mono font-semibold">{nc.code}</span>
                          <span className="min-w-0 flex-1 text-muted-foreground">{nc.label}</span>
                          <Badge variant="outline" className="shrink-0 text-xs">{nc.severity}</Badge>
                        </label>
                      ))}
                    </div>
                  </FieldGroup>
                )}
              </div>
            </>
          )}

          {phase === "confirmed" && confirmedDecision && (
            <div className="space-y-5 py-2">
              {(() => {
                const Icon = DecisionIcon[confirmedDecision];
                return (
                  <div className={cn("flex flex-col items-center gap-3 rounded-2xl border p-6 text-center",
                    confirmedDecision === "ACCEPTE" ? "border-primary/30 bg-accent" : confirmedDecision === "QUARANTAINE" ? "border-warning/30 bg-sand" : "border-destructive/30 bg-destructive/5")}>
                    <span className={cn("flex h-16 w-16 items-center justify-center rounded-full bg-card",
                      confirmedDecision === "ACCEPTE" ? "text-primary" : confirmedDecision === "QUARANTAINE" ? "text-warning" : "text-destructive")}>
                      <Icon className="h-9 w-9" aria-hidden />
                    </span>
                    <div className="space-y-1">
                      <h3 className="font-display text-2xl font-semibold">{t(`qcInspect.confirmed.${confirmedDecision}`)}</h3>
                      <p className="text-sm text-muted-foreground">
                        {t("qcInspect.confirmed.summary", {
                          score: score.finalScore,
                          classification: getQcClassificationLabel(score.classification),
                          humidity: score.humidityAverage,
                        })}
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* Rangement : passe par l'affectation des lots de la réception (même règles et traçabilité que le magasin). */}
              {confirmedDecision === "ACCEPTE" && (
                <section className="space-y-3 rounded-2xl border bg-card p-5">
                  <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                      <MapPin className="h-5 w-5" aria-hidden />
                    </span>
                    <div className="space-y-1">
                      <h4 className="font-display text-lg font-semibold">{t("qcInspect.confirmed.nextTitle")}</h4>
                      <p className="text-sm text-muted-foreground">
                        {recommendedColdZone
                          ? t(reception.bio_declared ? "qcInspect.confirmed.zoneBio" : "qcInspect.confirmed.zone", {
                              code: recommendedColdZone.zone.code,
                              name: recommendedColdZone.zone.name,
                              occupancy: recommendedColdZone.occupancyPct,
                            })
                          : t("qcInspect.confirmed.zoneNone")}
                      </p>
                    </div>
                  </div>
                  {onAssignStorage && (
                    <Button
                      type="button"
                      size="xl"
                      className="w-full"
                      onClick={() => {
                        closeDialog();
                        onAssignStorage();
                      }}
                    >
                      <MapPin aria-hidden />
                      {t("qcInspect.confirmed.assign")}
                    </Button>
                  )}
                </section>
              )}

              <div className="flex justify-center">
                <Button
                  variant="outline"
                  className="h-11"
                  onClick={() => {
                    const insp = existingInspections.find(i => i.id === inspectionId);
                    const fakeInsp = {
                      id: inspectionId ?? '',
                      inspection_number: insp?.inspection_number ?? openInspection?.inspection_number ?? inspectionId ?? '',
                      inspector_name: inspectorName,
                      secondary_inspector_name: secondaryInspectorName || null,
                      rqc,
                    } as Parameters<typeof printRQC>[0];
                    printRQC(fakeInsp, reception);
                  }}
                >
                  <Printer aria-hidden />
                  {t("qcInspect.confirmed.print")}
                </Button>
              </div>
            </div>
          )}
          </div>
        </div>

        {/* ── Action bar: always reachable, one primary action at the end ── */}
        <footer className="shrink-0 space-y-2 border-t bg-card px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:px-6">
          {/* Validation error — always visible regardless of scroll position */}
          {submitError && phase === "inspection" && (
            <p role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm font-medium text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {submitError}
            </p>
          )}
          {phase === "inspection" && releasePinOpen ? (
            <div className="w-full sm:ms-auto sm:max-w-sm">
              <NumericSignaturePad
                title={t("qcInspect.pin.title")}
                subtitle={t("qcInspect.pin.subtitle")}
                confirmLabel={t("qcInspect.pin.confirm")}
                pending={submitDecision.isPending}
                onCancel={() => setReleasePinOpen(false)}
                onConfirm={async (pin) => { await submit(pin); }}
              />
            </div>
          ) : (
            // Phones: Cancel and Back share a row, the primary action takes the full width below; wider screens keep one row.
            <div className="flex w-full flex-wrap items-center gap-2">
              <Button variant="ghost" className="me-auto min-h-12" onClick={closeDialog}>
                {phase === "confirmed" ? t("qcInspect.actions.close") : t("qcInspect.actions.cancel")}
              </Button>
                {phase === "inspection" && qcSectionIndex > 0 && (
                  <Button type="button" variant="outline" className="min-h-12" title={darijaTitle('qc.back')} onClick={() => goQcSection(-1)}>
                    <ArrowLeft aria-hidden />
                    {t("qcInspect.actions.back")}
                  </Button>
                )}
                {phase === "start" && (
                  <Button
                    size="lg"
                    className="min-h-12 w-full font-semibold sm:w-auto"
                    title={darijaTitle('reception.startQc')}
                    onClick={startInspection}
                    disabled={
                      !inspectorName.trim() ||
                      createInspection.isPending ||
                      (isOwnReceptionInspector && !canOverrideRoleSeparation)
                    }
                  >
                    <Play aria-hidden />
                    {createInspection.isPending ? t("qcInspect.actions.starting") : t("qcInspect.actions.start")}
                  </Button>
                )}
                {phase === "inspection" && (qcSection === 'verdict' ? (
                  <Button size="lg" className="min-h-12 w-full font-semibold sm:w-auto" title={darijaTitle('common.confirm')} onClick={() => submit()} disabled={submitDecision.isPending}>
                    {submitDecision.isPending ? t("qcInspect.actions.validating") : t("qcInspect.actions.validate")}
                  </Button>
                ) : (
                  <Button type="button" size="lg" className="min-h-12 w-full font-semibold sm:w-auto" title={darijaTitle('qc.continue')} onClick={() => goQcSection(1)}>
                    {t("qcInspect.actions.continue")}
                    <ArrowRight aria-hidden />
                  </Button>
                ))}
            </div>
          )}
        </footer>
      </DialogContent>
    </Dialog>
    </>
  );
};
