import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import { Supplier } from '@/types/mes';
import { SupplierCertification } from '@/lib/royalPalmPhase1';

interface SupplierDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier?: Supplier | null;
  onSave: (data: Omit<Supplier, 'id' | 'created_at' | 'updated_at'>) => void;
  isLoading?: boolean;
}

const actorTypes = [
  { value: 'producteur_direct', label: 'Producteur direct' },
  { value: 'collecteur', label: 'Collecteur' },
  { value: 'cooperative', label: 'Coopérative' },
  { value: 'societe', label: 'Société (ex. emballage)' },
] as const;

const regions = ['Tozeur', 'Kebili', 'Gabes', 'Gafsa', 'Autre'];
const farmingModes = [
  { value: 'traditionnel', label: 'Traditionnel oasien' },
  { value: 'moderne_intensif', label: 'Moderne intensif' },
  { value: 'biologique_certifie', label: 'Biologique certifié' },
] as const;
const irrigationSources = [
  { value: 'puits_artesien', label: 'Puits artésien' },
  { value: 'source_naturelle', label: 'Source naturelle' },
  { value: 'forage', label: 'Forage' },
  { value: 'reseau_gid', label: 'Réseau GID' },
] as const;
const contractTypes = [
  { value: 'annuel', label: 'Annuel' },
  { value: 'saisonnier', label: 'Saisonnier' },
  { value: 'ponctuel', label: 'Ponctuel' },
  { value: 'achat_sur_pied', label: 'Achat sur pied' },
] as const;
const paymentTerms = [
  { value: 'immediat', label: 'Paiement immédiat' },
  { value: '15_jours', label: '15 jours' },
  { value: '30_jours', label: '30 jours' },
  { value: 'avance_et_solde', label: 'Avance + solde' },
] as const;
const supplierStatuses = [
  { value: 'pending_approval', label: "En cours d'agrément" },
  { value: 'active', label: 'Actif' },
  { value: 'inactive', label: 'Inactif' },
  { value: 'blocked', label: 'Bloqué' },
  { value: 'archived', label: 'Archivé' },
] as const;
const identificationStatuses = [
  { value: 'unverified', label: 'Non vérifiée' },
  { value: 'verified', label: 'Vérifiée' },
  { value: 'expired', label: 'Expirée' },
  { value: 'rejected', label: 'Rejetée' },
] as const;
const qualificationStatuses = [
  { value: 'prospect', label: 'Prospect' },
  { value: 'qualified', label: 'Qualifié' },
  { value: 'approved', label: 'Agréé' },
  { value: 'suspended', label: 'Suspendu' },
  { value: 'blacklisted', label: 'Liste noire' },
] as const;
const complianceStatuses = [
  { value: 'compliant', label: 'Conforme' },
  { value: 'warning', label: 'À surveiller' },
  { value: 'non_compliant', label: 'Non conforme' },
] as const;
const certificationNames: SupplierCertification['name'][] = [
  'GlobalG.A.P.',
  'Bio UE',
  'Bio Tunisie',
  'Fair Trade',
];

const emptyForm = () => ({
  name: '',
  contact_name: '',
  email: '',
  phone: '',
  actor_type: 'producteur_direct' as NonNullable<Supplier['actor_type']>,
  region: 'Tozeur',
  supplier_status: 'pending_approval' as NonNullable<Supplier['supplier_status']>,
  fiscal_identifier: '',
  id_document_type: 'CIN',
  id_document_number: '',
  identification_status: 'unverified' as NonNullable<Supplier['identification_status']>,
  locality: '',
  oasis_name: '',
  farming_mode: 'traditionnel' as NonNullable<Supplier['farming_mode']>,
  irrigation_source: 'puits_artesien' as NonNullable<Supplier['irrigation_source']>,
  contract_type: 'saisonnier' as NonNullable<Supplier['contract_type']>,
  contract_start_date: '',
  contract_end_date: '',
  payment_terms: 'immediat' as NonNullable<Supplier['payment_terms']>,
  bank_rib: '',
  agreed_price_tnd_per_kg: '',
  certifications: [] as SupplierCertification[],
  qualification_status: 'prospect' as NonNullable<Supplier['qualification_status']>,
  compliance_status: 'warning' as NonNullable<Supplier['compliance_status']>,
  qualification_notes: '',
});

