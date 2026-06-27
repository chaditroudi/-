import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Plus, Search, Pencil, Trash2, Globe, Mail, Phone,
  Users, UserCheck, UserX,
} from 'lucide-react';
import {
  useCustomers, useCreateCustomer, useUpdateCustomer, useDeleteCustomer,
} from '@/hooks/useCustomers';
import { CustomerDialog } from './CustomerDialog';
import type { Customer } from '@/types/customer';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const COUNTRY_BADGE: Record<string, string> = {
  EU:  'bg-blue-50 text-blue-700 border-blue-200',
  USA: 'bg-red-50 text-red-700 border-red-200',
  SA:  'bg-green-50 text-green-700 border-green-200',
};
const COUNTRY_LABEL: Record<string, string> = { EU: '🇪🇺 EU', USA: '🇺🇸 USA', SA: '🇸🇦 SA' };
const LANG_LABEL:    Record<string, string> = { fr: 'FR', en: 'EN', ar: 'AR' };

export default function CustomersDashboard() {
  const [search,       setSearch]       = useState('');
  const [filterCountry, setFilterCountry] = useState<string>('all');
  const [filterActive,  setFilterActive]  = useState<'all' | 'active' | 'inactive'>('active');
  const [dialogOpen,   setDialogOpen]   = useState(false);
  const [editing,      setEditing]      = useState<Customer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);

  const { data: customers = [], isLoading } = useCustomers({ activeOnly: false });
  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer();
  const deleteCustomer = useDeleteCustomer();

  const filtered = useMemo(() => {
    let list = customers;
    if (filterCountry !== 'all') list = list.filter((c) => c.country === filterCountry);
    if (filterActive === 'active')   list = list.filter((c) => c.is_active);
    if (filterActive === 'inactive') list = list.filter((c) => !c.is_active);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((c) =>
        c.name.toLowerCase().includes(q) ||
        (c.contact_name ?? '').toLowerCase().includes(q) ||
        (c.contact_email ?? '').toLowerCase().includes(q) ||
        (c.code ?? '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [customers, search, filterCountry, filterActive]);

  const stats = useMemo(() => ({
    total:    customers.length,
    active:   customers.filter((c) => c.is_active).length,
    inactive: customers.filter((c) => !c.is_active).length,
    byCountry: {
      EU:  customers.filter((c) => c.country === 'EU').length,
      USA: customers.filter((c) => c.country === 'USA').length,
      SA:  customers.filter((c) => c.country === 'SA').length,
    },
  }), [customers]);

  const handleSubmit = async (data: Partial<Customer>) => {
    if (editing) {
      await updateCustomer.mutateAsync({ id: editing.id, ...data });
    } else {
      await createCustomer.mutateAsync(data);
    }
    setDialogOpen(false);
    setEditing(null);
  };

  const isSaving = createCustomer.isPending || updateCustomer.isPending;

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Stats */}
      {customers.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border bg-card p-4 flex items-center gap-3">
            <div className="rounded-lg bg-slate-50 p-2"><Users className="h-5 w-5 text-slate-600" /></div>
            <div>
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-xs text-muted-foreground">Total clients</div>
            </div>
          </div>
          <div className="rounded-xl border bg-card p-4 flex items-center gap-3">
            <div className="rounded-lg bg-emerald-50 p-2"><UserCheck className="h-5 w-5 text-emerald-600" /></div>
            <div>
              <div className="text-2xl font-bold">{stats.active}</div>
              <div className="text-xs text-muted-foreground">Actifs</div>
            </div>
          </div>
          <div className="rounded-xl border bg-card p-4 flex items-center gap-3">
            <div className="rounded-lg bg-blue-50 p-2"><Globe className="h-5 w-5 text-blue-600" /></div>
            <div>
              <div className="text-2xl font-bold">{stats.byCountry.EU}</div>
              <div className="text-xs text-muted-foreground">Clients EU</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                USA {stats.byCountry.USA} · SA {stats.byCountry.SA}
              </div>
            </div>
          </div>
          <div className="rounded-xl border bg-card p-4 flex items-center gap-3">
            <div className="rounded-lg bg-red-50 p-2"><UserX className="h-5 w-5 text-red-400" /></div>
            <div>
              <div className="text-2xl font-bold">{stats.inactive}</div>
              <div className="text-xs text-muted-foreground">Inactifs</div>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input className="pl-8 h-8 text-sm" placeholder="Rechercher un client..."
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <select
          className="h-8 rounded-md border bg-background px-2 text-sm"
          value={filterCountry}
          onChange={(e) => setFilterCountry(e.target.value)}
        >
          <option value="all">Tous pays</option>
          <option value="EU">🇪🇺 EU</option>
          <option value="USA">🇺🇸 USA</option>
          <option value="SA">🇸🇦 SA</option>
        </select>

        <select
          className="h-8 rounded-md border bg-background px-2 text-sm"
          value={filterActive}
          onChange={(e) => setFilterActive(e.target.value as any)}
        >
          <option value="all">Tous</option>
          <option value="active">Actifs</option>
          <option value="inactive">Inactifs</option>
        </select>

        <Button size="sm" className="h-8 gap-1" onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="h-3.5 w-3.5" /> Nouveau client
        </Button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/30 sticky top-0">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium text-xs text-muted-foreground">Code</th>
              <th className="text-left px-4 py-2.5 font-medium text-xs text-muted-foreground">Raison sociale</th>
              <th className="text-left px-4 py-2.5 font-medium text-xs text-muted-foreground">Pays</th>
              <th className="text-left px-4 py-2.5 font-medium text-xs text-muted-foreground">Contact</th>
              <th className="text-left px-4 py-2.5 font-medium text-xs text-muted-foreground">Préférences</th>
              <th className="text-left px-4 py-2.5 font-medium text-xs text-muted-foreground">Statut</th>
              <th className="text-right px-4 py-2.5 font-medium text-xs text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">Chargement...</td></tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-12 text-muted-foreground">
                  {customers.length === 0
                    ? 'Aucun client. Créez votre premier client.'
                    : 'Aucun résultat pour cette recherche.'}
                </td>
              </tr>
            )}
            {filtered.map((c) => (
              <tr key={c.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{c.code}</td>
                <td className="px-4 py-2.5 font-medium">{c.name}</td>
                <td className="px-4 py-2.5">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-medium ${COUNTRY_BADGE[c.country] ?? ''}`}>
                    {COUNTRY_LABEL[c.country] ?? c.country}
                  </span>
                  {c.specific_country && (
                    <span className="ml-1 text-xs text-muted-foreground">{c.specific_country}</span>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex flex-col gap-0.5">
                    {c.contact_name && <span className="text-xs">{c.contact_name}</span>}
                    {c.contact_email && (
                      <a href={`mailto:${c.contact_email}`}
                        className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                        <Mail className="h-3 w-3" />{c.contact_email}
                      </a>
                    )}
                    {c.contact_phone && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3" />{c.contact_phone}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                    <span>{LANG_LABEL[c.preferred_language] ?? c.preferred_language} · {c.preferred_currency}</span>
                    {c.preferred_incoterms && <span>{c.preferred_incoterms}</span>}
                    {c.port_of_destination && <span>{c.port_of_destination}</span>}
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <Badge variant={c.is_active ? 'default' : 'secondary'}
                    className={c.is_active ? 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100' : ''}>
                    {c.is_active ? 'Actif' : 'Inactif'}
                  </Badge>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                      onClick={() => { setEditing(c); setDialogOpen(true); }} title="Modifier">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(c)} title="Supprimer">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <CustomerDialog
        open={dialogOpen}
        onOpenChange={(v) => { setDialogOpen(v); if (!v) setEditing(null); }}
        initial={editing}
        onSubmit={handleSubmit}
        isSaving={isSaving}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce client ?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.name} sera supprimé définitivement. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!deleteTarget) return;
                await deleteCustomer.mutateAsync(deleteTarget.id);
                setDeleteTarget(null);
              }}>
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
