import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Plus, Trash2, ArrowLeft, ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BonReceptionAchat, BonStatut, BranchLine, BranchSeche, CasseLine, Region } from "@/types/bonReceptionAchat";
import { useSuppliers } from "@/hooks/useSuppliers";
import type { Supplier } from "@/types/mes";

interface Props {
  initial?: Partial<BonReceptionAchat>;
  onSubmit: (data: Partial<BonReceptionAchat>) => void;
  isSaving: boolean;
}

type CasseRow = CasseLine & { _key: string };

const emptyBranch = (): BranchLine => ({
  gc: null, rp: null, gcm: null, l: null,
  poid_brut: null, poid_net: null, nbre_palette: null, observation: null,
});

const emptyBranchSeche = (): BranchSeche => ({
  ...emptyBranch(), nbre_palette_ajout: null, nbre_palette_retrait: null,
});

const toNum = (v: string) => (v === "" ? null : Number(v));


const STEPS = ["Qui & Quand", "Quantités reçues", "Terminer"] as const;

const StepIndicator = ({ current }: { current: number }) => (
  <div className="flex items-center gap-0">
    {STEPS.map((label, i) => {
      const done    = i < current;
      const active  = i === current;
      const isLast  = i === STEPS.length - 1;
      return (
        <div key={label} className="flex items-center">
          {/* Circle */}
          <div className="flex flex-col items-center gap-1">
            <div
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-bold transition-all",
                done   && "border-emerald-500 bg-emerald-500 text-white",
                active && "border-primary bg-primary text-white",
                !done && !active && "border-border bg-background text-muted-foreground",
              )}
            >
              {done ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <span
              className={cn(
                "text-xs font-medium whitespace-nowrap",
                active ? "text-primary" : done ? "text-emerald-600" : "text-muted-foreground",
              )}
            >
              {label}
            </span>
          </div>
          {/* Connector */}
          {!isLast && (
            <div
              className={cn(
                "mx-2 mb-5 h-0.5 w-10 transition-colors sm:w-16",
                i < current ? "bg-emerald-400" : "bg-border",
              )}
            />
          )}
        </div>
      );
    })}
  </div>
);

// ── BranchSection ─────────────────────────────────────────────────────────────

const BRANCH_FIELD_LABELS: Record<string, string> = {
  gc:        "GC",
  rp:        "RP",
  gcm:       "GCM",
  l:         "L",
  poid_brut: "Poids brut",
  poid_net:  "Poids net",
};

const BranchSection = ({
  id: sectionId,
  title,
  value,
  onChange,
  withPaletteAjout,
}: {
  id: string;
  title: string;
  value: BranchLine | BranchSeche;
  onChange: (v: BranchLine | BranchSeche) => void;
  withPaletteAjout?: boolean;
}) => {
  const set = (field: string, raw: string) => onChange({ ...value, [field]: toNum(raw) });

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-foreground">{title}</h4>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        {(["gc", "rp", "gcm", "l", "poid_brut", "poid_net"] as const).map((field) => {
          const inputId = `${sectionId}-${field}`;
          return (
            <div key={field}>
              <Label htmlFor={inputId} className="text-[13px] font-medium text-muted-foreground">
                {BRANCH_FIELD_LABELS[field]}
              </Label>
              <Input
                id={inputId}
                type="number"
                inputMode="decimal"
                step="0.01"
                placeholder="—"
                value={(value[field as keyof BranchLine] as number | null) ?? ""}
                onChange={(e) => set(field, e.target.value)}
                className="mt-1"
              />
            </div>
          );
        })}
      </div>
      {withPaletteAjout ? (
        <div className="flex gap-3">
          <div className="flex-1">
            <Label htmlFor={`${sectionId}-ajout`} className="text-[13px]">Palette ajout (+)</Label>
            <Input
              id={`${sectionId}-ajout`}
              type="number"
              value={(value as BranchSeche).nbre_palette_ajout ?? ""}
              onChange={(e) => onChange({ ...value, nbre_palette_ajout: toNum(e.target.value) } as BranchSeche)}
              className="h-8 text-sm"
            />
          </div>
          <div className="flex-1">
            <Label htmlFor={`${sectionId}-retrait`} className="text-[13px]">Palette retrait (−)</Label>
            <Input
              id={`${sectionId}-retrait`}
              type="number"
              value={(value as BranchSeche).nbre_palette_retrait ?? ""}
              onChange={(e) => onChange({ ...value, nbre_palette_retrait: toNum(e.target.value) } as BranchSeche)}
              className="h-8 text-sm"
            />
          </div>
          <div className="flex-1">
            <Label htmlFor={`${sectionId}-obs`} className="text-[13px]">Observation</Label>
            <Input
              id={`${sectionId}-obs`}
              value={value.observation ?? ""}
              onChange={(e) => onChange({ ...value, observation: e.target.value || null })}
              className="h-8 text-sm"
            />
          </div>
        </div>
      ) : (
        <div className="flex gap-3">
          <div className="flex-1">
            <Label htmlFor={`${sectionId}-palette`} className="text-[13px]">Nbre palette</Label>
            <Input
              id={`${sectionId}-palette`}
              type="number"
              value={value.nbre_palette ?? ""}
              onChange={(e) => onChange({ ...value, nbre_palette: toNum(e.target.value) })}
              className="h-8 text-sm"
            />
          </div>
          <div className="flex-[2]">
            <Label htmlFor={`${sectionId}-obs`} className="text-[13px]">Observation</Label>
            <Input
              id={`${sectionId}-obs`}
              value={value.observation ?? ""}
              onChange={(e) => onChange({ ...value, observation: e.target.value || null })}
              className="h-8 text-sm"
            />
          </div>
        </div>
      )}
    </div>
  );
};

