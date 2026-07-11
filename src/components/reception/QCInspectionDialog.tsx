import { useCallback, useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle, CheckCircle, Clock, FlaskConical, Play, Printer, Shield, XCircle } from "lucide-react";
import { useCalibrationStatus, useCreateQCInspection, useQCInspections, useSubmitQCDecision } from "@/hooks/useReceptionsV2";
import { QCDecisionType, RQCData, RQCCritere, ReceptionV2 } from "@/types/reception";
import { printRQC } from "./printRQC";
import { computeQcScore, getQcClassificationLabel, getQcDecisionLabel } from "@/lib/royalPalmPhase1";
import { PhotoCapture } from "./PhotoCapture";
import { useAuth } from "@/hooks/useAuth";
import {
  checkQCWindowRGQ01,
  createRejectionNotification,
  recalculateAndSaveSupplierScore,
  triggerAutoBlockIfNeeded,
} from "@/lib/phase1RuleEngine";
import { QC_NC_CODES, NC_SEVERITY_COLORS, getAutoTriggeredNCs } from "@/lib/qcNCCodes";

interface QCInspectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reception: ReceptionV2;
}

const defaultHumidity: [number, number, number] = [22, 22, 22];
const defaultCalibers = [45, 45, 45, 45, 45, 45, 45, 45, 45, 45];

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

