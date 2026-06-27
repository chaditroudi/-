import { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import type { COADocument } from '@/types/exportOrders';
import { useBatches } from '@/hooks/useBatches';
import { useListQualityInspectionsQuery } from '@/store/api/batchesApi';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: COADocument | null;
  onSubmit: (data: Partial<COADocument>) => Promise<void>;
  isSaving: boolean;
}

export function COADialog({ open, onOpenChange, initial, onSubmit, isSaving }: Props) {
  const { data: batches = [] } = useBatches({ enabled: open });
  const [activeBatchId, setActiveBatchId] = useState('');
  const { data: inspections = [] } = useListQualityInspectionsQuery(activeBatchId, { skip: !activeBatchId });

  const [batchId,        setBatchId]        = useState('');
  const [batchRef,       setBatchRef]       = useState('');
  const [supplierName,   setSupplierName]   = useState('');
  const [originRegion,   setOriginRegion]   = useState('');
  const [originFarm,     setOriginFarm]     = useState('');
  const [harvestDate,    setHarvestDate]    = useState('');
  const [productionDate, setProductionDate] = useState('');
  const [expiryDate,     setExpiryDate]     = useState('');
  const [humidityPct,    setHumidityPct]    = useState('');
  const [moldScore,      setMoldScore]      = useState('');
  const [visualGrade,    setVisualGrade]    = useState('');
  const [netWeight,      setNetWeight]      = useState('');
  const [grossWeight,    setGrossWeight]    = useState('');
  const [approvedBy,     setApprovedBy]     = useState('');
  const [notes,          setNotes]          = useState('');

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setBatchId(initial.batch_id);
      setBatchRef(initial.batch_ref ?? '');
      setSupplierName(initial.supplier_name ?? '');
      setOriginRegion(initial.origin_region ?? '');
      setOriginFarm(initial.origin_farm ?? '');
      setHarvestDate(initial.harvest_date ?? '');
      setProductionDate(initial.production_date ?? '');
      setExpiryDate(initial.expiry_date ?? '');
      setHumidityPct(initial.humidity_pct != null ? String(initial.humidity_pct) : '');
      setMoldScore(initial.mold_score != null ? String(initial.mold_score) : '');
      setVisualGrade(initial.visual_grade ?? '');
      setNetWeight(initial.net_weight_kg != null ? String(initial.net_weight_kg) : '');
      setGrossWeight(initial.gross_weight_kg != null ? String(initial.gross_weight_kg) : '');
      setApprovedBy(initial.approved_by ?? '');
      setNotes(initial.notes ?? '');
    } else {
      setBatchId(''); setBatchRef(''); setSupplierName(''); setOriginRegion('');
      setOriginFarm(''); setHarvestDate(''); setProductionDate(''); setExpiryDate('');
      setHumidityPct(''); setMoldScore(''); setVisualGrade(''); setNetWeight('');
      setGrossWeight(''); setApprovedBy(''); setNotes('');
    }
  }, [open, initial]);

  const handleBatchSelect = (id: string) => {
    if (id === 'none') { setBatchId(''); setBatchRef(''); setActiveBatchId(''); return; }
    const b = batches.find((x) => x.id === id) as any;
    if (!b) return;
    setBatchId(id);
    setActiveBatchId(id);
    setBatchRef(b.batch_number ?? id);
    setOriginRegion(b.origin_region ?? '');
    setOriginFarm(b.origin_farm ?? '');
    setHarvestDate(b.harvest_date ?? '');
    setVisualGrade(b.quality_grade ?? '');
    setNetWeight(b.current_weight_kg != null ? String(b.current_weight_kg) : '');
  };

  // Auto-fill QC fields from the latest inspection whenever inspections load
  useEffect(() => {
    if (!activeBatchId || inspections.length === 0) return;
    const latest = [...inspections].sort(
      (a: any, b: any) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
    )[0] as any;
    if (latest.humidity_measured != null) setHumidityPct(String(latest.humidity_measured));
    if (latest.mold_percentage != null)   setMoldScore(String(latest.mold_percentage));
    if (latest.recommended_grade)         setVisualGrade(latest.recommended_grade);
    if (latest.weight_measured_kg != null) setNetWeight(String(latest.weight_measured_kg));
  }, [activeBatchId, inspections]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date().toISOString();
    await onSubmit({
      batch_id:       batchId,
      batch_ref:      batchRef || null,
      supplier_name:  supplierName || null,
      origin_region:  originRegion || null,
      origin_farm:    originFarm || null,
      harvest_date:   harvestDate || null,
      production_date: productionDate || null,
      expiry_date:    expiryDate || null,
      humidity_pct:   humidityPct ? parseFloat(humidityPct) : null,
      mold_score:     moldScore ? parseFloat(moldScore) : null,
      visual_grade:   visualGrade || null,
      net_weight_kg:  netWeight ? parseFloat(netWeight) : null,
      gross_weight_kg: grossWeight ? parseFloat(grossWeight) : null,
      certifications: ['TN-BIO-001'],
      approved_by:    approvedBy || null,
      approved_at:    approvedBy ? now : null,
      notes:          notes || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? `Modifier ${initial.coa_ref}` : 'Nouveau COA'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label htmlFor="coa-batch">Lot qualité *</Label>
              <Select value={batchId || 'none'} onValueChange={handleBatchSelect}>
                <SelectTrigger id="coa-batch"><SelectValue placeholder="Sélectionner lot..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun</SelectItem>
                  {batches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {(b as any).batch_number} — {(b as any).quality_grade ?? 'sans grade'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="coa-supplier">Fournisseur</Label>
              <Input id="coa-supplier" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="coa-region">Région d&apos;origine</Label>
              <Input id="coa-region" value={originRegion} onChange={(e) => setOriginRegion(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="coa-farm">Exploitation</Label>
              <Input id="coa-farm" value={originFarm} onChange={(e) => setOriginFarm(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="coa-harvest">Date de récolte</Label>
              <Input id="coa-harvest" type="date" value={harvestDate} onChange={(e) => setHarvestDate(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="coa-prod">Date de production</Label>
              <Input id="coa-prod" type="date" value={productionDate} onChange={(e) => setProductionDate(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="coa-expiry">Date d&apos;expiration</Label>
              <Input id="coa-expiry" type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
            </div>
          </div>

          <div className="border rounded-lg p-3 space-y-2 bg-muted/20">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Résultats d&apos;analyse</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="coa-humidity" className="text-xs">Humidité (%)</Label>
                <Input id="coa-humidity" type="number" step="0.1" min="0" max="100" className="h-8"
                  value={humidityPct} onChange={(e) => setHumidityPct(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="coa-mold" className="text-xs">Score moisissure</Label>
                <Input id="coa-mold" type="number" step="0.1" min="0" className="h-8"
                  value={moldScore} onChange={(e) => setMoldScore(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="coa-grade" className="text-xs">Grade visuel</Label>
                <Select value={visualGrade || 'none'} onValueChange={(v) => setVisualGrade(v === 'none' ? '' : v)}>
                  <SelectTrigger id="coa-grade" className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="economy">Économique</SelectItem>
                    <SelectItem value="rejected">Rejeté</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="coa-net" className="text-xs">Poids net (kg)</Label>
                <Input id="coa-net" type="number" step="0.01" min="0" className="h-8"
                  value={netWeight} onChange={(e) => setNetWeight(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="coa-gross" className="text-xs">Poids brut (kg)</Label>
                <Input id="coa-gross" type="number" step="0.01" min="0" className="h-8"
                  value={grossWeight} onChange={(e) => setGrossWeight(e.target.value)} />
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="coa-approved">Approuvé par</Label>
            <Input id="coa-approved" value={approvedBy} onChange={(e) => setApprovedBy(e.target.value)}
              placeholder="Nom du responsable qualité" />
          </div>

          <div>
            <Label htmlFor="coa-notes">Observations</Label>
            <Textarea id="coa-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" disabled={isSaving || !batchId}>
              {isSaving ? 'Enregistrement...' : initial ? 'Mettre à jour' : 'Créer COA'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
