import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
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
  { value: 'cooperative', label: 'Cooperative' },
  { value: 'societe', label: 'Societe' },
] as const;

const regions = ['Tozeur', 'Kebili', 'Gabes', 'Gafsa', 'Autre'];
const varieties = ['Deglet Nour', 'Allig', 'Khouat Allig', 'Kenta', 'Arechti', 'Autre'];
const farmingModes = [
  { value: 'traditionnel', label: 'Traditionnel oasien' },
  { value: 'moderne_intensif', label: 'Moderne intensif' },
  { value: 'biologique_certifie', label: 'Biologique certifie' },
] as const;
const irrigationSources = [
  { value: 'puits_artesien', label: 'Puits artesien' },
  { value: 'source_naturelle', label: 'Source naturelle' },
  { value: 'forage', label: 'Forage' },
  { value: 'reseau_gid', label: 'Reseau GID' },
] as const;
const contractTypes = [
  { value: 'annuel', label: 'Annuel (engagement saison)' },
  { value: 'saisonnier', label: 'Saisonnier (renouvellement)' },
  { value: 'ponctuel', label: 'Ponctuel (sans engagement)' },
  { value: 'achat_sur_pied', label: 'بيع على الشجر (pied sur Achat)' },
] as const;
const paymentTerms = [
  { value: 'immediat', label: 'Paiement immediat' },
  { value: '15_jours', label: '15 jours' },
  { value: '30_jours', label: '30 jours' },
  { value: 'avance_et_solde', label: 'Avance recolte + solde livraison' },
] as const;
const supplierStatuses = [
  { value: 'pending_approval', label: "En cours d'agrement" },
  { value: 'active', label: 'Actif' },
  { value: 'inactive', label: 'Inactif' },
  { value: 'blocked', label: 'Bloque' },
  { value: 'archived', label: 'Archive' },
] as const;
const identificationStatuses = [
  { value: 'unverified', label: 'Non verifiee' },
  { value: 'verified', label: 'Verifiee' },
  { value: 'expired', label: 'Expiree' },
  { value: 'rejected', label: 'Rejetee' },
] as const;
const qualificationStatuses = [
  { value: 'prospect', label: 'Prospect' },
  { value: 'qualified', label: 'Qualifie' },
  { value: 'approved', label: 'Agreé' },
  { value: 'suspended', label: 'Suspendu' },
  { value: 'blacklisted', label: 'Liste noire' },
] as const;
const complianceStatuses = [
  { value: 'compliant', label: 'Conforme' },
  { value: 'warning', label: 'A surveiller' },
  { value: 'non_compliant', label: 'Non conforme' },
] as const;
const riskLevels = [
  { value: 'low', label: 'Faible' },
  { value: 'medium', label: 'Moyen' },
  { value: 'high', label: 'Eleve' },
] as const;
const contractStatuses = [
  { value: 'draft', label: 'Brouillon' },
  { value: 'active', label: 'Actif' },
  { value: 'expired', label: 'Expire' },
  { value: 'terminated', label: 'Resilie' },
  { value: 'under_review', label: 'En revue' },
] as const;
const certificationNames: SupplierCertification['name'][] = [
  'GlobalG.A.P.',
  'Bio UE',
  'Bio Tunisie',
  'Fair Trade',
];

const todayDateInput = () => {
  const now = new Date();
  const timezoneOffsetMs = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - timezoneOffsetMs).toISOString().slice(0, 10);
};

const dateInputPattern = /^\d{4}-\d{2}-\d{2}$/;