export const QCInspectionDialog = ({ open, onOpenChange, reception }: QCInspectionDialogProps) => {
  const { user, isAdmin, profile } = useAuth();
  const { data: calibration } = useCalibrationStatus();
  const [caliberFillValue, setCaliberFillValue] = useState("");
  // Inspection form is split into numbered sections so operators do one thing at a time
  const [qcSection, setQcSection] = useState<'mesures' | 'defauts' | 'labo' | 'rqc'>('mesures');
  const [phase, setPhase] = useState<"start" | "inspection" | "confirmed">("start");
  const [inspectorName, setInspectorName] = useState("");
  const [secondaryInspectorName, setSecondaryInspectorName] = useState("");
  const [inspectionId, setInspectionId] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [confirmedDecision, setConfirmedDecision] = useState<QCDecisionType | null>(null);
  const [humidity, setHumidity] = useState<[number, number, number]>(defaultHumidity);
  const [calibers, setCalibers] = useState<number[]>(defaultCalibers);
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
  const [overrideDecision, setOverrideDecision] = useState<QCDecisionType | null>(null);
  const [overridePhoto, setOverridePhoto] = useState<string[]>([]);
  const [selectedNcCodes, setSelectedNcCodes] = useState<string[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [rqc, setRqc] = useState<RQCData>(defaultRqc);

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
        humidity,
        calibers,
        ...defects,
        ...organoleptic,
      }),
    [calibers, defects, humidity, organoleptic],
  );

  const selectedDecision = overrideDecision || score.recommendedDecision;

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
    setInspectorName("");
    setSecondaryInspectorName("");
    setInspectionId(null);
    setComment("");
    setConfirmedDecision(null);
    setHumidity(defaultHumidity);
    setCalibers(defaultCalibers);
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
    setOverridePhoto([]);
    setSelectedNcCodes([]);
    setSubmitError(null);
    setRqc(defaultRqc());
  };

  const closeDialog = () => {
    resetState();
    onOpenChange(false);
  };

  const updateHumidity = (index: number, value: number) => {
    const next = [...humidity] as [number, number, number];
    next[index] = value;
    setHumidity(next);
  };

  const updateCaliber = (index: number, value: number) => {
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

    const inspection = await createInspection.mutateAsync({
      reception_id: reception.id,
      inspector_name: inspectorName.trim(),
      sampling_method: "3 mesures humidite + 10 mesures calibre",
      nb_samples: 10,
    });

    setInspectionId(inspection.id);
    setPhase("inspection");
  };

  const isOverriding = !!overrideDecision && overrideDecision !== score.recommendedDecision;

  const submit = async () => {
    if (!inspectionId) return;
    setSubmitError(null);

    if (selectedDecision === 'REJETE' && selectedNcCodes.length === 0) {
      setSubmitError("Au moins un code NC est requis pour une décision REJETÉ.");
      return;
    }
    if (doubleInspectionRequired && secondaryInspectorName.trim().length < 3) {
      setSubmitError("Le nom du second inspecteur est requis (lot > 10 tonnes — RG-Q05).");
      return;
    }
    if (labSampleRequired && labAnalyses.length === 0) {
      setSubmitError("Sélectionnez au moins une analyse laboratoire.");
      return;
    }
    if (labSampleRequired && !labStorageLocation.trim()) {
      setSubmitError("L'emplacement de stockage de l'échantillon est requis.");
      return;
    }
    // RG-Q04: override requires ≥ 20 char justification + 1 photo
    if (isOverriding && comment.trim().length < 20) {
      setSubmitError(`RG-Q04 : justification trop courte (${comment.trim().length}/20 caractères minimum).`);
      return;
    }
    if (isOverriding && overridePhoto.length === 0) {
      setSubmitError("RG-Q04 : une photo justificative est obligatoire pour modifier la décision automatique.");
      return;
    }

    const details = [
      `Humidite moyenne: ${score.humidityAverage}%`,
      `Calibre moyen: ${score.caliberAverage} mm`,
      `Score final: ${score.finalScore}/100`,
      `Classement: ${getQcClassificationLabel(score.classification)}`,
      labSampleRequired ? `Analyses labo: ${labAnalyses.join(", ")}` : null,
      doubleInspectionRequired ? `Second inspecteur: ${secondaryInspectorName}` : null,
      comment.trim() || null,
    ]
      .filter(Boolean)
      .join(" | ");

    await submitDecision.mutateAsync({
      inspectionId,
      decision: selectedDecision,
      comment: details,
      qualitySummary: {
        score: score.finalScore,
        grade: score.classification,
        automaticRejectReasons: score.automaticRejectReasons,
      },
      labSampleRequired,
      labAnalyses,
      labStorageLocation,
      secondaryInspectorName: doubleInspectionRequired ? secondaryInspectorName.trim() : undefined,
      recommendedDecision: score.recommendedDecision,
      overrideJustification: isOverriding ? comment.trim() : undefined,
      overridePhoto: isOverriding && overridePhoto.length > 0 ? overridePhoto[0] : undefined,
      nonconformityCodes: selectedNcCodes.length > 0 ? selectedNcCodes : undefined,
      rqc,
      checkResults: [
        { check_code: "HUM", check_name: "Humidite", severity: "MAJEUR", result: score.humidityScore >= 60 ? "CONFORME" : "NON_CONFORME", note: `${score.humidityAverage}%`, measured_value: String(score.humidityAverage), expected_value: "20-26" },
        { check_code: "CAL", check_name: "Calibre", severity: "MAJEUR", result: score.caliberScore >= 60 ? "CONFORME" : "NON_CONFORME", note: `${score.caliberAverage} mm`, measured_value: String(score.caliberAverage), expected_value: ">= 40" },
        { check_code: "INS", check_name: "Insectes", severity: "CRITIQUE", result: defects.insectsPercent > 5 ? "NON_CONFORME" : "CONFORME", note: `${defects.insectsPercent}%`, measured_value: String(defects.insectsPercent), expected_value: "<= 5" },
        { check_code: "MOLD", check_name: "Moisissure/Fermentation", severity: "CRITIQUE", result: defects.moldPercent > 2 || defects.fermentationPercent > 1 ? "NON_CONFORME" : "CONFORME", note: `M ${defects.moldPercent}% / F ${defects.fermentationPercent}%`, measured_value: `${defects.moldPercent}/${defects.fermentationPercent}`, expected_value: "<= 2 / <= 1" },
        { check_code: "ORG", check_name: "Organoleptique", severity: "MINEUR", result: score.organolepticScore >= 60 ? "CONFORME" : "NON_CONFORME", note: `${score.organolepticAverage}/5`, measured_value: String(score.organolepticAverage), expected_value: ">= 3/5" },
      ],
    });

    setConfirmedDecision(selectedDecision);
    setPhase("confirmed");

    // ── Phase 1 post-QC rule chain (non-blocking — errors are logged, not surfaced) ──
    const supplierId = reception.supplier_id;
    const supplierName = reception.supplier?.name ?? reception.supplier_name_snapshot ?? "";

    // RG-Q09: recalculate supplier quality_score
    recalculateAndSaveSupplierScore(supplierId).then((result) => {
      if (result) {
        // RG-F03: auto-block if rejection rate now exceeds 20 %
        triggerAutoBlockIfNeeded(supplierId, result.rejectionRate).then((blocked) => {
          if (blocked) {
            console.warn(`RG-F03 — Fournisseur ${supplierName} bloqué automatiquement (taux rejet: ${result.rejectionRate}%)`);
          }
        }).catch(console.error);
      }
    }).catch(console.error);

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

  return (
    <Dialog open={open} onOpenChange={closeDialog}>
      <DialogContent className="max-w-6xl h-[92vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Controle qualite entrant - {reception.reception_number}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          {phase === "start" && (
            <div className="space-y-4 p-2">
              {/* RG-Q12: reception operator cannot inspect their own lot */}
              {isOwnReceptionInspector && (
                <div
                  className={`flex items-start gap-3 rounded-xl border p-4 text-sm ${
                    canOverrideRoleSeparation
                      ? "border-amber-200 bg-amber-50 text-amber-900"
                      : "border-red-200 bg-red-50 text-red-900"
                  }`}
                >
                  {canOverrideRoleSeparation ? (
                    <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
                  ) : (
                    <XCircle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
                  )}
                  <div>
                    <p className="font-semibold">RG-Q12 — Séparation des rôles</p>
                    {canOverrideRoleSeparation ? (
                      <p className="mt-0.5 text-amber-800">
                        Cette réception a été enregistrée par votre compte. Le contrôle croisé reste recommandé,
                        mais un administrateur peut exceptionnellement démarrer l'inspection.
                      </p>
                    ) : (
                      <p className="mt-0.5 text-red-800">
                        L'opérateur qui a enregistré cette réception ne peut pas en effectuer le contrôle qualité.
                        Veuillez confier l'inspection à un autre inspecteur.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* RG-Q01: QC window alert */}
              {qcWindow.status !== 'ok' && (
                <div className={`flex items-start gap-3 rounded-xl border p-4 text-sm ${
                  qcWindow.status === 'overdue'
                    ? 'border-red-200 bg-red-50 text-red-900'
                    : 'border-amber-200 bg-amber-50 text-amber-900'
                }`}>
                  <Clock className="h-5 w-5 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">
                      RG-Q01 — {qcWindow.status === 'overdue' ? 'Délai dépassé' : 'Délai bientôt dépassé'}
                    </p>
                    <p className="mt-0.5">
                      {qcWindow.hoursElapsed} h écoulées depuis l'arrivée portail.
                      {qcWindow.status === 'overdue'
                        ? " Le délai max de 4 h est dépassé — démarrez l'inspection immédiatement."
                        : " Démarrez l'inspection dans l'heure (délai max: 4 h)."}
                    </p>
                  </div>
                </div>
              )}

              {calibration && !calibration.calibrated && (
                <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
                  <div>
                    <p className="font-semibold">RG-Q08 — Vérification étalonnage</p>
                    <p className="mt-0.5 text-amber-800">
                      Aucun étalonnage enregistré dans les 30 derniers jours. Vérifiez que les instruments (balance, hygromètre, réfractomètre) ont été étalonnés avant de commencer l'inspection.
                    </p>
                  </div>
                </div>
              )}

              <Card>
                <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Fournisseur</p>
                    <p className="font-medium">{reception.supplier?.name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Quantite</p>
                    <p className="font-medium">{reception.quantity_total} {reception.unit}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Variete</p>
                    <p className="font-medium">{reception.variety || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Temperature arrivee</p>
                    <p className="font-medium">{reception.arrival_temperature_c ?? "-"}C</p>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-2">
                <Label>Inspecteur principal *</Label>
                <Input value={inspectorName} onChange={(event) => setInspectorName(event.target.value)} />
              </div>

                {doubleInspectionRequired && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    Lot {" > "} 10 tonnes: une deuxieme validation est demandee par la spec Phase 1.
                  </div>
                )}

              <Button
                onClick={startInspection}
                disabled={
                  !inspectorName.trim() ||
                  createInspection.isPending ||
                  (isOwnReceptionInspector && !canOverrideRoleSeparation)
                }
              >
                <Play className="h-4 w-4 mr-2" />
                {createInspection.isPending ? "Demarrage..." : "Demarrer l'inspection"}
              </Button>
            </div>
          )}

          {phase === "inspection" && (
            <div className="space-y-4 p-2">
              {/* Section switcher — one clear step at a time */}
              <div className="flex w-full flex-wrap gap-1 rounded-xl bg-muted p-1">
                {([
                  ['mesures', '1 · Mesures'],
                  ['defauts', '2 · Défauts & Goût'],
                  ['labo', '3 · Laboratoire'],
                  ['rqc', '4 · Grille RQC'],
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setQcSection(key)}
                    className={`min-h-[40px] flex-1 whitespace-nowrap rounded-lg px-3 text-sm font-medium transition-colors ${
                      qcSection === key
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className={qcSection === 'rqc' ? 'hidden' : 'grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-4'}>
                <div className="min-w-0 space-y-4">
                  <div className={qcSection === 'mesures' ? 'space-y-4' : 'hidden'}>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Humidite</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      {humidity.map((value, index) => (
                        <div key={index} className="space-y-1">
                          <Label>Mesure {index + 1}</Label>
                          <Input
                            type="number"
                            min="10"
                            max="40"
                            step="0.1"
                            value={value}
                            onFocus={(e) => e.target.select()}
                            onChange={(event) => updateHumidity(index, Number(event.target.value))}
                          />
                        </div>
                      ))}
                      <div className="space-y-1">
                        <Label>Moyenne</Label>
                        <Input value={score.humidityAverage} readOnly />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between gap-3">
                        <CardTitle className="text-base">Calibre - 10 mesures (mm)</CardTitle>
                        <div className="flex items-center gap-1.5">
                          <Input
                            type="number"
                            min="20"
                            max="70"
                            step="0.1"
                            placeholder="mm"
                            value={caliberFillValue}
                            onChange={(e) => setCaliberFillValue(e.target.value)}
                            className="h-7 w-20 rounded-lg text-xs"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-9 rounded-lg px-2.5 text-xs"
                            disabled={!caliberFillValue}
                            onClick={() => {
                              const v = Number(caliberFillValue);
                              if (v > 0) setCalibers(Array(10).fill(v));
                            }}
                          >
                            Appliquer à tous
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="grid grid-cols-5 gap-2">
                      {calibers.map((value, index) => (
                        <div key={index} className="space-y-1">
                          <Label className="text-xs text-muted-foreground">L{index + 1}</Label>
                          <Input
                            type="number"
                            min="20"
                            max="70"
                            step="0.1"
                            value={value}
                            onFocus={(e) => e.target.select()}
                            onChange={(event) => updateCaliber(index, Number(event.target.value))}
                            className="h-8 rounded-lg px-2 text-sm"
                          />
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  </div>

                  <div className={qcSection === 'defauts' ? 'space-y-4' : 'hidden'}>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Défauts visuels (%)</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {[
                        ["insectsPercent", "Insectes"],
                        ["moldPercent", "Moisissure"],
                        ["fermentationPercent", "Fermentation"],
                        ["mechanicalDamagePercent", "Dégâts mécaniques"],
                        ["crystallizationPercent", "Cristallisation"],
                        ["discolorationPercent", "Décoloration"],
                      ].map(([field, label]) => (
                        <div key={field} className="space-y-1">
                          <Label className="text-xs">{label}</Label>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            value={defects[field as keyof typeof defects]}
                            onFocus={(e) => e.target.select()}
                            onChange={(event) =>
                              setDefects((current) => ({
                                ...current,
                                [field]: Number(event.target.value),
                              }))
                            }
                            className="h-9"
                          />
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Organoleptique</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {[
                        ["tasteScore", "Goût"],
                        ["textureScore", "Texture"],
                        ["appearanceScore", "Apparence"],
                      ].map(([field, label]) => {
                        const current = organoleptic[field as keyof typeof organoleptic];
                        return (
                          <div key={field} className="space-y-1.5">
                            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              {label}
                            </Label>
                            <div className="flex gap-1">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                  key={star}
                                  type="button"
                                  onClick={() => setOrganoleptic((prev) => ({ ...prev, [field]: star }))}
                                  className={`flex-1 rounded-lg border-2 py-1.5 text-center text-xs font-bold transition-all ${
                                    star <= current
                                      ? 'border-amber-400 bg-amber-400 text-white'
                                      : 'border-border text-muted-foreground hover:border-amber-300 hover:text-amber-500'
                                  }`}
                                >
                                  {star}
                                </button>
                              ))}
                            </div>
                            <p className="text-center text-[11px] text-muted-foreground">{current}/5</p>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>

                  </div>

                  <div className={qcSection === 'labo' ? 'space-y-4' : 'hidden'}>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <FlaskConical className="h-4 w-4" />
                        Echantillon laboratoire
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={labSampleRequired}
                          onCheckedChange={(checked) => setLabSampleRequired(Boolean(checked))}
                        />
                        <span className="text-sm">
                          Prelevement labo {labRequiredByRule ? "obligatoire" : "optionnel"}
                        </span>
                      </div>
                      {labSampleRequired && (
                        <>
                          <div className="flex flex-wrap gap-2">
                            {["Pesticides", "Metaux lourds", "Aflatoxines", "Microbiologie"].map((analysis) => (
                              <Button
                                key={analysis}
                                type="button"
                                size="sm"
                                variant={labAnalyses.includes(analysis) ? "default" : "outline"}
                                onClick={() => toggleAnalysis(analysis)}
                              >
                                {analysis}
                              </Button>
                            ))}
                          </div>
                          <div className="space-y-1">
                            <Label>Emplacement stockage echantillon</Label>
                            <Input value={labStorageLocation} onChange={(event) => setLabStorageLocation(event.target.value)} />
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                  </div>
                </div>

                <div className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Resultat automatique</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Score final</span>
                        <span className="text-2xl font-semibold">{score.finalScore}/100</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Classement</span>
                        <Badge variant="outline">{getQcClassificationLabel(score.classification)}</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Decision proposee</span>
                        <Badge variant={score.recommendedDecision === "REJETE" ? "destructive" : "secondary"}>
                          {getQcDecisionLabel(score.recommendedDecision)}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-lg border p-2">Humidite: {score.humidityScore}</div>
                        <div className="rounded-lg border p-2">Calibre: {score.caliberScore}</div>
                        <div className="rounded-lg border p-2">Insectes: {score.insectsScore}</div>
                        <div className="rounded-lg border p-2">Moisi/Ferment: {score.moldFermentationScore}</div>
                        <div className="rounded-lg border p-2">Organo: {score.organolepticScore}</div>
                        <div className="rounded-lg border p-2">Autres: {score.otherDefectsScore}</div>
                      </div>
                    </CardContent>
                  </Card>

                  {score.automaticReject && (
                    <Card className="border-red-200 bg-red-50">
                      <CardContent className="p-4 space-y-2 text-sm text-red-900">
                        <div className="flex items-center gap-2 font-medium">
                          <AlertTriangle className="h-4 w-4" />
                          Rejet automatique
                        </div>
                        {score.automaticRejectReasons.map((reason) => (
                          <div key={reason}>{reason}</div>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {doubleInspectionRequired && (
                    <div className="space-y-1">
                      <Label>Deuxieme inspecteur *</Label>
                      <Input
                        value={secondaryInspectorName}
                        onChange={(event) => setSecondaryInspectorName(event.target.value)}
                        placeholder="Nom du second inspecteur"
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Modifier la décision (RG-Q04)</Label>
                    <div className="flex flex-wrap gap-2">
                      {(["ACCEPTE", "QUARANTAINE", "REJETE"] as QCDecisionType[]).map((decision) => (
                        <Button
                          key={decision}
                          type="button"
                          size="sm"
                          variant={selectedDecision === decision ? "default" : "outline"}
                          className={decision === score.recommendedDecision ? "ring-2 ring-primary/30" : ""}
                          onClick={() => {
                            setOverrideDecision(decision === score.recommendedDecision ? null : decision);
                            setSubmitError(null);
                          }}
                        >
                          {decision}
                          {decision === score.recommendedDecision && (
                            <span className="ml-1 text-[11px] opacity-60">auto</span>
                          )}
                        </Button>
                      ))}
                    </div>

                    {isOverriding && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-3 text-sm text-amber-900">
                        <p className="font-medium">⚠ RG-Q04 — Override actif : justification + photo obligatoires</p>
                        <p className="text-xs">
                          Vous modifiez la décision automatique ({score.recommendedDecision} → {overrideDecision}).
                          Une justification d'au moins 20 caractères et une photo sont requises.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label>
                        {isOverriding ? "Justification override *" : "Observations"}
                      </Label>
                      {isOverriding && (
                        <span className={`text-xs tabular-nums ${comment.trim().length >= 20 ? "text-emerald-600" : "text-amber-600"}`}>
                          {comment.trim().length}/20
                        </span>
                      )}
                    </div>
                    <Textarea
                      value={comment}
                      onChange={(event) => { setComment(event.target.value); setSubmitError(null); }}
                      rows={4}
                      className={isOverriding && comment.trim().length < 20 ? "border-amber-300 focus-visible:ring-amber-300" : ""}
                      placeholder={isOverriding ? "Décrivez précisément pourquoi vous modifiez la décision automatique..." : "Observations, anomalies, remarques..."}
                    />
                  </div>

                  {/* RG-Q04 override photo */}
                  {isOverriding && (
                    <div className="space-y-2">
                      <Label>Photo justificative * (RG-Q04)</Label>
                      <PhotoCapture
                        photos={overridePhoto}
                        onPhotosChange={setOverridePhoto}
                        maxPhotos={1}
                      />
                    </div>
                  )}

                  {/* NC codes — mandatory when REJETE, optional for QUARANTAINE */}
                  {(selectedDecision === 'REJETE' || selectedDecision === 'QUARANTAINE') && (
                    <Card className={selectedDecision === 'REJETE' ? 'border-red-200' : 'border-orange-200'}>
                      <CardHeader className="pb-2 pt-3 px-4">
                        <CardTitle className="text-sm flex items-center gap-2">
                          Codes non-conformité
                          {selectedDecision === 'REJETE' && (
                            <Badge variant="destructive" className="text-[0.6rem]">obligatoire</Badge>
                          )}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-4 pb-3 space-y-2">
                        {autoSuggestedNcs.length > 0 && (
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs text-muted-foreground">Auto-suggérés:</span>
                            {autoSuggestedNcs.map((nc) => (
                              <button
                                key={nc.code}
                                type="button"
                                className="text-xs underline text-primary"
                                onClick={() => setSelectedNcCodes((prev) =>
                                  prev.includes(nc.code) ? prev : [...prev, nc.code]
                                )}
                              >
                                {nc.code}
                              </button>
                            ))}
                          </div>
                        )}
                        <div className="grid grid-cols-1 gap-1.5 max-h-40 overflow-y-auto pr-1">
                          {QC_NC_CODES.map((nc) => (
                            <label
                              key={nc.code}
                              className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs cursor-pointer transition-colors ${
                                selectedNcCodes.includes(nc.code)
                                  ? NC_SEVERITY_COLORS[nc.severity]
                                  : 'border-border hover:bg-muted/40'
                              }`}
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
                              <span className="font-mono font-medium">{nc.code}</span>
                              <span className="text-muted-foreground">{nc.label}</span>
                              <Badge variant="outline" className="ml-auto text-[0.55rem] shrink-0">
                                {nc.severity}
                              </Badge>
                            </label>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Validation errors are shown in the dialog footer — see DialogFooter below */}
                </div>
              </div>

              {/* ── RQC — Rapport Contrôle Qualité Réception Achat ── */}
              <Card className={qcSection === 'rqc' ? '' : 'hidden'}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Grille Contrôle Qualité (RQC)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Certification row */}
                  <div className="flex flex-wrap gap-4 text-sm">
                    {[
                      { key: 'conventionnel', label: 'Conventionnel' },
                      { key: 'bio_certifie', label: 'TN-Bio 001' },
                      { key: 'ggp', label: 'GGP' },
                    ].map(({ key, label }) => (
                      <label key={key} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={rqc[key as 'conventionnel'|'bio_certifie'|'ggp']}
                          onCheckedChange={(v) => setRqc(p => ({ ...p, [key]: Boolean(v) }))}
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                    <div className="ml-auto flex items-center gap-4">
                      <span className="text-xs text-muted-foreground font-medium">Type dattes :</span>
                      {[['type_dattes_branche','Branche'],['type_dattes_vrac','Vrac']].map(([key,label]) => (
                        <label key={key} className="flex items-center gap-1 cursor-pointer text-sm">
                          <Checkbox
                            checked={rqc[key as 'type_dattes_branche'|'type_dattes_vrac']}
                            onCheckedChange={(v) => setRqc(p => ({ ...p, [key]: Boolean(v) }))}
                          />
                          <span>{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Poids */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[
                      { key: 'poids_echantillon_branche_kg', label: 'Poids Ech. (kg)' },
                      { key: 'poids_tb_kg', label: 'Poids T.B. (kg)' },
                      { key: 'taux_tb_percent', label: '% T.B.' },
                      { key: 'poids_vrac_kg', label: 'VRAC (kg)' },
                    ].map(({ key, label }) => (
                      <div key={key} className="space-y-1">
                        <Label className="text-xs">{label}</Label>
                        <Input
                          type="number" min="0" step="0.1" className="h-10"
                          value={(rqc[key as keyof RQCData] as number | null) ?? ''}
                          onChange={e => setRqc(p => ({ ...p, [key]: e.target.value === '' ? null : Number(e.target.value) }))}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Criteria table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-700 text-white">
                          <th className="border border-slate-600 px-2 py-1 text-left min-w-[100px]">Critères</th>
                          <th className="border border-slate-600 px-2 py-1">TEST 1 (%)</th>
                          <th className="border border-slate-600 px-2 py-1">TEST 2 (%)</th>
                          <th className="border border-slate-600 px-2 py-1">TEST 3 (%)</th>
                          <th className="border border-slate-600 px-2 py-1">Taux Moy.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {([
                          { field: 'infestee' as RqcCritereKey, label: 'Infestée', highlight: true },
                          { field: 'fermentee' as RqcCritereKey, label: 'Fermentée', highlight: true },
                          { field: 'immature' as RqcCritereKey, label: 'Immature', highlight: true },
                          { field: 'craquellee' as RqcCritereKey, label: 'Craquelée', highlight: true },
                          { field: 'grasse' as RqcCritereKey, label: 'Grasse', highlight: false },
                          { field: 'seche' as RqcCritereKey, label: 'Sèche', highlight: false },
                          { field: 'tachee' as RqcCritereKey, label: 'Tachée', highlight: false },
                          { field: 'ridee' as RqcCritereKey, label: 'Ridée', highlight: false },
                          { field: 'petit_calibre' as RqcCritereKey, label: 'Petit calibre', highlight: false },
                        ] as { field: RqcCritereKey; label: string; highlight: boolean }[]).map(({ field, label, highlight }) => (
                          <tr key={field} className={highlight ? 'bg-amber-50' : ''}>
                            <td className="border border-slate-300 px-2 py-0.5 font-medium">{label}</td>
                            {(['test1','test2','test3'] as const).map(t => (
                              <td key={t} className="border border-slate-300 p-0.5">
                                <Input
                                  type="number" min="0" max="100" step="0.1"
                                  className="h-6 text-xs px-1 border-0 focus-visible:ring-1"
                                  value={rqc[field][t] ?? ''}
                                  onChange={e => updateRqcCritere(field, t, e.target.value === '' ? null : Number(e.target.value))}
                                />
                              </td>
                            ))}
                            <td className="border border-slate-300 px-2 py-0.5 text-center font-bold">
                              {rqc[field].taux_moyen != null ? `${rqc[field].taux_moyen}%` : '—'}
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-yellow-100 font-bold">
                          <td className="border border-slate-300 px-2 py-1">Taux déchet</td>
                          <td colSpan={3} className="border border-slate-300 px-2 py-1 text-xs text-muted-foreground">= infestée + fermentée + immature + craquelée</td>
                          <td className="border border-slate-300 px-2 py-1 text-center">
                            {(() => {
                              const vals = [rqc.infestee, rqc.fermentee, rqc.immature, rqc.craquellee]
                                .map(c => c.taux_moyen)
                                .filter((v): v is number => v != null);
                              return vals.length ? `${Math.round(vals.reduce((a,b)=>a+b,0)*10)/10}%` : '—';
                            })()}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Conclusion */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div className="space-y-1 md:col-span-2">
                      <Label className="text-xs">Conclusion</Label>
                      <Input className="h-10" value={rqc.conclusion ?? ''} onChange={e => setRqc(p => ({ ...p, conclusion: e.target.value || null }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Endommagé (%)</Label>
                      <Input type="number" min="0" max="100" step="0.1" className="h-10"
                        value={rqc.endommage_percent ?? ''}
                        onChange={e => setRqc(p => ({ ...p, endommage_percent: e.target.value === '' ? null : Number(e.target.value) }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">DB</Label>
                      <Input className="h-10" value={rqc.db_score ?? ''}
                        onChange={e => setRqc(p => ({ ...p, db_score: e.target.value || null }))}
                      />
                    </div>
                  </div>

                  {/* Signatures */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: 'responsable_qc1', label: 'Responsable QC 1' },
                      { key: 'responsable_qc2', label: 'Responsable QC 2' },
                      { key: 'directeur_qc', label: 'Directeur QC' },
                    ].map(({ key, label }) => (
                      <div key={key} className="space-y-1">
                        <Label className="text-xs">{label}</Label>
                        <Input className="h-10"
                          value={(rqc[key as keyof RQCData] as string | null) ?? ''}
                          onChange={e => setRqc(p => ({ ...p, [key]: e.target.value || null }))}
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {phase === "confirmed" && confirmedDecision && (
            <div className="space-y-4 p-4 text-center">
              <div className="flex justify-center">
                {confirmedDecision === "ACCEPTE" ? (
                  <CheckCircle className="h-16 w-16 text-green-600" />
                ) : confirmedDecision === "QUARANTAINE" ? (
                  <AlertTriangle className="h-16 w-16 text-orange-600" />
                ) : (
                  <XCircle className="h-16 w-16 text-red-600" />
                )}
              </div>
              <div>
                <h3 className="text-xl font-semibold">{confirmedDecision}</h3>
                <p className="text-muted-foreground">
                  Score final {score.finalScore}/100 - {getQcClassificationLabel(score.classification)}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
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
                <Printer className="h-4 w-4 mr-2" />
                Imprimer RQC
              </Button>
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-t pt-4">
          {/* Validation error — always visible regardless of scroll position */}
          {submitError && phase === "inspection" && (
            <p className="flex-1 text-sm text-red-600">{submitError}</p>
          )}
          <div className="flex gap-2 justify-end w-full sm:w-auto">
            <Button variant="outline" onClick={closeDialog}>
              {phase === "confirmed" ? "Fermer" : "Annuler"}
            </Button>
            {phase === "inspection" && (
              <Button onClick={submit} disabled={submitDecision.isPending}>
                {submitDecision.isPending ? "Validation en cours..." : "Valider la décision QC"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
