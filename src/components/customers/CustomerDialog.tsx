import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import type { Customer } from '@/types/customer';
import type { BuyerCountry, ContractLanguage } from '@/types/exportOrders';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Customer | null;
  onSubmit: (data: Partial<Customer>) => Promise<void>;
  isSaving: boolean;
}

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
const INCOTERMS  = ['CIF', 'FOB', 'EXW', 'DDP', 'DAP', 'CFR'];
const CURRENCIES = ['EUR', 'USD', 'SAR', 'TND'];

export function CustomerDialog({ open, onOpenChange, initial, onSubmit, isSaving }: Props) {
  const [name,             setName]             = useState('');
  const [country,          setCountry]          = useState<BuyerCountry>('EU');
  const [specificCountry,  setSpecificCountry]  = useState('');
  const [address,          setAddress]          = useState('');
  const [contactName,      setContactName]      = useState('');
  const [contactEmail,     setContactEmail]     = useState('');
  const [contactPhone,     setContactPhone]     = useState('');
  const [language,         setLanguage]         = useState<ContractLanguage>('fr');
  const [incoterms,        setIncoterms]        = useState('CIF');
  const [currency,         setCurrency]         = useState('EUR');
  const [portDest,         setPortDest]         = useState('');
  const [paymentTerms,     setPaymentTerms]     = useState('');
  const [notes,            setNotes]            = useState('');
  const [isActive,         setIsActive]         = useState(true);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setName(initial.name);
      setCountry(initial.country);
      setSpecificCountry(initial.specific_country ?? '');
      setAddress(initial.address ?? '');
      setContactName(initial.contact_name ?? '');
      setContactEmail(initial.contact_email ?? '');
      setContactPhone(initial.contact_phone ?? '');
      setLanguage(initial.preferred_language);
      setIncoterms(initial.preferred_incoterms ?? 'CIF');
      setCurrency(initial.preferred_currency);
      setPortDest(initial.port_of_destination ?? '');
      setPaymentTerms(initial.payment_terms ?? '');
      setNotes(initial.notes ?? '');
      setIsActive(initial.is_active);
    } else {
      setName(''); setCountry('EU'); setSpecificCountry(''); setAddress('');
      setContactName(''); setContactEmail(''); setContactPhone('');
      setLanguage('fr'); setIncoterms('CIF'); setCurrency('EUR');
      setPortDest(''); setPaymentTerms(''); setNotes(''); setIsActive(true);
    }
  }, [open, initial]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({
      name,
      country,
      specific_country:    specificCountry || null,
      address:             address || null,
      contact_name:        contactName || null,
      contact_email:       contactEmail || null,
      contact_phone:       contactPhone || null,
      preferred_language:  language,
      preferred_incoterms: incoterms || null,
      preferred_currency:  currency,
      port_of_destination: portDest || null,
      payment_terms:       paymentTerms || null,
      notes:               notes || null,
      is_active:           isActive,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? `Modifier ${initial.name}` : 'Nouveau client'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Identity */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Identité</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label htmlFor="cust-name">Raison sociale *</Label>
                <Input id="cust-name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="cust-country">Région acheteur *</Label>
                <Select value={country} onValueChange={(v) => setCountry(v as BuyerCountry)}>
                  <SelectTrigger id="cust-country"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BUYER_COUNTRIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="cust-specific">Pays précis</Label>
                <Input id="cust-specific" value={specificCountry}
                  onChange={(e) => setSpecificCountry(e.target.value)}
                  placeholder="ex: France, Germany, UAE..." />
              </div>
              <div className="col-span-2">
                <Label htmlFor="cust-address">Adresse</Label>
                <Input id="cust-address" value={address} onChange={(e) => setAddress(e.target.value)} />
              </div>
            </div>
          </div>

          <Separator />

          {/* Contact */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Contact</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label htmlFor="cust-contact-name">Nom du contact</Label>
                <Input id="cust-contact-name" value={contactName}
                  onChange={(e) => setContactName(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="cust-email">Email</Label>
                <Input id="cust-email" type="email" value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="cust-phone">Téléphone</Label>
                <Input id="cust-phone" value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)} />
              </div>
            </div>
          </div>

          <Separator />

          {/* Commercial preferences */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Préférences commerciales</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="cust-lang">Langue contrat</Label>
                <Select value={language} onValueChange={(v) => setLanguage(v as ContractLanguage)}>
                  <SelectTrigger id="cust-lang"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((l) => (
                      <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="cust-currency">Devise</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger id="cust-currency"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="cust-inco">Incoterms préférés</Label>
                <Select value={incoterms} onValueChange={setIncoterms}>
                  <SelectTrigger id="cust-inco"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {INCOTERMS.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="cust-port">Port de destination</Label>
                <Input id="cust-port" value={portDest} onChange={(e) => setPortDest(e.target.value)}
                  placeholder="ex: Le Havre, Rotterdam..." />
              </div>
              <div className="col-span-2">
                <Label htmlFor="cust-payment">Conditions de paiement</Label>
                <Input id="cust-payment" value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  placeholder="ex: 30 jours net, L/C à vue..." />
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <Label htmlFor="cust-notes">Notes internes</Label>
            <Textarea id="cust-notes" rows={2} value={notes}
              onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Switch id="cust-active" checked={isActive} onCheckedChange={setIsActive} />
              <Label htmlFor="cust-active" className="text-sm">Client actif</Label>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? 'Enregistrement...' : initial ? 'Mettre à jour' : 'Créer client'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
