import { useCallback, useMemo, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  FileText, Plus, Printer, Pencil, Trash2, Search, Lock,
  FileCheck, Globe, RefreshCw, CheckCircle2, Clock,
} from 'lucide-react';
import {
  useExportOrders, useCreateExportOrder, useUpdateExportOrder, useDeleteExportOrder,
  useExportContracts, useCreateExportContract, useUpdateExportContract,
  useApproveExportContract, useRegenerateExportContract,
  useCOADocuments, useCreateCOA, useUpdateCOA, useDeleteCOA,
} from '@/hooks/useExportOrders';
import { ExportOrderDialog } from './ExportOrderDialog';
import { COADialog } from './COADialog';
import { printExportContract, getContractHTML } from './printExportContract';
import { printCOA } from './printCOA';
import type { ExportOrder, ExportContract, COADocument } from '@/types/exportOrders';

// ── Status badges ─────────────────────────────────────────────────────────────

const ORDER_STATUS: Record<string, { label: string; cls: string }> = {
  draft:     { label: 'Brouillon', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  confirmed: { label: 'Confirmé',  cls: 'bg-blue-50 text-blue-800 border-blue-200' },
  shipped:   { label: 'Expédié',   cls: 'bg-purple-50 text-purple-800 border-purple-200' },
  completed: { label: 'Terminé',   cls: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  cancelled: { label: 'Annulé',    cls: 'bg-red-50 text-red-700 border-red-200' },
};

const CONTRACT_STATUS: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
  draft:            { label: 'Brouillon',     cls: 'bg-amber-50 text-amber-800 border-amber-200',     icon: FileText },
  pending_approval: { label: 'En attente',    cls: 'bg-blue-50 text-blue-800 border-blue-200',        icon: Clock },
  approved:         { label: 'Approuvé',      cls: 'bg-emerald-50 text-emerald-800 border-emerald-200', icon: CheckCircle2 },
  locked:           { label: 'Verrouillé',    cls: 'bg-slate-100 text-slate-700 border-slate-300',    icon: Lock },
};

const COUNTRY_LABEL: Record<string, string> = { EU: '🇪🇺 UE', USA: '🇺🇸 USA', SA: '🇸🇦 KSA' };
const LANG_LABEL:    Record<string, string> = { fr: 'FR', en: 'EN', ar: 'AR' };

// ── Approve dialog ────────────────────────────────────────────────────────────

function ApproveDialog({
  contract, order, open, onOpenChange,
}: { contract: ExportContract; order?: ExportOrder; open: boolean; onOpenChange: (v: boolean) => void }) {
  const [approver, setApprover] = useState('');
  const approve = useApproveExportContract();

  const handleApprove = async () => {
    if (!order) return;
    const html = getContractHTML(order, contract);
    await approve.mutateAsync({ contract, approvedBy: approver, htmlContent: html });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Approuver le contrat</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Cette action va verrouiller le document {contract.contract_ref} v{contract.current_version} avec
          une empreinte SHA-256. Il ne pourra plus être modifié.
        </p>
        <div>
          <Input placeholder="Votre nom" value={approver} onChange={(e) => setApprover(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleApprove} disabled={!approver || approve.isPending}>
            <Lock className="h-4 w-4 mr-1" />
            {approve.isPending ? 'Verrouillage...' : 'Approuver & Verrouiller'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Regenerate dialog ─────────────────────────────────────────────────────────

function RegenerateDialog({
  contract, open, onOpenChange,
}: { contract: ExportContract; open: boolean; onOpenChange: (v: boolean) => void }) {
  const [user,   setUser]   = useState('');
  const [reason, setReason] = useState('');
  const regen = useRegenerateExportContract();

  const handleRegen = async () => {
    await regen.mutateAsync({ contract, generatedBy: user, reason });
    onOpenChange(false);
  };

  const [major, minor] = contract.current_version.split('.').map(Number);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Régénérer le contrat</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          La version actuelle v{contract.current_version} sera archivée.
          Une nouvelle version v{major}.{minor + 1} sera créée.
        </p>
        <div className="space-y-2">
          <Input placeholder="Votre nom" value={user} onChange={(e) => setUser(e.target.value)} />
          <Input placeholder="Raison de la correction..." value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleRegen} disabled={!user || !reason || regen.isPending}>
            <RefreshCw className="h-4 w-4 mr-1" />
            {regen.isPending ? 'Création...' : 'Créer v' + major + '.' + (minor + 1)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export function ExportDashboard() {
  const { data: orders    = [], isLoading: loadingOrders }    = useExportOrders();
  const { data: contracts = [], isLoading: loadingContracts } = useExportContracts();
  const { data: coaDocs   = [], isLoading: loadingCOA }       = useCOADocuments();

  const createOrder  = useCreateExportOrder();
  const updateOrder  = useUpdateExportOrder();
  const deleteOrder  = useDeleteExportOrder();
  const createContract = useCreateExportContract();
  const updateContract = useUpdateExportContract();
  const createCOA    = useCreateCOA();
  const updateCOA    = useUpdateCOA();
  const deleteCOA    = useDeleteCOA();

  // Order dialog
  const [orderDialogOpen,  setOrderDialogOpen]  = useState(false);
  const [editingOrder,     setEditingOrder]      = useState<ExportOrder | null>(null);
  const [deleteOrderTarget, setDeleteOrderTarget] = useState<ExportOrder | null>(null);

  // COA dialog
  const [coaDialogOpen,   setCoaDialogOpen]   = useState(false);
  const [editingCOA,      setEditingCOA]       = useState<COADocument | null>(null);
  const [deleteCOATarget, setDeleteCOATarget]  = useState<COADocument | null>(null);

  // Contract actions
  const [approveTarget,    setApproveTarget]   = useState<ExportContract | null>(null);
  const [regenTarget,      setRegenTarget]     = useState<ExportContract | null>(null);

  const [search, setSearch] = useState('');

  const filteredOrders = useMemo(() => {
    if (!search) return orders;
    const q = search.toLowerCase();
    return orders.filter((o) =>
      o.order_ref?.toLowerCase().includes(q) ||
      o.customer_name?.toLowerCase().includes(q) ||
      o.customer_country?.toLowerCase().includes(q)
    );
  }, [orders, search]);

  const filteredCOA = useMemo(() => {
    if (!search) return coaDocs;
    const q = search.toLowerCase();
    return coaDocs.filter((c) =>
      c.coa_ref?.toLowerCase().includes(q) ||
      c.batch_ref?.toLowerCase().includes(q) ||
      c.supplier_name?.toLowerCase().includes(q)
    );
  }, [coaDocs, search]);

  const handleOrderSubmit = useCallback(async (data: Partial<ExportOrder>) => {
    try {
      if (editingOrder) {
        await updateOrder.mutateAsync({ id: editingOrder.id, ...data });
      } else {
        await createOrder.mutateAsync(data);
      }
      setOrderDialogOpen(false);
    } catch {/* toast from hook */}
  }, [editingOrder, updateOrder, createOrder]);

  const handleCOASubmit = useCallback(async (data: Partial<COADocument>) => {
    try {
      if (editingCOA) {
        await updateCOA.mutateAsync({ id: editingCOA.id, ...data });
      } else {
        await createCOA.mutateAsync(data);
      }
      setCoaDialogOpen(false);
    } catch {/* toast from hook */}
  }, [editingCOA, updateCOA, createCOA]);

  const handleGenerateContract = useCallback(async (order: ExportOrder) => {
    const existing = contracts.find((c) => c.order_id === order.id);
    if (existing) return;
    try {
      await createContract.mutateAsync({
        order_id:        order.id,
        order_ref:       order.order_ref,
        language:        order.contract_language,
        buyer_country:   order.customer_country,
        status:          'draft',
        current_version: '1.0',
        version_history: [],
      });
    } catch {/* toast from hook */}
  }, [contracts, createContract]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9 h-9" placeholder="Rechercher commande, client, COA..."
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Button onClick={() => { setEditingOrder(null); setOrderDialogOpen(true); }} className="gap-2 h-9">
          <Plus className="h-4 w-4" /> Nouvelle commande
        </Button>
        <Button variant="outline" onClick={() => { setEditingCOA(null); setCoaDialogOpen(true); }} className="gap-2 h-9">
          <FileCheck className="h-4 w-4" /> Nouveau COA
        </Button>
      </div>

      <Tabs defaultValue="orders" className="flex-1">
        <TabsList className="mb-4">
          <TabsTrigger value="orders">
            Commandes Export
            <Badge variant="secondary" className="ml-2 text-xs">{orders.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="contracts">
            Contrats
            <Badge variant="secondary" className="ml-2 text-xs">{contracts.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="coa">
            COA
            <Badge variant="secondary" className="ml-2 text-xs">{coaDocs.length}</Badge>
          </TabsTrigger>
        </TabsList>

        {/* ── ORDERS ─────────────────────────────────────────────────────── */}
        <TabsContent value="orders">
          {loadingOrders ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
              <Globe className="h-10 w-10 opacity-30" />
              <p className="text-sm">{search ? 'Aucun résultat' : 'Aucune commande export créée'}</p>
              {!search && (
                <Button variant="outline" size="sm" onClick={() => { setEditingOrder(null); setOrderDialogOpen(true); }} className="gap-2">
                  <Plus className="h-4 w-4" /> Créer la première
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-xs text-muted-foreground uppercase">
                    <th className="text-left px-4 py-2.5 font-medium">Référence</th>
                    <th className="text-left px-4 py-2.5 font-medium">Client</th>
                    <th className="text-left px-4 py-2.5 font-medium">Pays</th>
                    <th className="text-left px-4 py-2.5 font-medium">Langue</th>
                    <th className="text-right px-4 py-2.5 font-medium">Poids (kg)</th>
                    <th className="text-right px-4 py-2.5 font-medium">Montant</th>
                    <th className="text-left px-4 py-2.5 font-medium">Statut</th>
                    <th className="text-right px-4 py-2.5 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order) => {
                    const badge = ORDER_STATUS[order.status] ?? ORDER_STATUS.draft;
                    const hasContract = contracts.some((c) => c.order_id === order.id);
                    return (
                      <tr key={order.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-2.5 font-mono font-medium text-primary">{order.order_ref}</td>
                        <td className="px-4 py-2.5 font-medium">{order.customer_name}</td>
                        <td className="px-4 py-2.5">{COUNTRY_LABEL[order.customer_country] ?? order.customer_country}</td>
                        <td className="px-4 py-2.5">
                          <Badge variant="outline" className="text-xs">{LANG_LABEL[order.contract_language] ?? order.contract_language}</Badge>
                        </td>
                        <td className="px-4 py-2.5 text-right">{order.total_weight_kg?.toLocaleString('fr-FR', { minimumFractionDigits: 0 })}</td>
                        <td className="px-4 py-2.5 text-right font-semibold">
                          {order.total_amount?.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {order.currency}
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge variant="outline" className={cn('text-xs', badge.cls)}>{badge.label}</Badge>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex justify-end gap-1">
                            {!hasContract && (
                              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1"
                                onClick={() => handleGenerateContract(order)}
                                disabled={createContract.isPending}
                                title="Générer contrat">
                                <FileText className="h-3.5 w-3.5" /> Contrat
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                              onClick={() => { setEditingOrder(order); setOrderDialogOpen(true); }} title="Modifier">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                              onClick={() => setDeleteOrderTarget(order)} title="Supprimer">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* ── CONTRACTS ──────────────────────────────────────────────────── */}
        <TabsContent value="contracts">
          {loadingContracts ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
            </div>
          ) : contracts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
              <FileText className="h-10 w-10 opacity-30" />
              <p className="text-sm">Aucun contrat généré — créez une commande export d&apos;abord</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-xs text-muted-foreground uppercase">
                    <th className="text-left px-4 py-2.5 font-medium">Contrat</th>
                    <th className="text-left px-4 py-2.5 font-medium">Commande</th>
                    <th className="text-left px-4 py-2.5 font-medium">Pays / Langue</th>
                    <th className="text-left px-4 py-2.5 font-medium">Version</th>
                    <th className="text-left px-4 py-2.5 font-medium">Statut</th>
                    <th className="text-left px-4 py-2.5 font-medium">Historique</th>
                    <th className="text-right px-4 py-2.5 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {contracts.map((contract) => {
                    const order = orders.find((o) => o.id === contract.order_id);
                    const cBadge = CONTRACT_STATUS[contract.status] ?? CONTRACT_STATUS.draft;
                    const CIcon  = cBadge.icon;
                    const isLocked = contract.status === 'locked';
                    return (
                      <tr key={contract.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-2.5 font-mono font-medium text-primary">{contract.contract_ref}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{contract.order_ref}</td>
                        <td className="px-4 py-2.5">
                          <span>{COUNTRY_LABEL[contract.buyer_country] ?? contract.buyer_country}</span>
                          <Badge variant="outline" className="ml-2 text-xs">{LANG_LABEL[contract.language] ?? contract.language}</Badge>
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge variant="outline" className="font-mono text-xs">v{contract.current_version}</Badge>
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge variant="outline" className={cn('gap-1 text-xs', cBadge.cls)}>
                            <CIcon className="h-3 w-3" /> {cBadge.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">
                          {contract.version_history.length > 0
                            ? `${contract.version_history.length} version(s) archivée(s)`
                            : '—'}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                              onClick={() => order && printExportContract(order, contract)} title="Imprimer">
                              <Printer className="h-3.5 w-3.5" />
                            </Button>
                            {!isLocked && (
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-emerald-600"
                                onClick={() => setApproveTarget(contract)} title="Approuver & Verrouiller">
                                <Lock className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {isLocked && (
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-blue-600"
                                onClick={() => setRegenTarget(contract)} title="Régénérer (nouvelle version)">
                                <RefreshCw className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* ── COA ────────────────────────────────────────────────────────── */}
        <TabsContent value="coa">
          {loadingCOA ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
            </div>
          ) : filteredCOA.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
              <FileCheck className="h-10 w-10 opacity-30" />
              <p className="text-sm">{search ? 'Aucun résultat' : 'Aucun COA créé'}</p>
              {!search && (
                <Button variant="outline" size="sm" onClick={() => { setEditingCOA(null); setCoaDialogOpen(true); }} className="gap-2">
                  <Plus className="h-4 w-4" /> Créer le premier COA
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-xs text-muted-foreground uppercase">
                    <th className="text-left px-4 py-2.5 font-medium">Réf. COA</th>
                    <th className="text-left px-4 py-2.5 font-medium">Lot</th>
                    <th className="text-left px-4 py-2.5 font-medium">Fournisseur</th>
                    <th className="text-left px-4 py-2.5 font-medium">Grade</th>
                    <th className="text-left px-4 py-2.5 font-medium">Humidité</th>
                    <th className="text-left px-4 py-2.5 font-medium">Expiration</th>
                    <th className="text-left px-4 py-2.5 font-medium">Approuvé par</th>
                    <th className="text-right px-4 py-2.5 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCOA.map((coa) => {
                    const humOk = coa.humidity_pct != null && coa.humidity_pct >= 14 && coa.humidity_pct <= 18;
                    return (
                      <tr key={coa.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-2.5 font-mono font-medium text-primary">{coa.coa_ref}</td>
                        <td className="px-4 py-2.5 font-mono text-muted-foreground">{coa.batch_ref ?? '—'}</td>
                        <td className="px-4 py-2.5">{coa.supplier_name ?? '—'}</td>
                        <td className="px-4 py-2.5">
                          {coa.visual_grade ? (
                            <Badge variant="outline" className={cn('text-xs', {
                              'bg-emerald-50 text-emerald-800 border-emerald-200': coa.visual_grade === 'premium',
                              'bg-blue-50 text-blue-800 border-blue-200': coa.visual_grade === 'standard',
                              'bg-amber-50 text-amber-800 border-amber-200': coa.visual_grade === 'economy',
                              'bg-red-50 text-red-700 border-red-200': coa.visual_grade === 'rejected',
                            })}>
                              {coa.visual_grade}
                            </Badge>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-2.5">
                          {coa.humidity_pct != null ? (
                            <span className={humOk ? 'text-emerald-700 font-medium' : 'text-red-600 font-medium'}>
                              {coa.humidity_pct}%
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">{coa.expiry_date ?? '—'}</td>
                        <td className="px-4 py-2.5">
                          {coa.approved_by ? (
                            <span className="flex items-center gap-1 text-emerald-700 text-xs">
                              <CheckCircle2 className="h-3.5 w-3.5" /> {coa.approved_by}
                            </span>
                          ) : <span className="text-muted-foreground text-xs">En attente</span>}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                              onClick={() => printCOA(coa)} title="Imprimer COA">
                              <Printer className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                              onClick={() => { setEditingCOA(coa); setCoaDialogOpen(true); }} title="Modifier">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                              onClick={() => setDeleteCOATarget(coa)} title="Supprimer">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <ExportOrderDialog
        open={orderDialogOpen}
        onOpenChange={setOrderDialogOpen}
        initial={editingOrder}
        onSubmit={handleOrderSubmit}
        isSaving={createOrder.isPending || updateOrder.isPending}
      />

      <COADialog
        open={coaDialogOpen}
        onOpenChange={setCoaDialogOpen}
        initial={editingCOA}
        onSubmit={handleCOASubmit}
        isSaving={createCOA.isPending || updateCOA.isPending}
      />

      {approveTarget && (
        <ApproveDialog
          contract={approveTarget}
          order={orders.find((o) => o.id === approveTarget.order_id)}
          open={!!approveTarget}
          onOpenChange={(v) => !v && setApproveTarget(null)}
        />
      )}

      {regenTarget && (
        <RegenerateDialog
          contract={regenTarget}
          open={!!regenTarget}
          onOpenChange={(v) => !v && setRegenTarget(null)}
        />
      )}

      <AlertDialog open={!!deleteOrderTarget} onOpenChange={(o) => !o && setDeleteOrderTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette commande ?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteOrderTarget?.order_ref} — {deleteOrderTarget?.customer_name}. Action irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (deleteOrderTarget) {
                  await deleteOrder.mutateAsync(deleteOrderTarget.id);
                  setDeleteOrderTarget(null);
                }
              }}>
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteCOATarget} onOpenChange={(o) => !o && setDeleteCOATarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce COA ?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteCOATarget?.coa_ref} — Lot {deleteCOATarget?.batch_ref}. Action irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (deleteCOATarget) {
                  await deleteCOA.mutateAsync(deleteCOATarget.id);
                  setDeleteCOATarget(null);
                }
              }}>
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
