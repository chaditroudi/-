import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { BonExpedition, BonExpeditionInput, ExpeditionLigne, ProduitType } from "@/types/bonExpedition";
import { PRODUIT_LABELS, PRODUIT_ORDER } from "@/types/bonExpedition";
import { useSuppliers } from "@/hooks/useSuppliers";

interface Props {
  initial?: Partial<BonExpedition>;
  onSubmit: (data: Partial<BonExpeditionInput>) => void;
  isSaving: boolean;
}

const defaultLignes = (): ExpeditionLigne[] =>
  PRODUIT_ORDER.map((produit) => ({ produit, nature_caisse: null, quantite_caisse: null, observation: null }));

const n = (v: string) => (v === "" ? null : Number(v));

export function BonExpeditionForm({ initial, onSubmit, isSaving }: Props) {
  const { data: suppliers = [] } = useSuppliers({ enabled: true });
  const today = new Date().toISOString().slice(0, 10);

  const [conventionnel, setConventionnel] = useState(initial?.conventionnel ?? false);
  const [bioCertifie, setBioCertifie] = useState(initial?.bio_certifie ?? false);
  const [ggp, setGgp] = useState(initial?.ggp ?? false);
  const [annee, setAnnee] = useState(String(initial?.annee ?? new Date().getFullYear()));
  const [lieu, setLieu] = useState(initial?.lieu ?? "");
  const [fournisseurId, setFournisseurId] = useState(initial?.fournisseur_id ?? "");
  const [codeFournisseur, setCodeFournisseur] = useState(initial?.code_fournisseur ?? "");
  const [codeControleur, setCodeControleur] = useState(initial?.code_controleur ?? "");
  const [dateExpedition, setDateExpedition] = useState(initial?.date_expedition ?? today);
  const [numeroCamion, setNumeroCamion] = useState(initial?.numero_camion ?? "");
  const [nomChauffeur, setNomChauffeur] = useState(initial?.nom_chauffeur ?? "");
  const [lieuReception, setLieuReception] = useState(initial?.lieu_reception ?? "");
  const [responsableReception, setResponsableReception] = useState(initial?.responsable_reception ?? "");
  const [nomSignataire, setNomSignataire] = useState(initial?.nom_signataire ?? "");
  const [statut, setStatut] = useState<string>(initial?.statut ?? "brouillon");
  const [lignes, setLignes] = useState<ExpeditionLigne[]>(
    initial?.lignes && initial.lignes.length > 0 ? initial.lignes : defaultLignes(),
  );
  const [casseNature, setCasseNature] = useState(initial?.casse_nature ?? "");
  const [casseGc, setCasseGc] = useState(initial?.casse_gc != null ? String(initial.casse_gc) : "");
  const [casseP, setCasseP] = useState(initial?.casse_p != null ? String(initial.casse_p) : "");
  const [casseL, setCasseL] = useState(initial?.casse_l != null ? String(initial.casse_l) : "");

  // Auto-fill code from supplier selection
  useEffect(() => {
    if (!fournisseurId) return;
    const sup = suppliers.find((s: any) => s.id === fournisseurId);
    if (sup) setCodeFournisseur((sup as any).code ?? (sup as any).name ?? codeFournisseur);
  }, [fournisseurId, suppliers]);

  const updateLigne = (produit: ProduitType, field: keyof Omit<ExpeditionLigne, "produit">, val: string) => {
    setLignes((prev) =>
      prev.map((l) => l.produit === produit ? { ...l, [field]: val || null } : l),
    );
  };

  const handleSubmit = () => {
    onSubmit({
      annee: Number(annee),
      conventionnel,
      bio_certifie: bioCertifie,
      ggp,
      lieu: lieu || null,
      code_fournisseur: codeFournisseur || null,
      fournisseur_id: fournisseurId || null,
      code_controleur: codeControleur || null,
      date_expedition: dateExpedition,
      numero_camion: numeroCamion || null,
      nom_chauffeur: nomChauffeur || null,
      lieu_reception: lieuReception || null,
      responsable_reception: responsableReception || null,
      nom_signataire: nomSignataire || null,
      lignes,
      casse_nature: casseNature || null,
      casse_gc: n(casseGc),
      casse_p: n(casseP),
      casse_l: n(casseL),
      statut: statut as any,
    });
  };

  return (
    <ScrollArea className="h-full pr-4">
      <div className="space-y-5 pb-4">

        {/* ── Header ── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div>
            <Label className="text-xs">Année</Label>
            <Input value={annee} onChange={(e) => setAnnee(e.target.value)} className="h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs">Date d&apos;expédition</Label>
            <Input type="date" value={dateExpedition} onChange={(e) => setDateExpedition(e.target.value)} className="h-8 text-sm" />
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
            <Checkbox checked={conventionnel} onCheckedChange={(c) => setConventionnel(!!c)} />
            Conventionnel
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={bioCertifie} onCheckedChange={(c) => setBioCertifie(!!c)} />
            TN-Bio-001
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={ggp} onCheckedChange={(c) => setGgp(!!c)} />
            GGP
          </label>
        </div>

        <Separator />

        {/* ── Lieu + Fournisseur ── */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Lieu</Label>
            <Input value={lieu} onChange={(e) => setLieu(e.target.value)} className="h-8 text-sm" placeholder="ex. Tombar" />
          </div>
          <div>
            <Label className="text-xs">Fournisseur (liste)</Label>
            <Select value={fournisseurId} onValueChange={setFournisseurId}>
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Choisir..." /></SelectTrigger>
              <SelectContent>
                {suppliers.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Code Fournisseur</Label>
            <Input value={codeFournisseur} onChange={(e) => setCodeFournisseur(e.target.value)} className="h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs">Code Contrôleur</Label>
            <Input value={codeControleur} onChange={(e) => setCodeControleur(e.target.value)} className="h-8 text-sm" />
          </div>
        </div>

        <Separator />

        {/* ── Transport ── */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">N° Camion</Label>
            <Input value={numeroCamion} onChange={(e) => setNumeroCamion(e.target.value)} className="h-8 text-sm" placeholder="ex. 71 Tu 9032" />
          </div>
          <div>
            <Label className="text-xs">Chauffeur</Label>
            <Input value={nomChauffeur} onChange={(e) => setNomChauffeur(e.target.value)} className="h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs">Lieu de réception</Label>
            <Input value={lieuReception} onChange={(e) => setLieuReception(e.target.value)} className="h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs">Responsable réception</Label>
            <Input value={responsableReception} onChange={(e) => setResponsableReception(e.target.value)} className="h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs">Nom signataire</Label>
            <Input value={nomSignataire} onChange={(e) => setNomSignataire(e.target.value)} className="h-8 text-sm" />
          </div>
        </div>

        <Separator />

        {/* ── Lignes produits ── */}
        <div>
          <h4 className="text-sm font-semibold mb-3">Lignes produits</h4>
          <div className="rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 text-xs text-muted-foreground uppercase">
                  <th className="text-left px-3 py-2 font-medium w-36">Produit</th>
                  <th className="px-3 py-2 font-medium text-left">Nature de caisse</th>
                  <th className="px-3 py-2 font-medium text-left">Quantité de caisse</th>
                  <th className="px-3 py-2 font-medium text-left">Observation</th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((ligne, i) => (
                  <tr key={ligne.produit} className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                    <td className="px-3 py-1.5 font-medium text-xs text-foreground/80">
                      {PRODUIT_LABELS[ligne.produit]}
                    </td>
                    <td className="px-3 py-1">
                      <Input
                        value={ligne.nature_caisse ?? ""}
                        onChange={(e) => updateLigne(ligne.produit, "nature_caisse", e.target.value)}
                        className="h-7 text-xs"
                        placeholder="ex. GCRP/GCM"
                      />
                    </td>
                    <td className="px-3 py-1">
                      <Input
                        value={ligne.quantite_caisse ?? ""}
                        onChange={(e) => updateLigne(ligne.produit, "quantite_caisse", e.target.value)}
                        className="h-7 text-xs"
                        placeholder="ex. 404/16"
                      />
                    </td>
                    <td className="px-3 py-1">
                      <Input
                        value={ligne.observation ?? ""}
                        onChange={(e) => updateLigne(ligne.produit, "observation", e.target.value)}
                        className="h-7 text-xs"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <Separator />

        {/* ── Casse ── */}
        <div>
          <h4 className="text-sm font-semibold mb-3">Casse</h4>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <Label className="text-xs">Nature</Label>
              <Input value={casseNature} onChange={(e) => setCasseNature(e.target.value)} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">GC (Grand Caisse)</Label>
              <Input type="number" value={casseGc} onChange={(e) => setCasseGc(e.target.value)} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">P (Plateau)</Label>
              <Input type="number" value={casseP} onChange={(e) => setCasseP(e.target.value)} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">L (Lame)</Label>
              <Input type="number" value={casseL} onChange={(e) => setCasseL(e.target.value)} className="h-8 text-sm" />
            </div>
          </div>
        </div>

        <Separator />

        <Button onClick={handleSubmit} disabled={isSaving} className="w-full">
          {isSaving ? "Enregistrement..." : initial?.id ? "Mettre à jour" : "Créer le bon"}
        </Button>
      </div>
    </ScrollArea>
  );
}