const emptyForm = () => ({
  code: '',
  name: '',
  contact_name: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  country: 'Tunisie',
  is_active: true,
  rating: 0,
  actor_type: 'collecteur' as NonNullable<Supplier['actor_type']>,
  nickname: '',
  name_ar: '',
  contact_name_ar: '',
  address_ar: '',
  fiscal_identifier: '',
  tax_registration_number: '',
  id_document_type: 'CIN',
  id_document_number: '',
  identification_status: 'unverified' as NonNullable<Supplier['identification_status']>,
  identification_notes: '',
  secondary_phone: '',
  postal_address: '',
  cin_document_url: '',
  region: 'Tozeur',
  locality: '',
  oasis_name: '',
  gps_coordinates: '',
  produced_varieties: ['Deglet Nour'],
  exploited_area_ha: '',
  palm_tree_count: '',
  annual_production_tons: '',
  farming_mode: 'traditionnel' as NonNullable<Supplier['farming_mode']>,
  irrigation_source: 'puits_artesien' as NonNullable<Supplier['irrigation_source']>,
  contract_type: 'saisonnier' as NonNullable<Supplier['contract_type']>,
  contract_reference: '',
  contract_status: 'draft' as NonNullable<Supplier['contract_records']>[number]['status'],
  contract_start_date: todayDateInput(),
  contract_end_date: '',
  contract_document_url: '',
  contract_compliance_status: 'warning' as NonNullable<Supplier['compliance_status']>,
  contract_notes: '',
  payment_terms: 'immediat' as NonNullable<Supplier['payment_terms']>,
  bank_rib: '',
  agreed_price_tnd_per_kg: '',
  certifications: [] as SupplierCertification[],
  contract_documents: [] as string[],
  supplier_status: 'pending_approval' as NonNullable<Supplier['supplier_status']>,
  qualification_status: 'prospect' as NonNullable<Supplier['qualification_status']>,
  compliance_status: 'warning' as NonNullable<Supplier['compliance_status']>,
  risk_level: 'medium' as NonNullable<Supplier['risk_level']>,
  onboarding_date: new Date().toISOString().slice(0, 10),
  approval_date: '',
  approved_by: '',
  last_audit_date: '',
  next_audit_date: '',
  audit_score: '',
  qualification_notes: '',
  quality_score: '',
  delivery_reliability_score: '',
  traceability_score: '',
  delivered_lots_count: '',
  total_delivered_tons: '',
  rejection_rate: '',
  last_delivery_date: '',
  last_evaluation_date: '',
  next_evaluation_date: '',
  total_paid_amount_tnd: '',
});

