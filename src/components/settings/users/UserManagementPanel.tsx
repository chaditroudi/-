import { useState } from 'react';
import { useManagedUsers, useUpdateManagedUser, useCreateManagedUser } from '@/hooks/useSettings';
import type { ManagedUser } from '@/types/settings';
import { ROLE_CONFIG, type ActorRole } from '@/types/roles';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Users, Search, UserCheck, UserX, Edit2, Loader2, UserPlus, Eye, EyeOff, Lock, Mail, User, Briefcase,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const allRoles = Object.values(ROLE_CONFIG);

export function UserManagementPanel() {
  const { data: users = [], isLoading } = useManagedUsers();
  const updateUser = useUpdateManagedUser();
  const createUser = useCreateManagedUser();

  // ── list filters ──────────────────────────────────────────────────────────
  const [search, setSearch] = useState('');

  // ── edit-roles dialog ─────────────────────────────────────────────────────
  const [editUser, setEditUser] = useState<ManagedUser | null>(null);
  const [editRoles, setEditRoles] = useState<string[]>([]);

  // ── create-user dialog ────────────────────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<ActorRole>('operateur_reception');
  const [showPassword, setShowPassword] = useState(false);

  const filtered = users.filter(
    (u) =>
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.full_name ?? '').toLowerCase().includes(search.toLowerCase()),
  );
  const active = users.filter((u) => u.is_active).length;

  // ── handlers ──────────────────────────────────────────────────────────────

  const handleToggleActive = async (user: ManagedUser) => {
    await updateUser.mutateAsync({ id: user.id, patch: { is_active: !user.is_active } });
    toast.success(user.is_active ? `${user.email} désactivé` : `${user.email} activé`);
  };

  const openEdit = (user: ManagedUser) => {
    setEditUser(user);
    setEditRoles([...user.roles]);
  };

  const handleSaveRoles = async () => {
    if (!editUser) return;
    await updateUser.mutateAsync({ id: editUser.id, patch: { roles: editRoles } });
    toast.success('Rôles mis à jour');
    setEditUser(null);
  };

  const resetCreateForm = () => {
    setNewName('');
    setNewEmail('');
    setNewPassword('');
    setNewRole('operateur_reception');
    setShowPassword(false);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    try {
      await createUser.mutateAsync({ email: newEmail, password: newPassword, full_name: newName, role: newRole });
      toast.success(`Compte créé pour ${newEmail}`);
      setCreateOpen(false);
      resetCreateForm();
    } catch (err: any) {
      toast.error(err?.message ?? 'Erreur lors de la création du compte.');
    }
  };

  return (
    <div className="space-y-4 max-w-3xl">
      {/* ── Stats ── */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold">{users.length}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Users className="h-3 w-3" />Total utilisateurs
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-green-600">{active}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <UserCheck className="h-3 w-3" />Actifs
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-red-500">{users.length - active}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <UserX className="h-3 w-3" />Inactifs
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Search + Add button ── */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Rechercher par email ou nom…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button onClick={() => setCreateOpen(true)} className="shrink-0 gap-1.5">
          <UserPlus className="h-4 w-4" />
          Ajouter un utilisateur
        </Button>
      </div>

      {/* ── User list ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Comptes ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-sm text-center text-muted-foreground py-8">Chargement…</div>
          ) : filtered.length === 0 ? (
            <div className="text-sm text-center text-muted-foreground py-8">Aucun utilisateur trouvé.</div>
          ) : (
            <div className="divide-y">
              {filtered.map((u) => (
                <div key={u.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{u.full_name ?? u.email}</span>
                      <Badge
                        variant={u.is_active ? 'default' : 'secondary'}
                        className="text-[10px] h-4"
                      >
                        {u.is_active ? 'Actif' : 'Inactif'}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{u.email}</div>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {u.roles.map((r) => (
                        <Badge key={r} variant="outline" className="text-[10px] h-4 px-1.5">
                          {ROLE_CONFIG[r as keyof typeof ROLE_CONFIG]?.label ?? r}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground shrink-0">
                    {u.created_at ? format(new Date(u.created_at), 'd MMM yyyy', { locale: fr }) : '—'}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(u)}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className={`h-7 w-7 ${u.is_active ? 'text-red-500 hover:text-red-600' : 'text-green-600 hover:text-green-700'}`}
                      onClick={() => handleToggleActive(u)}
                      disabled={updateUser.isPending}
                    >
                      {u.is_active ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Edit roles dialog ── */}
      <Dialog open={!!editUser} onOpenChange={(v) => { if (!v) setEditUser(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier les rôles — {editUser?.full_name ?? editUser?.email}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label className="text-xs">Rôle assigné</Label>
            <Select value={editRoles[0] ?? ''} onValueChange={(v) => setEditRoles([v])}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un rôle" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {allRoles.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    <div>
                      <div className="font-medium text-sm">{r.label}</div>
                      <div className="text-xs text-muted-foreground">{r.department}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditUser(null)}>Annuler</Button>
            <Button onClick={handleSaveRoles} disabled={updateUser.isPending}>
              {updateUser.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Create user dialog ── */}
      <Dialog open={createOpen} onOpenChange={(v) => { setCreateOpen(v); if (!v) resetCreateForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Créer un compte utilisateur
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateUser} className="space-y-4">

            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="new-name" className="text-xs font-medium">Nom complet *</Label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="new-name"
                  placeholder="Prénom Nom"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="pl-9"
                  required
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="new-email" className="text-xs font-medium">Adresse email *</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="new-email"
                  type="email"
                  placeholder="utilisateur@royalpalm.tn"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="pl-9"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <Label htmlFor="new-password" className="text-xs font-medium">Mot de passe *</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Minimum 6 caractères"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pl-9 pr-10"
                  minLength={6}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">Ce mot de passe sera communiqué à l'employé pour sa première connexion.</p>
            </div>

            {/* Role */}
            <div className="space-y-1.5">
              <Label htmlFor="new-role" className="text-xs font-medium">Rôle *</Label>
              <div className="relative">
                <Briefcase className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Select value={newRole} onValueChange={(v) => setNewRole(v as ActorRole)}>
                  <SelectTrigger id="new-role" className="pl-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {allRoles.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        <div>
                          <div className="font-medium text-sm">{r.label}</div>
                          <div className="text-xs text-muted-foreground">{r.department}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {/* Role description preview */}
              {ROLE_CONFIG[newRole] && (
                <p className="text-[11px] text-muted-foreground rounded-lg border bg-muted/40 px-2.5 py-1.5">
                  {ROLE_CONFIG[newRole].description}
                </p>
              )}
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={() => { setCreateOpen(false); resetCreateForm(); }}>
                Annuler
              </Button>
              <Button type="submit" disabled={createUser.isPending} className="gap-1.5">
                {createUser.isPending
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <UserPlus className="h-4 w-4" />
                }
                Créer le compte
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
