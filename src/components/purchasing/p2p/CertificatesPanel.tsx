import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AlertTriangle, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import {
  useSupplierCertificates,
  useCreateCertificate,
  useUpdateCertificate,
  useDeleteCertificate,
} from '@/hooks/useP2P';
import {
  certificateTypeLabels,
  expiryAlertColors,
  expiryAlertLabels,
  getExpiryAlertLevel,
  type CertificateType,
  type SupplierCertificate,
} from '@/types/p2p';
import type { Supplier } from '@/types/mes';
import { useSettingsContext } from '@/contexts/SettingsContext';

interface Props {
  suppliers: Supplier[];
}

const CERT_TYPES = Object.keys(certificateTypeLabels) as CertificateType[];

export const CertificatesPanel = ({ suppliers }: Props) => {
  const { settings } = useSettingsContext();
  const { data: certificates = [], isLoading } = useSupplierCertificates();
  const createCert = useCreateCertificate();
  const deleteCert = useDeleteCertificate();
  const certificateAlertDays = Array.from(
    new Set(
      Object.values(settings.p2p.sites).flatMap((siteRule) => siteRule.cert_alert_days),
    ),
  ).sort((a, b) => b - a);

  const [createOpen, setCreateOpen] = useState(false);
  const [filterSupplierId, setFilterSupplierId] = useState('');
  const [filterAlertOnly, setFilterAlertOnly] = useState(false);

  const [form, setForm] = useState({
    supplier_id: '',
    certificate_type: '' as CertificateType | '',
    certificate_number: '',
    issuer: '',
    issue_date: '',
    expiry_date: '',
    document_ref: '',
    notes: '',
  });

  const expiredCount = certificates.filter((c) => getExpiryAlertLevel(c.expiry_date, certificateAlertDays) === 'EXPIRED').length;
  const j30Count = certificates.filter((c) => getExpiryAlertLevel(c.expiry_date, certificateAlertDays) === 'J30').length;
  const j60Count = certificates.filter((c) => getExpiryAlertLevel(c.expiry_date, certificateAlertDays) === 'J60').length;
  const validCount = certificates.filter((c) => getExpiryAlertLevel(c.expiry_date, certificateAlertDays) === 'NONE').length;

  const filtered = certificates.filter((c) => {
    if (filterSupplierId && c.supplier_id !== filterSupplierId) return false;
    if (filterAlertOnly) {
      const level = getExpiryAlertLevel(c.expiry_date, certificateAlertDays);
      return level === 'EXPIRED' || level === 'J30' || level === 'J60';
    }
    return true;
  });

  // Sort: expired first, then J30, J60, valid
  const sortOrder: Record<string, number> = { EXPIRED: 0, J30: 1, J60: 2, NONE: 3 };
  const sorted = [...filtered].sort((a, b) => {
    const la = getExpiryAlertLevel(a.expiry_date, certificateAlertDays);
    const lb = getExpiryAlertLevel(b.expiry_date, certificateAlertDays);
    return (sortOrder[la] ?? 3) - (sortOrder[lb] ?? 3);
  });

  const handleCreate = () => {
    const sup = suppliers.find((s) => s.id === form.supplier_id);
    createCert.mutate(
      {
        supplier_id: form.supplier_id,
        supplier_name: sup?.name ?? null,
        certificate_type: form.certificate_type as CertificateType,
        certificate_number: form.certificate_number || null,
        issuer: form.issuer || null,
        issue_date: form.issue_date || null,
        expiry_date: form.expiry_date,
        document_ref: form.document_ref || null,
        notes: form.notes || null,
      },
      { onSuccess: () => setCreateOpen(false) },
    );
  };

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Expirés', value: expiredCount, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Expire ≤30j', value: j30Count, color: 'text-orange-600', bg: 'bg-orange-50' },
          { label: 'Expire ≤60j', value: j60Count, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Valides', value: validCount, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        ].map((kpi) => (
          <Card key={kpi.label} className={expiredCount > 0 && kpi.label === 'Expirés' ? 'border-red-300' : ''}>
            <CardContent className={`p-3 flex items-center gap-3 ${kpi.bg} rounded-lg`}>
              <ShieldCheck className={`h-5 w-5 ${kpi.color}`} />
              <div>
                <p className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</p>
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Alert banner for expiring certs */}
      {(expiredCount > 0 || j30Count > 0) && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-sm">
          <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
          <span className="text-red-700 font-medium">
            {expiredCount > 0 && `${expiredCount} certificat(s) expiré(s). `}
            {j30Count > 0 && `${j30Count} certificat(s) expire dans moins de 30 jours.`}
          </span>
          <button
            className="ml-auto text-xs underline underline-offset-2 text-red-700 hover:text-red-900"
            onClick={() => setFilterAlertOnly(true)}
          >
            Afficher uniquement
          </button>
        </div>
      )}

      {/* Header + filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <h3 className="font-semibold text-base flex-1">Certificats fournisseurs</h3>
        <Select value={filterSupplierId} onValueChange={setFilterSupplierId}>
          <SelectTrigger className="w-48 h-10 text-xs">
            <SelectValue placeholder="Tous les fournisseurs" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Tous les fournisseurs</SelectItem>
            {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button
          variant={filterAlertOnly ? 'default' : 'outline'}
          size="sm"
          className={filterAlertOnly ? 'bg-amber-500 hover:bg-amber-600' : ''}
          onClick={() => setFilterAlertOnly(!filterAlertOnly)}
        >
          Alertes seulement
        </Button>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Ajouter
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fournisseur</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>N° certificat</TableHead>
                <TableHead>Émetteur</TableHead>
                <TableHead>Date émission</TableHead>
                <TableHead>Expiration</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">Chargement…</TableCell>
                </TableRow>
              ) : sorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">Aucun certificat</TableCell>
                </TableRow>
              ) : (
                sorted.map((cert) => {
                  const alertLevel = getExpiryAlertLevel(cert.expiry_date, certificateAlertDays);
                  return (
                    <TableRow
                      key={cert.id}
                      className={
                        alertLevel === 'EXPIRED'
                          ? 'bg-red-50/60'
                          : alertLevel === 'J30'
                          ? 'bg-orange-50/40'
                          : ''
                      }
                    >
                      <TableCell>{cert.supplier_name ?? '—'}</TableCell>
                      <TableCell>
                        <span className="text-xs">{certificateTypeLabels[cert.certificate_type]}</span>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{cert.certificate_number ?? '—'}</TableCell>
                      <TableCell>{cert.issuer ?? '—'}</TableCell>
                      <TableCell>
                        {cert.issue_date
                          ? new Date(cert.issue_date).toLocaleDateString('fr-FR')
                          : '—'}
                      </TableCell>
                      <TableCell className="font-semibold">
                        {new Date(cert.expiry_date).toLocaleDateString('fr-FR')}
                      </TableCell>
                      <TableCell>
                        <Badge className={expiryAlertColors[alertLevel]}>
                          {expiryAlertLabels[alertLevel]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-700"
                          onClick={() => deleteCert.mutate(cert.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ajouter un certificat fournisseur</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Fournisseur *</Label>
              <Select value={form.supplier_id} onValueChange={(v) => setForm({ ...form, supplier_id: v })}>
                <SelectTrigger><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Type de certificat *</Label>
              <Select
                value={form.certificate_type}
                onValueChange={(v) => setForm({ ...form, certificate_type: v as CertificateType })}
              >
                <SelectTrigger><SelectValue placeholder="Type…" /></SelectTrigger>
                <SelectContent>
                  {CERT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{certificateTypeLabels[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>N° certificat</Label>
              <Input value={form.certificate_number} onChange={(e) => setForm({ ...form, certificate_number: e.target.value })} />
            </div>
            <div>
              <Label>Émetteur / Organisme</Label>
              <Input value={form.issuer} onChange={(e) => setForm({ ...form, issuer: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Date d'émission</Label>
                <Input type="date" value={form.issue_date} onChange={(e) => setForm({ ...form, issue_date: e.target.value })} />
              </div>
              <div>
                <Label>Date d'expiration *</Label>
                <Input type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Référence document</Label>
              <Input
                value={form.document_ref}
                onChange={(e) => setForm({ ...form, document_ref: e.target.value })}
                placeholder="Chemin fichier, URL, référence GED…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button
              onClick={handleCreate}
              disabled={!form.supplier_id || !form.certificate_type || !form.expiry_date || createCert.isPending}
            >
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
