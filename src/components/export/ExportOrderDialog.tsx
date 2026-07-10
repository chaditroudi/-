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
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2 } from 'lucide-react';
import type {
  ExportOrder, ExportOrderLine, BuyerCountry, ContractLanguage,
} from '@/types/exportOrders';
import { useBatches } from '@/hooks/useBatches';
import { useCOADocuments } from '@/hooks/useExportOrders';
import { useCustomers } from '@/hooks/useCustomers';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: ExportOrder | null;
  onSubmit: (data: Partial<ExportOrder>) => Promise<void>;
  isSaving: boolean;
}

type LineRow = ExportOrderLine & { _key: string };

const emptyLine = (): LineRow => ({
  _key: crypto.randomUUID(),
  lot_id: '',
  lot_ref: '',
  product_name: 'Dattes Deglet Nour',
  net_weight_kg: 0,
  unit_price: 0,
  currency: 'EUR',
  origin_region: '',
  origin_farm: '',
  harvest_date: '',
  quality_grade: '',
  coa_ref: '',
});

const BUYER_COUNTRIES: { value: BuyerCountry; label: string }[] = [
  { value: 'EU',  label: 'Union Européenne (EU)' },
  { value: 'USA', label: 'États-Unis (USA)' },
  { value: 'SA',  label: 'Arabie Saoudite (SA)' },
];

const LANGUAGES: { value: ContractLanguage; label: string }[] = [
  { value: 'fr', label: 'Français' },
  { value: 'en', label: 'English' },
  { value: 'ar', label: 'العربية' },
];

const CURRENCIES = ['EUR', 'USD', 'SAR', 'TND'];
const INCOTERMS  = ['CIF', 'FOB', 'EXW', 'DDP', 'DAP', 'CFR'];