export const SupplierDialog = ({ open, onOpenChange, supplier, onSave, isLoading }: SupplierDialogProps) => {
  const [formData, setFormData] = useState(emptyForm());
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    if (supplier) {
      const primaryContract = supplier.contract_records?.[0];
      setFormData({
        code: supplier.code || '',
        name: supplier.name || '',
        contact_name: supplier.contact_name || '',
        email: supplier.email || '',
        phone: supplier.phone || '',
        address: supplier.address || '',
        city: supplier.city || '',
        country: supplier.country || 'Tunisie',
        is_active: supplier.is_active ?? true,
        rating: supplier.rating ?? 0,
        actor_type: supplier.actor_type || 'collecteur',
        nickname: supplier.nickname || '',
        name_ar: supplier.name_ar || '',
        contact_name_ar: supplier.contact_name_ar || '',
        address_ar: supplier.address_ar || '',
        fiscal_identifier: supplier.fiscal_identifier || '',
        tax_registration_number: supplier.tax_registration_number || '',
        id_document_type: supplier.id_document_type || 'CIN',
        id_document_number: supplier.id_document_number || '',
        identification_status: supplier.identification_status || 'unverified',
        identification_notes: supplier.identification_notes || '',
        secondary_phone: supplier.secondary_phone || '',
        postal_address: supplier.postal_address || '',
        cin_document_url: supplier.cin_document_url || '',
        region: supplier.region || 'Tozeur',
        locality: supplier.locality || '',
        oasis_name: supplier.oasis_name || '',
        gps_coordinates: supplier.gps_coordinates || '',
        produced_varieties: supplier.produced_varieties?.length ? supplier.produced_varieties : ['Deglet Nour'],
        exploited_area_ha: supplier.exploited_area_ha?.toString() || '',
        palm_tree_count: supplier.palm_tree_count?.toString() || '',
        annual_production_tons: supplier.annual_production_tons?.toString() || '',
        farming_mode: supplier.farming_mode || 'traditionnel',
        irrigation_source: supplier.irrigation_source || 'puits_artesien',
        contract_type: supplier.contract_type || 'saisonnier',
        contract_reference: primaryContract?.reference || '',
        contract_status: primaryContract?.status || 'draft',
        contract_start_date: supplier.contract_start_date || primaryContract?.start_date || todayDateInput(),
        contract_end_date: supplier.contract_end_date || '',
        contract_document_url: primaryContract?.document_url || supplier.contract_documents?.[0] || '',
        contract_compliance_status: primaryContract?.compliance_status || supplier.compliance_status || 'warning',
        contract_notes: primaryContract?.notes || '',
        payment_terms: supplier.payment_terms || 'immediat',
        bank_rib: supplier.bank_rib || '',
        agreed_price_tnd_per_kg: supplier.agreed_price_tnd_per_kg?.toString() || '',
        certifications: supplier.certifications || [],
        contract_documents: supplier.contract_documents || [],
        supplier_status: supplier.supplier_status || 'pending_approval',
        qualification_status: supplier.qualification_status || 'prospect',
        compliance_status: supplier.compliance_status || 'warning',
        risk_level: supplier.risk_level || 'medium',
        onboarding_date: supplier.onboarding_date || '',
        approval_date: supplier.approval_date || '',
        approved_by: supplier.approved_by || '',
        last_audit_date: supplier.last_audit_date || '',
        next_audit_date: supplier.next_audit_date || '',
        audit_score: supplier.audit_score?.toString() || '',
        qualification_notes: supplier.qualification_notes || '',
        quality_score: supplier.quality_score?.toString() || '',
        delivery_reliability_score: supplier.delivery_reliability_score?.toString() || '',
        traceability_score: supplier.traceability_score?.toString() || '',
        delivered_lots_count: supplier.delivered_lots_count?.toString() || '',
        total_delivered_tons: supplier.total_delivered_tons?.toString() || '',
        rejection_rate: supplier.rejection_rate?.toString() || '',
        last_delivery_date: supplier.last_delivery_date || '',
        last_evaluation_date: supplier.last_evaluation_date || '',
        next_evaluation_date: supplier.next_evaluation_date || '',
        total_paid_amount_tnd: supplier.total_paid_amount_tnd?.toString() || '',
      });
      return;
    }

    setFormData(emptyForm());
    setFormError(null);
  }, [supplier, open]);

  const toggleVariety = (value: string) => {
    setFormData((current) => ({
      ...current,
      produced_varieties: current.produced_varieties.includes(value)
        ? current.produced_varieties.filter((entry) => entry !== value)
        : [...current.produced_varieties, value],
    }));
  };

  const toggleCertification = (name: SupplierCertification['name']) => {
    setFormData((current) => ({
      ...current,
      certifications: current.certifications.some((certification) => certification.name === name)
        ? current.certifications.filter((certification) => certification.name !== name)
        : [...current.certifications, { name, validUntil: '' }],
    }));
  };

  const updateCertificationDate = (name: SupplierCertification['name'], validUntil: string) => {
    setFormData((current) => ({
      ...current,
      certifications: current.certifications.map((certification) =>
        certification.name === name ? { ...certification, validUntil } : certification,
      ),
    }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (!formData.contract_type) {
      setFormError('Le type de contrat est obligatoire.');
      return;
    }

    if (!dateInputPattern.test(formData.contract_start_date)) {
      setFormError('La date de debut du contrat est obligatoire et doit etre valide.');
      return;
    }

    if (!dateInputPattern.test(formData.contract_end_date)) {
      setFormError('La date de fin du contrat est obligatoire et doit etre valide.');
      return;
    }

    if (new Date(formData.contract_end_date).getTime() <= new Date(formData.contract_start_date).getTime()) {
      setFormError('La date de fin du contrat doit etre posterieure a la date de debut.');
      return;
    }

    setFormError(null);

    onSave({
      code: formData.code.trim(),
      name: formData.name.trim(),
      contact_name: formData.contact_name.trim() || null,
      email: formData.email.trim() || null,
      phone: formData.phone.trim() || null,
      address: formData.address.trim() || null,
      city: formData.city.trim() || null,
      country: formData.country.trim() || 'Tunisie',
      is_active: formData.is_active,
      rating: Number(formData.rating || 0),
      actor_type: formData.actor_type,
      nickname: formData.nickname.trim() || null,
      name_ar: formData.name_ar.trim() || null,
      contact_name_ar: formData.contact_name_ar.trim() || null,
      address_ar: formData.address_ar.trim() || null,
      fiscal_identifier: formData.fiscal_identifier.trim() || null,
      tax_registration_number: formData.tax_registration_number.trim() || null,
      id_document_type: formData.id_document_type.trim() || null,
      id_document_number: formData.id_document_number.trim() || null,
      identification_status: formData.identification_status,
      identification_notes: formData.identification_notes.trim() || null,
      secondary_phone: formData.secondary_phone.trim() || null,
      postal_address: formData.postal_address.trim() || null,
      cin_document_url: formData.cin_document_url.trim() || null,
      region: formData.region,
      locality: formData.locality.trim() || null,
      oasis_name: formData.oasis_name.trim() || null,
      gps_coordinates: formData.gps_coordinates.trim() || null,
      produced_varieties: formData.produced_varieties,
      exploited_area_ha: formData.exploited_area_ha ? Number(formData.exploited_area_ha) : null,
      palm_tree_count: formData.palm_tree_count ? Number(formData.palm_tree_count) : null,
      annual_production_tons: formData.annual_production_tons ? Number(formData.annual_production_tons) : null,
      farming_mode: formData.farming_mode,
      irrigation_source: formData.irrigation_source,
      contract_type: formData.contract_type,
      contract_start_date: formData.contract_start_date || null,
      contract_end_date: formData.contract_end_date || null,
      payment_terms: formData.payment_terms,
      bank_rib: formData.bank_rib.trim() || null,
      agreed_price_tnd_per_kg: formData.agreed_price_tnd_per_kg ? Number(formData.agreed_price_tnd_per_kg) : null,
      certifications: formData.certifications.filter((certification) => certification.name),
      contract_documents: [formData.contract_document_url, ...formData.contract_documents].filter(Boolean),
      contract_records: [
        {
          reference: formData.contract_reference.trim() || null,
          type: formData.contract_type,
          status: formData.contract_status,
          start_date: formData.contract_start_date || null,
          end_date: formData.contract_end_date || null,
          document_url: formData.contract_document_url.trim() || null,
          compliance_status: formData.contract_compliance_status,
          notes: formData.contract_notes.trim() || null,
        },
      ],
      supplier_status: formData.supplier_status,
      qualification_status: formData.qualification_status,
      compliance_status: formData.compliance_status,
      risk_level: formData.risk_level,
      onboarding_date: formData.onboarding_date || null,
      approval_date: formData.approval_date || null,
      approved_by: formData.approved_by.trim() || null,
      last_audit_date: formData.last_audit_date || null,
      next_audit_date: formData.next_audit_date || null,
      audit_score: formData.audit_score ? Number(formData.audit_score) : 0,
      qualification_notes: formData.qualification_notes.trim() || null,
      quality_score: formData.quality_score ? Number(formData.quality_score) : 0,
      delivery_reliability_score: formData.delivery_reliability_score ? Number(formData.delivery_reliability_score) : 0,
      traceability_score: formData.traceability_score ? Number(formData.traceability_score) : 0,
      delivered_lots_count: formData.delivered_lots_count ? Number(formData.delivered_lots_count) : 0,
      total_delivered_tons: formData.total_delivered_tons ? Number(formData.total_delivered_tons) : 0,
      rejection_rate: formData.rejection_rate ? Number(formData.rejection_rate) : 0,
      last_delivery_date: formData.last_delivery_date || null,
      last_evaluation_date: formData.last_evaluation_date || null,
      next_evaluation_date: formData.next_evaluation_date || null,
      total_paid_amount_tnd: formData.total_paid_amount_tnd ? Number(formData.total_paid_amount_tnd) : 0,
    });
  };

  const setField = <K extends keyof typeof formData>(field: K, value: (typeof formData)[K]) => {
    setFormData((current) => ({ ...current, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>{supplier ? 'Modifier la fiche fournisseur Royal Palm' : 'Nouvelle fiche fournisseur Royal Palm'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <ScrollArea className="h-[70vh] pr-5">
            <div className="space-y-6">
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Identite</h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Label htmlFor="is_active">Actif</Label>
                    <Switch
                      id="is_active"
                      checked={formData.is_active}
                      onCheckedChange={(checked) => setField('is_active', checked)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Code fournisseur</Label>
                    <Input
                      value={formData.code}
                      onChange={(event) => setField('code', event.target.value)}
                      placeholder="Auto-genere si vide"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Type d'acteur *</Label>
                    <Select value={formData.actor_type} onValueChange={(value) => setField('actor_type', value as typeof formData.actor_type)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {actorTypes.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Statut</Label>
                    <Select value={formData.supplier_status} onValueChange={(value) => setField('supplier_status', value as typeof formData.supplier_status)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {supplierStatuses.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nom / raison sociale *</Label>
                    <Input value={formData.name} onChange={(event) => setField('name', event.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>الاسم بالعربية</Label>
                    <Input dir="auto" value={formData.name_ar} onChange={(event) => setField('name_ar', event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Surnom / nom usuel</Label>
                    <Input value={formData.nickname} onChange={(event) => setField('nickname', event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>CIN / matricule fiscal</Label>
                    <Input value={formData.fiscal_identifier} onChange={(event) => setField('fiscal_identifier', event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Contact principal</Label>
                    <Input value={formData.contact_name} onChange={(event) => setField('contact_name', event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>اسم جهة الاتصال</Label>
                    <Input dir="auto" value={formData.contact_name_ar} onChange={(event) => setField('contact_name_ar', event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Telephone principal</Label>
                    <Input value={formData.phone} onChange={(event) => setField('phone', event.target.value)} placeholder="+216 XX XXX XXX" />
                  </div>
                  <div className="space-y-2">
                    <Label>Telephone secondaire</Label>
                    <Input value={formData.secondary_phone} onChange={(event) => setField('secondary_phone', event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input type="email" value={formData.email} onChange={(event) => setField('email', event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Document CIN / registre</Label>
                    <Input value={formData.cin_document_url} onChange={(event) => setField('cin_document_url', event.target.value)} placeholder="URL ou chemin document" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Adresse postale</Label>
                  <Textarea value={formData.postal_address} onChange={(event) => setField('postal_address', event.target.value)} rows={2} />
                </div>
                <div className="space-y-2">
                  <Label>العنوان بالعربية</Label>
                  <Textarea dir="auto" value={formData.address_ar} onChange={(event) => setField('address_ar', event.target.value)} rows={2} />
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-sm font-semibold">Identification et qualification initiale</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Statut identification</Label>
                    <Select value={formData.identification_status} onValueChange={(value) => setField('identification_status', value as typeof formData.identification_status)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {identificationStatuses.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Type document</Label>
                    <Input value={formData.id_document_type} onChange={(event) => setField('id_document_type', event.target.value)} placeholder="CIN, registre commerce" />
                  </div>
                  <div className="space-y-2">
                    <Label>N° document</Label>
                    <Input value={formData.id_document_number} onChange={(event) => setField('id_document_number', event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Matricule fiscal</Label>
                    <Input value={formData.tax_registration_number} onChange={(event) => setField('tax_registration_number', event.target.value)} />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Notes identification</Label>
                    <Textarea value={formData.identification_notes} onChange={(event) => setField('identification_notes', event.target.value)} rows={2} />
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-sm font-semibold">Oasis et production</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Region</Label>
                    <Select value={formData.region} onValueChange={(value) => setField('region', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {regions.map((region) => (
                          <SelectItem key={region} value={region}>
                            {region}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Ville / localite</Label>
                    <Input value={formData.locality} onChange={(event) => setField('locality', event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Nom de l'oasis</Label>
                    <Input value={formData.oasis_name} onChange={(event) => setField('oasis_name', event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Coordonnees GPS</Label>
                    <Input value={formData.gps_coordinates} onChange={(event) => setField('gps_coordinates', event.target.value)} placeholder="33.9197, 8.1342" />
                  </div>
                  <div className="space-y-2">
                    <Label>Surface exploitee (ha)</Label>
                    <Input type="number" min="0" step="0.1" value={formData.exploited_area_ha} onChange={(event) => setField('exploited_area_ha', event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Nombre de palmiers</Label>
                    <Input type="number" min="0" value={formData.palm_tree_count} onChange={(event) => setField('palm_tree_count', event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Production annuelle estimee (T)</Label>
                    <Input type="number" min="0" step="0.1" value={formData.annual_production_tons} onChange={(event) => setField('annual_production_tons', event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Mode de culture</Label>
                    <Select value={formData.farming_mode} onValueChange={(value) => setField('farming_mode', value as typeof formData.farming_mode)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {farmingModes.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Irrigue par</Label>
                    <Select value={formData.irrigation_source} onValueChange={(value) => setField('irrigation_source', value as typeof formData.irrigation_source)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {irrigationSources.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Varietes produites</Label>
                  <div className="flex flex-wrap gap-2">
                    {varieties.map((variety) => (
                      <Button
                        key={variety}
                        type="button"
                        variant={formData.produced_varieties.includes(variety) ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => toggleVariety(variety)}
                      >
                        {variety}
                      </Button>
                    ))}
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-sm font-semibold">Commercial et contractuel</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Reference contrat</Label>
                    <Input value={formData.contract_reference} onChange={(event) => setField('contract_reference', event.target.value)} placeholder="CTR-RP-2026-001" />
                  </div>
                  <div className="space-y-2">
                    <Label>Type de contrat *</Label>
                    <Select value={formData.contract_type} onValueChange={(value) => setField('contract_type', value as typeof formData.contract_type)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {contractTypes.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            <span dir={option.value === 'achat_sur_pied' ? 'auto' : 'ltr'}>{option.label}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Statut contrat</Label>
                    <Select value={formData.contract_status} onValueChange={(value) => setField('contract_status', value as typeof formData.contract_status)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {contractStatuses.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Date debut contrat *</Label>
                    <Input type="date" required value={formData.contract_start_date} onChange={(event) => setField('contract_start_date', event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Date fin contrat *</Label>
                    <Input type="date" required min={formData.contract_start_date || undefined} value={formData.contract_end_date} onChange={(event) => setField('contract_end_date', event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Conditions de paiement</Label>
                    <Select value={formData.payment_terms} onValueChange={(value) => setField('payment_terms', value as typeof formData.payment_terms)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {paymentTerms.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>RIB bancaire</Label>
                    <Input value={formData.bank_rib} onChange={(event) => setField('bank_rib', event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Prix convenu (TND/kg)</Label>
                    <Input type="number" min="0" step="0.01" value={formData.agreed_price_tnd_per_kg} onChange={(event) => setField('agreed_price_tnd_per_kg', event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Document contrat</Label>
                    <Input value={formData.contract_document_url} onChange={(event) => setField('contract_document_url', event.target.value)} placeholder="URL ou chemin document" />
                  </div>
                  <div className="space-y-2">
                    <Label>Conformite contrat</Label>
                    <Select value={formData.contract_compliance_status} onValueChange={(value) => setField('contract_compliance_status', value as typeof formData.contract_compliance_status)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {complianceStatuses.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Notes contrat</Label>
                    <Textarea value={formData.contract_notes} onChange={(event) => setField('contract_notes', event.target.value)} rows={2} />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>Certifications</Label>
                  <div className="flex flex-wrap gap-2">
                    {certificationNames.map((name) => {
                      const selected = formData.certifications.some((certification) => certification.name === name);
                      return (
                        <Button
                          key={name}
                          type="button"
                          variant={selected ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => toggleCertification(name)}
                        >
                          {name}
                        </Button>
                      );
                    })}
                  </div>
                  {formData.certifications.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {formData.certifications.map((certification) => (
                        <div key={certification.name} className="rounded-lg border p-3 space-y-2">
                          <Badge variant="secondary">{certification.name}</Badge>
                          <div className="space-y-1">
                            <Label>Validite</Label>
                            <Input
                              type="date"
                              value={certification.validUntil || ''}
                              onChange={(event) => updateCertificationDate(certification.name, event.target.value)}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-sm font-semibold">Agrement, risque et conformite</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Qualification</Label>
                    <Select value={formData.qualification_status} onValueChange={(value) => setField('qualification_status', value as typeof formData.qualification_status)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {qualificationStatuses.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Conformite</Label>
                    <Select value={formData.compliance_status} onValueChange={(value) => setField('compliance_status', value as typeof formData.compliance_status)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {complianceStatuses.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Niveau de risque</Label>
                    <Select value={formData.risk_level} onValueChange={(value) => setField('risk_level', value as typeof formData.risk_level)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {riskLevels.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Date onboarding</Label>
                    <Input type="date" value={formData.onboarding_date} onChange={(event) => setField('onboarding_date', event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Date agrement</Label>
                    <Input type="date" value={formData.approval_date} onChange={(event) => setField('approval_date', event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Approuve par</Label>
                    <Input value={formData.approved_by} onChange={(event) => setField('approved_by', event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Score audit (/100)</Label>
                    <Input type="number" min="0" max="100" step="0.1" value={formData.audit_score} onChange={(event) => setField('audit_score', event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Dernier audit</Label>
                    <Input type="date" value={formData.last_audit_date} onChange={(event) => setField('last_audit_date', event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Prochain audit</Label>
                    <Input type="date" value={formData.next_audit_date} onChange={(event) => setField('next_audit_date', event.target.value)} />
                  </div>
                  <div className="space-y-2 md:col-span-3">
                    <Label>Notes qualification</Label>
                    <Textarea value={formData.qualification_notes} onChange={(event) => setField('qualification_notes', event.target.value)} rows={2} />
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-sm font-semibold">Performance suivie</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Score qualite (/100)</Label>
                    <Input type="number" min="0" max="100" step="0.1" value={formData.quality_score} onChange={(event) => setField('quality_score', event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Fiabilite livraison (/100)</Label>
                    <Input type="number" min="0" max="100" step="0.1" value={formData.delivery_reliability_score} onChange={(event) => setField('delivery_reliability_score', event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Score tracabilite (/100)</Label>
                    <Input type="number" min="0" max="100" step="0.1" value={formData.traceability_score} onChange={(event) => setField('traceability_score', event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Nombre de lots livres</Label>
                    <Input type="number" min="0" value={formData.delivered_lots_count} onChange={(event) => setField('delivered_lots_count', event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Poids total livre (T)</Label>
                    <Input type="number" min="0" step="0.1" value={formData.total_delivered_tons} onChange={(event) => setField('total_delivered_tons', event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Taux de rejet (%)</Label>
                    <Input type="number" min="0" max="100" step="0.1" value={formData.rejection_rate} onChange={(event) => setField('rejection_rate', event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Derniere livraison</Label>
                    <Input type="date" value={formData.last_delivery_date} onChange={(event) => setField('last_delivery_date', event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Derniere evaluation</Label>
                    <Input type="date" value={formData.last_evaluation_date} onChange={(event) => setField('last_evaluation_date', event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Prochaine evaluation</Label>
                    <Input type="date" value={formData.next_evaluation_date} onChange={(event) => setField('next_evaluation_date', event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Montant total paye (TND)</Label>
                    <Input type="number" min="0" step="0.01" value={formData.total_paid_amount_tnd} onChange={(event) => setField('total_paid_amount_tnd', event.target.value)} />
                  </div>
                </div>
              </section>
            </div>
          </ScrollArea>

          <DialogFooter>
            {formError && (
              <p className="mr-auto max-w-md rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {formError}
              </p>
            )}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Enregistrement...' : 'Enregistrer la fiche'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