type FormState = ReturnType<typeof emptyForm>;

const OptionalSection = ({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-lg border">
      <CollapsibleTrigger asChild>
        <button type="button" className="flex w-full items-center justify-between px-3 py-2.5 text-sm font-medium">
          {title}
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 border-t px-3 py-3">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
};

export const SupplierDialog = ({ open, onOpenChange, supplier, onSave, isLoading }: SupplierDialogProps) => {
  const [formData, setFormData] = useState<FormState>(emptyForm());
  const [formError, setFormError] = useState<string | null>(null);
  const isEdit = Boolean(supplier);

  useEffect(() => {
    if (!open) return;
    if (supplier) {
      setFormData({
        name: supplier.name || '',
        contact_name: supplier.contact_name || '',
        email: supplier.email || '',
        phone: supplier.phone || '',
        actor_type: supplier.actor_type || 'producteur_direct',
        region: supplier.region || 'Tozeur',
        supplier_status: supplier.supplier_status || 'pending_approval',
        fiscal_identifier: supplier.fiscal_identifier || '',
        id_document_type: supplier.id_document_type || 'CIN',
        id_document_number: supplier.id_document_number || '',
        identification_status: supplier.identification_status || 'unverified',
        locality: supplier.locality || '',
        oasis_name: supplier.oasis_name || '',
        farming_mode: supplier.farming_mode || 'traditionnel',
        irrigation_source: supplier.irrigation_source || 'puits_artesien',
        contract_type: supplier.contract_type || 'saisonnier',
        contract_start_date: supplier.contract_start_date || '',
        contract_end_date: supplier.contract_end_date || '',
        payment_terms: supplier.payment_terms || 'immediat',
        bank_rib: supplier.bank_rib || '',
        agreed_price_tnd_per_kg: supplier.agreed_price_tnd_per_kg?.toString() || '',
        certifications: supplier.certifications || [],
        qualification_status: supplier.qualification_status || 'prospect',
        compliance_status: supplier.compliance_status || 'warning',
        qualification_notes: supplier.qualification_notes || '',
      });
      setFormError(null);
      return;
    }
    setFormData(emptyForm());
    setFormError(null);
  }, [supplier, open]);

  const setField = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setFormData((current) => ({ ...current, [field]: value }));
  };

  const toggleCertification = (name: SupplierCertification['name']) => {
    setFormData((current) => ({
      ...current,
      certifications: current.certifications.some((certification) => certification.name === name)
        ? current.certifications.filter((certification) => certification.name !== name)
        : [...current.certifications, { name, validUntil: '' }],
    }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!formData.name.trim()) {
      setFormError('Le nom est obligatoire.');
      return;
    }
    if (
      formData.contract_start_date &&
      formData.contract_end_date &&
      new Date(formData.contract_end_date).getTime() <= new Date(formData.contract_start_date).getTime()
    ) {
      setFormError('La date de fin du contrat doit être postérieure à la date de début.');
      return;
    }
    setFormError(null);

    const existingRecords = supplier?.contract_records ?? [];
    const primary = existingRecords[0];
    const nextPrimary = {
      reference: primary?.reference || null,
      type: formData.contract_type,
      status: primary?.status || 'draft',
      start_date: formData.contract_start_date || primary?.start_date || null,
      end_date: formData.contract_end_date || primary?.end_date || null,
      document_url: primary?.document_url || null,
      compliance_status: formData.compliance_status,
      notes: primary?.notes || null,
    };

    onSave({
      code: supplier?.code || '',
      name: formData.name.trim(),
      contact_name: formData.contact_name.trim() || null,
      email: formData.email.trim() || null,
      phone: formData.phone.trim() || null,
      address: supplier?.address || null,
      city: supplier?.city || null,
      country: supplier?.country || 'Tunisie',
      is_active: formData.supplier_status === 'active',
      rating: supplier?.rating ?? 0,
      actor_type: formData.actor_type,
      nickname: supplier?.nickname || null,
      name_ar: supplier?.name_ar || null,
      contact_name_ar: supplier?.contact_name_ar || null,
      address_ar: supplier?.address_ar || null,
      fiscal_identifier: formData.fiscal_identifier.trim() || null,
      tax_registration_number: supplier?.tax_registration_number || null,
      id_document_type: formData.id_document_type.trim() || null,
      id_document_number: formData.id_document_number.trim() || null,
      identification_status: formData.identification_status,
      identification_notes: supplier?.identification_notes || null,
      secondary_phone: supplier?.secondary_phone || null,
      postal_address: supplier?.postal_address || null,
      cin_document_url: supplier?.cin_document_url || null,
      region: formData.region,
      locality: formData.locality.trim() || null,
      oasis_name: formData.oasis_name.trim() || null,
      gps_coordinates: supplier?.gps_coordinates || null,
      produced_varieties: supplier?.produced_varieties?.length ? supplier.produced_varieties : ['Deglet Nour'],
      exploited_area_ha: supplier?.exploited_area_ha ?? null,
      palm_tree_count: supplier?.palm_tree_count ?? null,
      annual_production_tons: supplier?.annual_production_tons ?? null,
      farming_mode: formData.farming_mode,
      irrigation_source: formData.irrigation_source,
      contract_type: formData.contract_type,
      contract_start_date: formData.contract_start_date || null,
      contract_end_date: formData.contract_end_date || null,
      payment_terms: formData.payment_terms,
      bank_rib: formData.bank_rib.trim() || null,
      agreed_price_tnd_per_kg: formData.agreed_price_tnd_per_kg ? Number(formData.agreed_price_tnd_per_kg) : null,
      certifications: formData.certifications,
      contract_documents: supplier?.contract_documents || [],
      // Preserve extra contract rows on edit; only refresh the primary commercial fields.
      contract_records: existingRecords.length > 0
        ? [nextPrimary, ...existingRecords.slice(1)]
        : formData.contract_start_date || formData.contract_end_date
          ? [nextPrimary]
          : [],
      supplier_status: formData.supplier_status,
      qualification_status: formData.qualification_status,
      compliance_status: formData.compliance_status,
      risk_level: supplier?.risk_level || 'medium',
      onboarding_date: supplier?.onboarding_date || null,
      approval_date: supplier?.approval_date || null,
      approved_by: supplier?.approved_by || null,
      last_audit_date: supplier?.last_audit_date || null,
      next_audit_date: supplier?.next_audit_date || null,
      audit_score: supplier?.audit_score ?? 0,
      qualification_notes: formData.qualification_notes.trim() || null,
      quality_score: supplier?.quality_score ?? 0,
      delivery_reliability_score: supplier?.delivery_reliability_score ?? 0,
      traceability_score: supplier?.traceability_score ?? 0,
      delivered_lots_count: supplier?.delivered_lots_count ?? 0,
      total_delivered_tons: supplier?.total_delivered_tons ?? 0,
      rejection_rate: supplier?.rejection_rate ?? 0,
      last_delivery_date: supplier?.last_delivery_date || null,
      last_evaluation_date: supplier?.last_evaluation_date || null,
      next_evaluation_date: supplier?.next_evaluation_date || null,
      total_paid_amount_tnd: supplier?.total_paid_amount_tnd ?? 0,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Modifier le fournisseur' : 'Nouveau fournisseur'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <ScrollArea className="max-h-[65vh] pr-3">
            <div className="space-y-4 pb-2">
              <section className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Essentiel</p>
                <div className="space-y-2">
                  <Label htmlFor="supplier-name">Nom *</Label>
                  <Input
                    id="supplier-name"
                    required
                    value={formData.name}
                    onChange={(event) => setField('name', event.target.value)}
                    placeholder="Ex. Ben Amor Ahmed"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Type d'acteur</Label>
                    <Select value={formData.actor_type} onValueChange={(value) => setField('actor_type', value as FormState['actor_type'])}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {actorTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Région</Label>
                    <Select value={formData.region} onValueChange={(value) => setField('region', value)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {regions.map((region) => (
                          <SelectItem key={region} value={region}>{region}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="supplier-phone">Téléphone</Label>
                    <Input id="supplier-phone" value={formData.phone} onChange={(event) => setField('phone', event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="supplier-contact">Contact</Label>
                    <Input id="supplier-contact" value={formData.contact_name} onChange={(event) => setField('contact_name', event.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="supplier-email">Email (portail)</Label>
                  <Input id="supplier-email" type="email" value={formData.email} onChange={(event) => setField('email', event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Statut</Label>
                  <Select value={formData.supplier_status} onValueChange={(value) => setField('supplier_status', value as FormState['supplier_status'])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {supplierStatuses.map((status) => (
                        <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </section>

              <OptionalSection title="Identité légale">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>CIN / Matricule</Label>
                    <Input value={formData.fiscal_identifier} onChange={(event) => setField('fiscal_identifier', event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>N° pièce</Label>
                    <Input value={formData.id_document_number} onChange={(event) => setField('id_document_number', event.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Statut identification</Label>
                  <Select value={formData.identification_status} onValueChange={(value) => setField('identification_status', value as FormState['identification_status'])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {identificationStatuses.map((status) => (
                        <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </OptionalSection>

              <OptionalSection title="Oasis / exploitation">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Localité</Label>
                    <Input value={formData.locality} onChange={(event) => setField('locality', event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Oasis</Label>
                    <Input value={formData.oasis_name} onChange={(event) => setField('oasis_name', event.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Mode de culture</Label>
                    <Select value={formData.farming_mode} onValueChange={(value) => setField('farming_mode', value as FormState['farming_mode'])}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {farmingModes.map((mode) => (
                          <SelectItem key={mode.value} value={mode.value}>{mode.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Irrigation</Label>
                    <Select value={formData.irrigation_source} onValueChange={(value) => setField('irrigation_source', value as FormState['irrigation_source'])}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {irrigationSources.map((source) => (
                          <SelectItem key={source.value} value={source.value}>{source.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </OptionalSection>

              <OptionalSection title="Commercial">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Type de contrat</Label>
                    <Select value={formData.contract_type} onValueChange={(value) => setField('contract_type', value as FormState['contract_type'])}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {contractTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Conditions de paiement</Label>
                    <Select value={formData.payment_terms} onValueChange={(value) => setField('payment_terms', value as FormState['payment_terms'])}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {paymentTerms.map((term) => (
                          <SelectItem key={term.value} value={term.value}>{term.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Début contrat</Label>
                    <Input type="date" value={formData.contract_start_date} onChange={(event) => setField('contract_start_date', event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Fin contrat</Label>
                    <Input type="date" value={formData.contract_end_date} onChange={(event) => setField('contract_end_date', event.target.value)} />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Si les dates sont vides à la création, le serveur pose une saison d&apos;un an.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Prix convenu (TND/kg)</Label>
                    <Input type="number" step="0.01" value={formData.agreed_price_tnd_per_kg} onChange={(event) => setField('agreed_price_tnd_per_kg', event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>RIB</Label>
                    <Input value={formData.bank_rib} onChange={(event) => setField('bank_rib', event.target.value)} />
                  </div>
                </div>
              </OptionalSection>

              <OptionalSection title="Conformité">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Qualification</Label>
                    <Select value={formData.qualification_status} onValueChange={(value) => setField('qualification_status', value as FormState['qualification_status'])}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {qualificationStatuses.map((status) => (
                          <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Conformité</Label>
                    <Select value={formData.compliance_status} onValueChange={(value) => setField('compliance_status', value as FormState['compliance_status'])}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {complianceStatuses.map((status) => (
                          <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Certifications</Label>
                  <div className="flex flex-wrap gap-2">
                    {certificationNames.map((name) => {
                      const active = formData.certifications.some((certification) => certification.name === name);
                      return (
                        <Button
                          key={name}
                          type="button"
                          size="sm"
                          variant={active ? 'default' : 'outline'}
                          onClick={() => toggleCertification(name)}
                        >
                          {name}
                        </Button>
                      );
                    })}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea value={formData.qualification_notes} onChange={(event) => setField('qualification_notes', event.target.value)} rows={3} />
                </div>
              </OptionalSection>
            </div>
          </ScrollArea>

          {formError && <p className="text-sm text-destructive">{formError}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" disabled={isLoading}>{isLoading ? 'Enregistrement…' : 'Enregistrer'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