export function ExportOrderDialog({ open, onOpenChange, initial, onSubmit, isSaving }: Props) {
  const { data: batches = [] } = useBatches({ enabled: open });
  const { data: coaDocs = [] } = useCOADocuments();
  const { data: customers = [] } = useCustomers({ enabled: open });

  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerName,    setCustomerName]    = useState('');
  const [customerCountry, setCustomerCountry] = useState<BuyerCountry>('EU');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerContact, setCustomerContact] = useState('');
  const [incoterms,       setIncoterms]       = useState('CIF');
  const [portLoading,     setPortLoading]     = useState('Tunis');
  const [portDest,        setPortDest]        = useState('');
  const [currency,        setCurrency]        = useState('EUR');
  const [language,        setLanguage]        = useState<ContractLanguage>('fr');
  const [notes,           setNotes]           = useState('');
  const [lines,           setLines]           = useState<LineRow[]>([emptyLine()]);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setCustomerName(initial.customer_name);
      setCustomerCountry(initial.customer_country);
      setCustomerAddress(initial.customer_address ?? '');
      setCustomerContact(initial.customer_contact ?? '');
      setIncoterms(initial.incoterms ?? 'CIF');
      setPortLoading(initial.port_of_loading ?? 'Tunis');
      setPortDest(initial.port_of_destination ?? '');
      setCurrency(initial.currency);
      setLanguage(initial.contract_language);
      setNotes(initial.notes ?? '');
      setLines(initial.lines.map((l) => ({ ...l, _key: crypto.randomUUID() })));
    } else {
      setSelectedCustomerId('');
      setCustomerName(''); setCustomerCountry('EU'); setCustomerAddress('');
      setCustomerContact(''); setIncoterms('CIF'); setPortLoading('Tunis');
      setPortDest(''); setCurrency('EUR'); setLanguage('fr'); setNotes('');
      setLines([emptyLine()]);
    }
  }, [open, initial]);

  const handleCustomerSelect = (id: string) => {
    setSelectedCustomerId(id);
    if (id === 'none') return;
    const c = customers.find((x) => x.id === id);
    if (!c) return;
    setCustomerName(c.name);
    setCustomerCountry(c.country);
    setCustomerAddress(c.address ?? '');
    setCustomerContact(c.contact_name ?? '');
    setLanguage(c.preferred_language);
    setIncoterms(c.preferred_incoterms ?? 'CIF');
    setCurrency(c.preferred_currency);
    setPortDest(c.port_of_destination ?? '');
  };

  const addLine    = () => setLines((l) => [...l, emptyLine()]);
  const removeLine = (key: string) => setLines((l) => l.filter((r) => r._key !== key));
  const setLine    = (key: string, patch: Partial<LineRow>) =>
    setLines((l) => l.map((r) => (r._key !== key ? r : { ...r, ...patch })));

  const totalWeight = lines.reduce((s, l) => s + (l.net_weight_kg || 0), 0);
  const totalAmount = lines.reduce((s, l) => s + (l.net_weight_kg || 0) * (l.unit_price || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanLines = lines.map(({ _key: _, ...l }) => l);
    await onSubmit({
      customer_name:       customerName,
      customer_country:    customerCountry,
      customer_address:    customerAddress || null,
      customer_contact:    customerContact || null,
      incoterms:           incoterms || null,
      port_of_loading:     portLoading || null,
      port_of_destination: portDest || null,
      currency,
      contract_language:   language,
      notes:               notes || null,
      lines:               cleanLines,
      total_weight_kg:     totalWeight,
      total_amount:        totalAmount,
      status:              initial?.status ?? 'draft',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {initial ? `Modifier ${initial.order_ref}` : 'Nouvelle commande export'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Customer selector */}
          {customers.length > 0 && (
            <div>
              <Label className="text-xs">Sélectionner un client enregistré</Label>
              <Select value={selectedCustomerId || 'none'} onValueChange={handleCustomerSelect}>
                <SelectTrigger className="h-10 text-sm mt-1">
                  <SelectValue placeholder="Choisir un client (optionnel)..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Saisie manuelle —</SelectItem>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} · {c.country}{c.specific_country ? ` (${c.specific_country})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Client */}
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Client</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label htmlFor="eo-customer">Nom client *</Label>
                <Input id="eo-customer" value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="eo-country">Pays acheteur *</Label>
                <Select value={customerCountry} onValueChange={(v) => setCustomerCountry(v as BuyerCountry)}>
                  <SelectTrigger id="eo-country"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BUYER_COUNTRIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="eo-lang">Langue contrat</Label>
                <Select value={language} onValueChange={(v) => setLanguage(v as ContractLanguage)}>
                  <SelectTrigger id="eo-lang"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((l) => (
                      <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label htmlFor="eo-address">Adresse</Label>
                <Input id="eo-address" value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} />
              </div>
              <div className="col-span-2">
                <Label htmlFor="eo-contact">Contact</Label>
                <Input id="eo-contact" value={customerContact} onChange={(e) => setCustomerContact(e.target.value)} />
              </div>
            </div>
          </div>

          <Separator />

          {/* Shipping */}
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Expédition</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="eo-inco">Incoterms</Label>
                <Select value={incoterms} onValueChange={setIncoterms}>
                  <SelectTrigger id="eo-inco"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {INCOTERMS.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="eo-port-load">Port de chargement</Label>
                <Input id="eo-port-load" value={portLoading} onChange={(e) => setPortLoading(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="eo-port-dest">Port de destination</Label>
                <Input id="eo-port-dest" value={portDest} onChange={(e) => setPortDest(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="eo-currency">Devise</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger id="eo-currency"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Separator />

          {/* Lines */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Lignes de produits</p>
              <Button type="button" variant="outline" size="sm" onClick={addLine} className="gap-1 h-9 text-xs">
                <Plus className="h-3 w-3" /> Ajouter ligne
              </Button>
            </div>

            <div className="space-y-3">
              {lines.map((line, idx) => {
                const batch = batches.find((b) => b.id === line.lot_id);
                const coa   = coaDocs.find((c) => c.batch_id === line.lot_id);
                return (
                  <div key={line._key} className="border rounded-lg p-3 bg-muted/20 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">Ligne {idx + 1}</span>
                      {lines.length > 1 && (
                        <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive"
                          onClick={() => removeLine(line._key)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <div className="col-span-2">
                        <Label className="text-xs">Lot qualité</Label>
                        <Select
                          value={line.lot_id || 'none'}
                          onValueChange={(v) => {
                            if (v === 'none') { setLine(line._key, { lot_id: '', lot_ref: '', coa_ref: '' }); return; }
                            const b = batches.find((x) => x.id === v);
                            const c = coaDocs.find((x) => x.batch_id === v);
                            setLine(line._key, {
                              lot_id:       v,
                              lot_ref:      (b as any)?.batch_number ?? v,
                              origin_region:(b as any)?.origin_region ?? '',
                              origin_farm:  (b as any)?.origin_farm ?? '',
                              harvest_date: (b as any)?.harvest_date ?? '',
                              quality_grade:(b as any)?.quality_grade ?? '',
                              coa_ref:      c?.coa_ref ?? '',
                            });
                          }}
                        >
                          <SelectTrigger className="h-10 text-sm"><SelectValue placeholder="Sélectionner lot..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Aucun</SelectItem>
                            {batches
                              .filter((b) => (b as any).status === 'accepted' || (b as any).quality_grade)
                              .map((b) => (
                                <SelectItem key={b.id} value={b.id}>
                                  {(b as any).batch_number} — {(b as any).quality_grade ?? 'N/A'}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="col-span-2">
                        <Label className="text-xs">Produit</Label>
                        <Input
                          className="h-10 text-sm"
                          value={line.product_name}
                          onChange={(e) => setLine(line._key, { product_name: e.target.value })}
                          placeholder="Dattes Deglet Nour..."
                        />
                      </div>

                      <div>
                        <Label className="text-xs">Poids net (kg) *</Label>
                        <Input
                          type="number" step="0.01" min="0" className="h-10 text-sm" required
                          value={line.net_weight_kg || ''}
                          onChange={(e) => setLine(line._key, { net_weight_kg: parseFloat(e.target.value) || 0 })}
                        />
                      </div>

                      <div>
                        <Label className="text-xs">Prix unitaire *</Label>
                        <Input
                          type="number" step="0.0001" min="0" className="h-10 text-sm" required
                          value={line.unit_price || ''}
                          onChange={(e) => setLine(line._key, { unit_price: parseFloat(e.target.value) || 0 })}
                        />
                      </div>

                      <div>
                        <Label className="text-xs">Grade</Label>
                        <Input className="h-10 text-sm" value={line.quality_grade ?? ''} readOnly
                          placeholder="Auto depuis lot" />
                      </div>

                      <div>
                        <Label className="text-xs">Réf. COA</Label>
                        <Input className="h-10 text-sm font-mono"
                          value={line.coa_ref ?? (coa?.coa_ref ?? '')}
                          onChange={(e) => setLine(line._key, { coa_ref: e.target.value })}
                          placeholder="COA-2026-..."
                        />
                      </div>
                    </div>

                    {batch && (
                      <div className="text-xs text-muted-foreground">
                        {(batch as any).origin_region && <span>Région: {(batch as any).origin_region}</span>}
                        {(batch as any).origin_farm && <span className="ml-3">Exploitation: {(batch as any).origin_farm}</span>}
                        {(batch as any).harvest_date && <span className="ml-3">Récolte: {(batch as any).harvest_date}</span>}
                      </div>
                    )}

                    <div className="text-right text-xs font-semibold text-primary">
                      Sous-total: {(line.net_weight_kg * line.unit_price).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {currency}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-3 flex justify-end gap-6 text-sm font-semibold border-t pt-3">
              <span>Poids total: {totalWeight.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} kg</span>
              <span className="text-primary">Montant total: {totalAmount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {currency}</span>
            </div>
          </div>

          <Separator />

          <div>
            <Label htmlFor="eo-notes">Notes</Label>
            <Textarea id="eo-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Enregistrement...' : initial ? 'Mettre à jour' : 'Créer commande'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
