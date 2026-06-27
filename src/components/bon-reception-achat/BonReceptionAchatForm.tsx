import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Trash2 } from "lucide-react";
import type { BonReceptionAchat, BonStatut, BranchLine, BranchSeche, CasseLine, Region } from "@/types/bonReceptionAchat";
import { useSuppliers } from "@/hooks/useSuppliers";
import type { Supplier } from "@/types/mes";

interface Props {
  initial?: Partial<BonReceptionAchat>;
  onSubmit: (data: Partial<BonReceptionAchat>) => void;
  isSaving: boolean;
}

// Casse rows carry a client-side stable key so React can diff correctly
// when items are removed from the middle of the list.
type CasseRow = CasseLine & { _key: string };

const emptyBranch = (): BranchLine => ({
  gc: null, rp: null, gcm: null, l: null,
  poid_brut: null, poid_net: null, nbre_palette: null, observation: null,
});

const emptyBranchSeche = (): BranchSeche => ({
  ...emptyBranch(), nbre_palette_ajout: null, nbre_palette_retrait: null,
});

const toNum = (v: string) => (v === "" ? null : Number(v));

// ── BranchSection ─────────────────────────────────────────────────────────────

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
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {(["gc", "rp", "gcm", "l", "poid_brut", "poid_net"] as const).map((field) => {
          const inputId = `${sectionId}-${field}`;
          return (
            <div key={field}>
              <Label htmlFor={inputId} className="text-xs uppercase text-muted-foreground">
                {field.replace("_", " ")}
              </Label>
              <Input
                id={inputId}
                type="number"
                step="0.01"
                placeholder="—"
                value={(value[field as keyof BranchLine] as number | null) ?? ""}
                onChange={(e) => set(field, e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          );
        })}
      </div>
      {withPaletteAjout ? (
        <div className="flex gap-3">
          <div className="flex-1">
            <Label htmlFor={`${sectionId}-ajout`} className="text-xs">Palette ajout (+)</Label>
            <Input
              id={`${sectionId}-ajout`}
              type="number"
              value={(value as BranchSeche).nbre_palette_ajout ?? ""}
              onChange={(e) => onChange({ ...value, nbre_palette_ajout: toNum(e.target.value) } as BranchSeche)}
              className="h-8 text-sm"
            />
          </div>
          <div className="flex-1">
            <Label htmlFor={`${sectionId}-retrait`} className="text-xs">Palette retrait (−)</Label>
            <Input
              id={`${sectionId}-retrait`}
              type="number"
              value={(value as BranchSeche).nbre_palette_retrait ?? ""}
              onChange={(e) => onChange({ ...value, nbre_palette_retrait: toNum(e.target.value) } as BranchSeche)}
              className="h-8 text-sm"
            />
          </div>
          <div className="flex-1">
            <Label htmlFor={`${sectionId}-obs`} className="text-xs">Observation</Label>
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
            <Label htmlFor={`${sectionId}-palette`} className="text-xs">Nbre palette</Label>
            <Input
              id={`${sectionId}-palette`}
              type="number"
              value={value.nbre_palette ?? ""}
              onChange={(e) => onChange({ ...value, nbre_palette: toNum(e.target.value) })}
              className="h-8 text-sm"
            />
          </div>
          <div className="flex-[2]">
            <Label htmlFor={`${sectionId}-obs`} className="text-xs">Observation</Label>
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

// ── BonReceptionAchatForm ─────────────────────────────────────────────────────

export function BonReceptionAchatForm({ initial, onSubmit, isSaving }: Props) {
  const { data: suppliers = [] } = useSuppliers({ enabled: true });

  const today = new Date().toISOString().slice(0, 10);

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

  // Casse rows carry a stable `_key` so React can reconcile correctly
  // when items are removed from the middle of the list.
  const [casse, setCasse] = useState<CasseRow[]>(() =>
    (initial?.casse ?? []).map((c) => ({ ...c, _key: crypto.randomUUID() })),
  );

  const [statut, setStatut] = useState<string>(initial?.statut ?? "brouillon");

  // Auto-fill supplier name when dropdown changes
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
      // Strip client-side _key before sending to backend
      casse: casse.map(({ _key: _, ...c }) => c),
      statut: statut as BonStatut,
    });
  };

  return (
    <ScrollArea className="h-full pr-4">
      <div className="space-y-5 pb-4">

        {/* ── Header fields ── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <Label htmlFor="f-annee" className="text-xs">Année</Label>
            <Input id="f-annee" value={annee} onChange={(e) => setAnnee(e.target.value)} className="h-8 text-sm" />
          </div>
          <div>
            <Label htmlFor="f-date" className="text-xs">Date de réception</Label>
            <Input id="f-date" type="date" value={dateReception} onChange={(e) => setDateReception(e.target.value)} className="h-8 text-sm" />
          </div>
          <div>
            <Label htmlFor="f-heure" className="text-xs">Heure arrivée</Label>
            <Input id="f-heure" type="time" value={heureArrivee} onChange={(e) => setHeureArrivee(e.target.value)} className="h-8 text-sm" />
          </div>
          <div>
            <Label htmlFor="f-statut" className="text-xs">Statut</Label>
            <Select value={statut} onValueChange={setStatut}>
              <SelectTrigger id="f-statut" className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="brouillon">Brouillon</SelectItem>
                <SelectItem value="valide">Validé</SelectItem>
                <SelectItem value="annule">Annulé</SelectItem>
              </SelectContent>
            </Select>
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

        <Separator />

        {/* ── Expedition ── */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="f-expedition" className="text-xs">N° Bon d&apos;expédition</Label>
            <Input id="f-expedition" value={numeroExpedition} onChange={(e) => setNumeroExpedition(e.target.value)} className="h-8 text-sm" />
          </div>
          <div>
            <Label htmlFor="f-lieu-exp" className="text-xs">Lieu expédition</Label>
            <Input id="f-lieu-exp" value={lieuExpedition} onChange={(e) => setLieuExpedition(e.target.value)} className="h-8 text-sm" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="f-fournisseur" className="text-xs">Fournisseur</Label>
            <Select value={fournisseurId} onValueChange={setFournisseurId}>
              <SelectTrigger id="f-fournisseur" className="h-8 text-sm"><SelectValue placeholder="Choisir..." /></SelectTrigger>
              <SelectContent>
                {(suppliers as Supplier[]).map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="f-fournisseur-nom" className="text-xs">Nom fournisseur (libre)</Label>
            <Input id="f-fournisseur-nom" value={fournisseurNom} onChange={(e) => setFournisseurNom(e.target.value)} className="h-8 text-sm" />
          </div>
          <div>
            <Label htmlFor="f-facture" className="text-xs">N° Facture</Label>
            <Input id="f-facture" value={numeroFacture} onChange={(e) => setNumeroFacture(e.target.value)} className="h-8 text-sm" />
          </div>
          <div>
            <Label htmlFor="f-lot" className="text-xs">N° de Lot</Label>
            <Input id="f-lot" value={numeroLot} onChange={(e) => setNumeroLot(e.target.value)} className="h-8 text-sm" />
          </div>
        </div>

        <div>
          <Label htmlFor="f-region" className="text-xs">Région</Label>
          <Select value={region} onValueChange={setRegion}>
            <SelectTrigger id="f-region" className="h-8 w-48 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="el_jirid">El Jirid</SelectItem>
              <SelectItem value="kebilli">Kebilli</SelectItem>
              <SelectItem value="autre">Autre</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {/* ── Transport ── */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="f-camion" className="text-xs">N° Camion</Label>
            <Input id="f-camion" value={numeroCamion} onChange={(e) => setNumeroCamion(e.target.value)} className="h-8 text-sm" placeholder="ex. 71 74 9032" />
          </div>
          <div>
            <Label htmlFor="f-chauffeur" className="text-xs">Chauffeur</Label>
            <Input id="f-chauffeur" value={nomChauffeur} onChange={(e) => setNomChauffeur(e.target.value)} className="h-8 text-sm" />
          </div>
        </div>

        {/* ── Reception info ── */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="f-lieu-rec" className="text-xs">Lieu de réception</Label>
            <Input id="f-lieu-rec" value={lieuReception} onChange={(e) => setLieuReception(e.target.value)} className="h-8 text-sm" />
          </div>
          <div>
            <Label htmlFor="f-responsable" className="text-xs">Responsable réception</Label>
            <Input id="f-responsable" value={responsableReception} onChange={(e) => setResponsableReception(e.target.value)} className="h-8 text-sm" />
          </div>
          <div>
            <Label htmlFor="f-qcr" className="text-xs">N° Rapport QCR</Label>
            <Input id="f-qcr" value={numeroRapportQcr} onChange={(e) => setNumeroRapportQcr(e.target.value)} className="h-8 text-sm" />
          </div>
          <div>
            <Label htmlFor="f-palette" className="text-xs">N° Fiche palette</Label>
            <Input id="f-palette" value={numeroFichePalette} onChange={(e) => setNumeroFichePalette(e.target.value)} className="h-8 text-sm" />
          </div>
        </div>

        <Separator />

        <BranchSection id="b1" title="Branche 1ère"  value={branche1}     onChange={setBranche1} />
        <Separator />
        <BranchSection id="b2" title="Branche 2ème"  value={branche2}     onChange={setBranche2} />
        <Separator />
        <BranchSection id="vr" title="Vrac"           value={vrac}         onChange={setVrac} />
        <Separator />
        <BranchSection id="bs" title="Branche Sèche"  value={brancheSeche} onChange={(v) => setBrancheSeche(v as BranchSeche)} withPaletteAjout />

        <Separator />

        {/* ── Casse ── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">Casse</h4>
            <Button variant="outline" size="sm" onClick={addCasse} className="h-7 gap-1 text-xs">
              <Plus className="h-3 w-3" /> Ajouter
            </Button>
          </div>
          {casse.map((row) => (
            <div key={row._key} className="flex items-end gap-2">
              <div className="flex-1">
                <Label htmlFor={`casse-nature-${row._key}`} className="text-xs">Nature</Label>
                <Input
                  id={`casse-nature-${row._key}`}
                  value={row.nature}
                  onChange={(e) => updateCasse(row._key, "nature", e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="w-28">
                <Label htmlFor={`casse-qty-${row._key}`} className="text-xs">Quantité</Label>
                <Input
                  id={`casse-qty-${row._key}`}
                  type="number"
                  value={row.quantite ?? ""}
                  onChange={(e) => updateCasse(row._key, "quantite", e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeCasse(row._key)}
                className="h-8 w-8 p-0 text-destructive"
                aria-label="Supprimer cette ligne"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>

        <Separator />

        <Button onClick={handleSubmit} disabled={isSaving} className="w-full">
          {isSaving ? "Enregistrement..." : initial?.id ? "Mettre à jour" : "Créer le bon"}
        </Button>

      </div>
    </ScrollArea>
  );
}
