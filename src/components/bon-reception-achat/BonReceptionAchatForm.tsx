import { useCallback, useEffect, useState } from "react";
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

const emptyBranch = (): BranchLine => ({
  gc: null, rp: null, gcm: null, l: null,
  poid_brut: null, poid_net: null, nbre_palette: null, observation: null,
});

const emptyBranchSeche = (): BranchSeche => ({
  ...emptyBranch(), nbre_palette_ajout: null, nbre_palette_retrait: null,
});

const n = (v: string) => (v === "" ? null : Number(v));

const BranchSection = ({
  title, value, onChange, withPaletteAjout,
}: {
  title: string;
  value: BranchLine | BranchSeche;
  onChange: (v: BranchLine | BranchSeche) => void;
  withPaletteAjout?: boolean;
}) => {
  const set = (field: string, raw: string) => onChange({ ...value, [field]: n(raw) });

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-foreground">{title}</h4>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {(["gc", "rp", "gcm", "l", "poid_brut", "poid_net"] as const).map((field) => (
          <div key={field}>
            <Label className="text-xs uppercase text-muted-foreground">{field.replace("_", " ")}</Label>
            <Input
              type="number"
              step="0.01"
              placeholder="—"
              value={(value[field as keyof BranchLine] as number | null) ?? ""}
              onChange={(e) => set(field, e.target.value)}
              className="h-8 text-sm"
            />
          </div>
        ))}
      </div>
      {withPaletteAjout ? (
        <div className="flex gap-3">
          <div className="flex-1">
            <Label className="text-xs">Palette ajout (+)</Label>
            <Input
              type="number"
              value={(value as BranchSeche).nbre_palette_ajout ?? ""}
              onChange={(e) => onChange({ ...value, nbre_palette_ajout: n(e.target.value) } as BranchSeche)}
              className="h-8 text-sm"
            />
          </div>
          <div className="flex-1">
            <Label className="text-xs">Palette retrait (−)</Label>
            <Input
              type="number"
              value={(value as BranchSeche).nbre_palette_retrait ?? ""}
              onChange={(e) => onChange({ ...value, nbre_palette_retrait: n(e.target.value) } as BranchSeche)}
              className="h-8 text-sm"
            />
          </div>
          <div className="flex-1">
            <Label className="text-xs">Observation</Label>
            <Input
              value={value.observation ?? ""}
              onChange={(e) => onChange({ ...value, observation: e.target.value || null })}
              className="h-8 text-sm"
            />
          </div>
        </div>
      ) : (
        <div className="flex gap-3">
          <div style={{ flex: 1 }}>
            <Label className="text-xs">Nbre palette</Label>
            <Input
              type="number"
              value={value.nbre_palette ?? ""}
              onChange={(e) => onChange({ ...value, nbre_palette: n(e.target.value) })}
              className="h-8 text-sm"
            />
          </div>
          <div style={{ flex: 2 }}>
            <Label className="text-xs">Observation</Label>
            <Input
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

export function BonReceptionAchatForm({ initial, onSubmit, isSaving }: Props) {
  const { data: suppliers = [] } = useSuppliers({ enabled: true });

  const today = new Date().toISOString().slice(0, 10);

  const [convention, setConvention] = useState(initial?.convention ?? false);
  const [bioCertifie, setBioCertifie] = useState(initial?.bio_certifie ?? false);
  const [annee, setAnnee] = useState(String(initial?.annee ?? new Date().getFullYear()));
  const [region, setRegion] = useState<string>(initial?.region ?? "kebilli");
  const [fournisseurId, setFournisseurId] = useState(initial?.fournisseur_id ?? "");
  const [fournisseurNom, setFournisseurNom] = useState(initial?.fournisseur_nom ?? "");
  const [numeroExpedition, setNumeroExpedition] = useState(initial?.numero_expedition ?? "");
  const [lieuExpedition, setLieuExpedition] = useState(initial?.lieu_expedition ?? "");
  const [numeroFacture, setNumeroFacture] = useState(initial?.numero_facture ?? "");
  const [dateReception, setDateReception] = useState(initial?.date_reception ?? today);
  const [heureArrivee, setHeureArrivee] = useState(initial?.heure_arrivee ?? "");
  const [numeroLot, setNumeroLot] = useState(initial?.numero_lot ?? "");
  const [numeroCamion, setNumeroCamion] = useState(initial?.numero_camion ?? "");
  const [nomChauffeur, setNomChauffeur] = useState(initial?.nom_chauffeur ?? "");
  const [lieuReception, setLieuReception] = useState(initial?.lieu_reception ?? "");
  const [responsableReception, setResponsableReception] = useState(initial?.responsable_reception ?? "");
  const [numeroRapportQcr, setNumeroRapportQcr] = useState(initial?.numero_rapport_qcr ?? "");
  const [numeroFichePalette, setNumeroFichePalette] = useState(initial?.numero_fiche_palette ?? "");

  const [branche1, setBranche1] = useState<BranchLine>(initial?.branche_premiere ?? emptyBranch());

  const [branche2, setBranche2] = useState<BranchLine>(initial?.branche_deuxieme ?? emptyBranch());
  const [vrac, setVrac] = useState<BranchLine>(initial?.vrac ?? emptyBranch());
  
  const [brancheSeche, setBrancheSeche] = useState<BranchSeche>(initial?.branche_seche ?? emptyBranchSeche());
  const [casse, setCasse] = useState<CasseLine[]>(initial?.casse ?? []);
  const [statut, setStatut] = useState<string>(initial?.statut ?? "brouillon");

  useEffect(() => {
    if (!fournisseurId) return;
    const sup = (suppliers as Supplier[]).find((s) => s.id === fournisseurId);
    if (sup) setFournisseurNom(sup.name);
  }, [fournisseurId, suppliers]);

  const addCasse = () => setCasse((c) => [...c, { nature: "", quantite: null }]);
  const removeCasse = (i: number) => setCasse((c) => c.filter((_, idx) => idx !== i));
  const updateCasse = (i: number, field: "nature" | "quantite", val: string) =>
    setCasse((c) => c.map((item, idx) => idx === i ? { ...item, [field]: field === "quantite" ? n(val) : val } : item));

  const handleSubmit = () => {
    onSubmit({
      annee: Number(annee),
      convention,
      bio_certifie: bioCertifie,
      region: region as Region,
      fournisseur_id: fournisseurId || null,
      fournisseur_nom: fournisseurNom || null,
      numero_expedition: numeroExpedition || null,
      lieu_expedition: lieuExpedition || null,
      numero_facture: numeroFacture || null,
      date_reception: dateReception,
      heure_arrivee: heureArrivee || null,
      numero_lot: numeroLot || null,
      numero_camion: numeroCamion || null,
      nom_chauffeur: nomChauffeur || null,
      lieu_reception: lieuReception || null,
      responsable_reception: responsableReception || null,
      numero_rapport_qcr: numeroRapportQcr || null,
      numero_fiche_palette: numeroFichePalette || null,
      branche_premiere: branche1,
      branche_deuxieme: branche2,
      vrac,
      branche_seche: brancheSeche,
      casse,
      statut: statut as BonStatut,
    });
  };

  return (
    <ScrollArea className="h-full pr-4">
      <div className="space-y-5 pb-4">

        {/* ── Header fields ── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <Label className="text-xs">Année</Label>
            <Input value={annee} onChange={(e) => setAnnee(e.target.value)} className="h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs">Date de réception</Label>
            <Input type="date" value={dateReception} onChange={(e) => setDateReception(e.target.value)} className="h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs">Heure arrivée</Label>
            <Input type="time" value={heureArrivee} onChange={(e) => setHeureArrivee(e.target.value)} className="h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs">Statut</Label>
            <Select value={statut} onValueChange={setStatut}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="brouillon">Brouillon</SelectItem>
                <SelectItem value="valide">Validé</SelectItem>
                <SelectItem value="annule">Annulé</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={convention} onCheckedChange={(c) => setConvention(!!c)} />
            Convention
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={bioCertifie} onCheckedChange={(c) => setBioCertifie(!!c)} />
            TN-Bio-001
          </label>
        </div>

        <Separator />

        {/* ── Expedition ── */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">N° Bon d&apos;expédition</Label>
            <Input value={numeroExpedition} onChange={(e) => setNumeroExpedition(e.target.value)} className="h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs">Lieu expédition</Label>
            <Input value={lieuExpedition} onChange={(e) => setLieuExpedition(e.target.value)} className="h-8 text-sm" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Fournisseur</Label>
            <Select value={fournisseurId} onValueChange={setFournisseurId}>
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Choisir..." /></SelectTrigger>
              <SelectContent>
                {suppliers.map((s: any) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Nom fournisseur (libre)</Label>
            <Input value={fournisseurNom} onChange={(e) => setFournisseurNom(e.target.value)} className="h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs">N° Facture</Label>
            <Input value={numeroFacture} onChange={(e) => setNumeroFacture(e.target.value)} className="h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs">N° de Lot</Label>
            <Input value={numeroLot} onChange={(e) => setNumeroLot(e.target.value)} className="h-8 text-sm" />
          </div>
        </div>

        <div>
          <Label className="text-xs">Région</Label>
          <Select value={region} onValueChange={setRegion}>
            <SelectTrigger className="h-8 text-sm w-48"><SelectValue /></SelectTrigger>
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
            <Label className="text-xs">N° Camion</Label>
            <Input value={numeroCamion} onChange={(e) => setNumeroCamion(e.target.value)} className="h-8 text-sm" placeholder="ex. 71 74 9032" />
          </div>
          <div>
            <Label className="text-xs">Chauffeur</Label>
            <Input value={nomChauffeur} onChange={(e) => setNomChauffeur(e.target.value)} className="h-8 text-sm" />
          </div>
        </div>

        {/* ── Reception info ── */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Lieu de réception</Label>
            <Input value={lieuReception} onChange={(e) => setLieuReception(e.target.value)} className="h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs">Responsable réception</Label>
            <Input value={responsableReception} onChange={(e) => setResponsableReception(e.target.value)} className="h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs">N° Rapport QCR</Label>
            <Input value={numeroRapportQcr} onChange={(e) => setNumeroRapportQcr(e.target.value)} className="h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs">N° Fiche palette</Label>
            <Input value={numeroFichePalette} onChange={(e) => setNumeroFichePalette(e.target.value)} className="h-8 text-sm" />
          </div>
        </div>

        <Separator />

        <BranchSection title="Branche 1ère" value={branche1} onChange={setBranche1} />
        <Separator />
        <BranchSection title="Branche 2ème" value={branche2} onChange={setBranche2} />
        <Separator />
        <BranchSection title="Vrac" value={vrac} onChange={setVrac} />
        <Separator />
        <BranchSection title="Branche Sèche" value={brancheSeche} onChange={(v) => setBrancheSeche(v as BranchSeche)} withPaletteAjout />

        <Separator />

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">Casse</h4>-
            <Button variant="outline" size="sm" onClick={addCasse} className="h-7 gap-1 text-xs">
              <Plus className="h-3 w-3" /> Ajouter
            </Button>
          </div>
          {casse.map((c, i) => (
            <div key={i} className="flex gap-2 items-end">
              <div className="flex-1">
                <Label className="text-xs">Nature</Label>
                <Input value={c.nature} onChange={(e) => updateCasse(i, "nature", e.target.value)} className="h-8 text-sm" />
              </div>
              <div className="w-28">
                <Label className="text-xs">Quantité</Label>
                <Input type="number" value={c.quantite ?? ""} onChange={(e) => updateCasse(i, "quantite", e.target.value)} className="h-8 text-sm" />
              </div>
              <Button variant="ghost" size="sm" onClick={() => removeCasse(i)} className="h-8 w-8 p-0 text-destructive">
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