// ── Main form ─────────────────────────────────────────────────────────────────

export function BonReceptionAchatForm({ initial, onSubmit, isSaving }: Props) {
  const { data: suppliers = [] } = useSuppliers({ enabled: true });
  const today = new Date().toISOString().slice(0, 10);

  // ── State ─────────────────────────────────────────────────────────────────
  const [step, setStep] = useState(0);

  const [convention,            setConvention]            = useState(initial?.convention ?? false);
  const [bioCertifie,           setBioCertifie]           = useState(initial?.bio_certifie ?? false);
  const [annee,                 setAnnee]                 = useState(String(initial?.annee ?? new Date().getFullYear()));
  const [region,                setRegion]                = useState<string>(initial?.region ?? "kebilli");
  const [fournisseurId,         setFournisseurId]         = useState(initial?.fournisseur_id ?? "");
  const [fournisseurNom,        setFournisseurNom]        = useState(initial?.fournisseur_nom ?? "");
  const [numeroExpedition,      setNumeroExpedition]      = useState(initial?.numero_expedition ?? "");
  const [lieuExpedition,        setLieuExpedition]        = useState(initial?.lieu_expedition ?? "");
  const [numeroFacture,         setNumeroFacture]         = useState(initial?.numero_facture ?? "");
  const [dateReception,         setDateReception]         = useState(initial?.date_reception ?? today);
  const [heureArrivee,          setHeureArrivee]          = useState(initial?.heure_arrivee ?? "");
  const [numeroLot,             setNumeroLot]             = useState(initial?.numero_lot ?? "");
  const [numeroCamion,          setNumeroCamion]          = useState(initial?.numero_camion ?? "");
  const [nomChauffeur,          setNomChauffeur]          = useState(initial?.nom_chauffeur ?? "");
  const [lieuReception,         setLieuReception]         = useState(initial?.lieu_reception ?? "");
  const [responsableReception,  setResponsableReception]  = useState(initial?.responsable_reception ?? "");
  const [numeroRapportQcr,      setNumeroRapportQcr]      = useState(initial?.numero_rapport_qcr ?? "");
  const [numeroFichePalette,    setNumeroFichePalette]    = useState(initial?.numero_fiche_palette ?? "");

  const [branche1,     setBranche1]     = useState<BranchLine>(initial?.branche_premiere ?? emptyBranch());
  const [branche2,     setBranche2]     = useState<BranchLine>(initial?.branche_deuxieme ?? emptyBranch());
  const [vrac,         setVrac]         = useState<BranchLine>(initial?.vrac             ?? emptyBranch());
  const [brancheSeche, setBrancheSeche] = useState<BranchSeche>(initial?.branche_seche  ?? emptyBranchSeche());

  const [casse, setCasse] = useState<CasseRow[]>(() =>
    (initial?.casse ?? []).map((c) => ({ ...c, _key: crypto.randomUUID() })),
  );
  const [statut, setStatut] = useState<string>(initial?.statut ?? "brouillon");
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (!fournisseurId) return;
    const sup = (suppliers as Supplier[]).find((s) => s.id === fournisseurId);
    if (sup) setFournisseurNom(sup.name);
  }, [fournisseurId, suppliers]);

  const addCasse = () =>
    setCasse((c) => [...c, { nature: "", quantite: null, _key: crypto.randomUUID() }]);

  const removeCasse = (key: string) =>
    setCasse((c) => c.filter((row) => row._key !== key));

  const updateCasse = (key: string, field: "nature" | "quantite", val: string) =>
    setCasse((c) =>
      c.map((row) =>
        row._key !== key
          ? row
          : { ...row, [field]: field === "quantite" ? toNum(val) : val },
      ),
    );

  const handleSubmit = () => {
    onSubmit({
      annee: Number(annee),
      convention,
      bio_certifie: bioCertifie,
      region: region as Region,
      fournisseur_id:         fournisseurId       || null,
      fournisseur_nom:        fournisseurNom      || null,
      numero_expedition:      numeroExpedition    || null,
      lieu_expedition:        lieuExpedition      || null,
      numero_facture:         numeroFacture       || null,
      date_reception:         dateReception,
      heure_arrivee:          heureArrivee        || null,
      numero_lot:             numeroLot           || null,
      numero_camion:          numeroCamion        || null,
      nom_chauffeur:          nomChauffeur        || null,
      lieu_reception:         lieuReception       || null,
      responsable_reception:  responsableReception || null,
      numero_rapport_qcr:     numeroRapportQcr    || null,
      numero_fiche_palette:   numeroFichePalette  || null,
      branche_premiere: branche1,
      branche_deuxieme: branche2,
      vrac,
      branche_seche: brancheSeche,
      casse: casse.map(({ _key: _, ...c }) => c),
      statut: statut as BonStatut,
    });
  };

  // ── Step content ──────────────────────────────────────────────────────────

  const renderStep = () => {
    // ── Étape 1 : Identification ──────────────────────────────────────────
    if (step === 0) return (
      <div className="space-y-4">
        <div>
          <Label htmlFor="f-fournisseur" className="text-[13px]">Fournisseur</Label>
          <Select value={fournisseurId} onValueChange={setFournisseurId}>
            <SelectTrigger id="f-fournisseur" className="mt-1">
              <SelectValue placeholder="Choisir un fournisseur…" />
            </SelectTrigger>
            <SelectContent>
              {(suppliers as Supplier[]).map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="f-date" className="text-[13px]">Date de réception</Label>
            <Input id="f-date" type="date" value={dateReception} onChange={(e) => setDateReception(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="f-lot" className="text-[13px]">N° de Lot</Label>
            <Input id="f-lot" value={numeroLot} onChange={(e) => setNumeroLot(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="f-region" className="text-[13px]">Région</Label>
            <Select value={region} onValueChange={setRegion}>
              <SelectTrigger id="f-region" className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="el_jirid">El Jirid</SelectItem>
                <SelectItem value="kebilli">Kebilli</SelectItem>
                <SelectItem value="autre">Autre</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="f-statut" className="text-[13px]">Statut</Label>
            <Select value={statut} onValueChange={setStatut}>
              <SelectTrigger id="f-statut" className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="brouillon">Brouillon</SelectItem>
                <SelectItem value="valide">Validé</SelectItem>
                <SelectItem value="annule">Annulé</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Optional admin details */}
        <Collapsible open={showDetails} onOpenChange={setShowDetails}>
          <CollapsibleTrigger asChild>
            <button type="button" className="flex min-h-[44px] items-center gap-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors mt-1">
              <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", showDetails && "rotate-180")} />
              {showDetails ? "Masquer les détails" : "Ajouter des détails administratifs"}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 pt-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="f-annee" className="text-[13px]">Année</Label>
                <Input id="f-annee" value={annee} onChange={(e) => setAnnee(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="f-heure" className="text-[13px]">Heure arrivée</Label>
                <Input id="f-heure" type="time" value={heureArrivee} onChange={(e) => setHeureArrivee(e.target.value)} className="mt-1" />
              </div>
            </div>
            <div className="flex gap-6">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox checked={convention} onCheckedChange={(c) => setConvention(!!c)} />
                Convention
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox checked={bioCertifie} onCheckedChange={(c) => setBioCertifie(!!c)} />
                TN-Bio-001
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="f-expedition" className="text-[13px]">N° Bon d&apos;expédition</Label>
                <Input id="f-expedition" value={numeroExpedition} onChange={(e) => setNumeroExpedition(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="f-lieu-exp" className="text-[13px]">Lieu expédition</Label>
                <Input id="f-lieu-exp" value={lieuExpedition} onChange={(e) => setLieuExpedition(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="f-fournisseur-nom" className="text-[13px]">Nom fournisseur (libre)</Label>
                <Input id="f-fournisseur-nom" value={fournisseurNom} onChange={(e) => setFournisseurNom(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="f-facture" className="text-[13px]">N° Facture</Label>
                <Input id="f-facture" value={numeroFacture} onChange={(e) => setNumeroFacture(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="f-camion" className="text-[13px]">N° Camion</Label>
                <Input id="f-camion" value={numeroCamion} onChange={(e) => setNumeroCamion(e.target.value)} placeholder="ex. 71 74 9032" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="f-chauffeur" className="text-[13px]">Chauffeur</Label>
                <Input id="f-chauffeur" value={nomChauffeur} onChange={(e) => setNomChauffeur(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="f-lieu-rec" className="text-[13px]">Lieu de réception</Label>
                <Input id="f-lieu-rec" value={lieuReception} onChange={(e) => setLieuReception(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="f-responsable" className="text-[13px]">Responsable réception</Label>
                <Input id="f-responsable" value={responsableReception} onChange={(e) => setResponsableReception(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="f-qcr" className="text-[13px]">N° Rapport QCR</Label>
                <Input id="f-qcr" value={numeroRapportQcr} onChange={(e) => setNumeroRapportQcr(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="f-palette" className="text-[13px]">N° Fiche palette</Label>
                <Input id="f-palette" value={numeroFichePalette} onChange={(e) => setNumeroFichePalette(e.target.value)} className="mt-1" />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    );

    // ── Étape 2 : Quantités ───────────────────────────────────────────────
    if (step === 1) return (
      <div className="space-y-5">
        <BranchSection id="b1" title="Branche 1ère"  value={branche1}     onChange={setBranche1} />
        <Separator />
        <BranchSection id="b2" title="Branche 2ème"  value={branche2}     onChange={setBranche2} />
        <Separator />
        <BranchSection id="vr" title="Vrac"           value={vrac}         onChange={setVrac} />
        <Separator />
        <BranchSection id="bs" title="Branche Sèche"  value={brancheSeche} onChange={(v) => setBrancheSeche(v as BranchSeche)} withPaletteAjout />
      </div>
    );

    // ── Étape 3 : Finaliser ───────────────────────────────────────────────
    return (
      <div className="space-y-4">
        {/* Recap */}
        <div className="rounded-xl border bg-muted/30 px-4 py-3 space-y-1 text-sm">
          <p className="font-medium text-foreground">Récapitulatif</p>
          <p className="text-muted-foreground">
            <span className="text-foreground font-medium">{fournisseurNom || "Fournisseur non renseigné"}</span>
            {" · "}{dateReception}
            {numeroLot ? ` · Lot ${numeroLot}` : ""}
          </p>
        </div>

        {/* Casse */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">Casse</h4>
            <Button variant="outline" size="sm" onClick={addCasse} className="gap-1.5">
              <Plus className="h-4 w-4" /> Ajouter
            </Button>
          </div>
          {casse.length === 0 && (
            <p className="text-xs text-muted-foreground">Aucune casse à signaler.</p>
          )}
          {casse.map((row) => (
            <div key={row._key} className="flex items-end gap-2">
              <div className="flex-1">
                <Label htmlFor={`casse-nature-${row._key}`} className="text-[13px]">Nature</Label>
                <Input
                  id={`casse-nature-${row._key}`}
                  value={row.nature}
                  onChange={(e) => updateCasse(row._key, "nature", e.target.value)}
                  className="h-8 text-sm mt-1"
                />
              </div>
              <div className="w-28">
                <Label htmlFor={`casse-qty-${row._key}`} className="text-[13px]">Quantité</Label>
                <Input
                  id={`casse-qty-${row._key}`}
                  type="number"
                  value={row.quantite ?? ""}
                  onChange={(e) => updateCasse(row._key, "quantite", e.target.value)}
                  className="h-8 text-sm mt-1"
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeCasse(row._key)}
                className="h-11 w-11 p-0 text-destructive"
                aria-label="Supprimer cette ligne"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col gap-4">

      {/* Step indicator — fixed at top */}
      <div className="flex justify-center pt-1">
        <StepIndicator current={step} />
      </div>

      {/* Scrollable content area */}
      <ScrollArea className="flex-1 pr-4">
        <div className="pb-2">
          {renderStep()}
        </div>
      </ScrollArea>

      {/* Navigation — fixed at bottom */}
      <div className="flex items-center gap-3 border-t pt-3">
        {step > 0 ? (
          <Button variant="outline" onClick={() => setStep(s => s - 1)} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Précédent
          </Button>
        ) : (
          <div className="flex-1" />
        )}

        <div className="flex-1" />

        {step < STEPS.length - 1 ? (
          <Button onClick={() => setStep(s => s + 1)} className="gap-2">
            Suivant <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={isSaving} className="gap-2">
            {isSaving ? "Enregistrement…" : (
              <>{initial?.id ? "Mettre à jour" : "Créer le bon"} <Check className="h-4 w-4" /></>
            )}
          </Button>
        )}
      </div>

    </div>
  );
}
