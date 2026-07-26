import { useState } from 'react';
import { useManagedUsers, useUpdateManagedUser, useCreateManagedUser } from '@/hooks/useSettings';
import type { ManagedUser } from '@/types/settings';
import { ROLE_CONFIG, type ActorRole } from '@/types/roles';
import {
  DEPARTMENTS,
  DEPARTMENT_LABELS,
  ORG_ROLES,
  ORG_ROLE_LABELS,
  type DepartmentCode,
  type OrgRole,
} from '@/types/org';
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
import { cn } from '@/lib/utils';

const allRoles = Object.values(ROLE_CONFIG);

export function UserManagementPanel() {
  const { data: users = [], isLoading } = useManagedUsers();
  const updateUser = useUpdateManagedUser();
  const createUser = useCreateManagedUser();

  const [search, setSearch] = useState('');

  const [editUser, setEditUser] = useState<ManagedUser | null>(null);
  const [editRoles, setEditRoles] = useState<string[]>([]);
  const [editDepartments, setEditDepartments] = useState<DepartmentCode[]>([]);
  const [editPrimaryDepartment, setEditPrimaryDepartment] = useState<DepartmentCode | ''>('');
  const [editOrgRoles, setEditOrgRoles] = useState<OrgRole[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<ActorRole>('responsable_reception');
  const [showPassword, setShowPassword] = useState(false);

  const filtered = users.filter(
    (u) =>
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.full_name ?? '').toLowerCase().includes(search.toLowerCase()),
  );
  const active = users.filter((u) => u.is_active).length;

  const handleToggleActive = async (user: ManagedUser) => {
    await updateUser.mutateAsync({ id: user.id, patch: { is_active: !user.is_active } });
    toast.success(user.is_active ? `${user.email} désactivé` : `${user.email} activé`);
  };

  const openEdit = (user: ManagedUser) => {
    setEditUser(user);
    setEditRoles([...user.roles]);
    setEditDepartments([...(user.departments || [])] as DepartmentCode[]);
    setEditPrimaryDepartment((user.primary_department as DepartmentCode) || '');
    setEditOrgRoles([...(user.org_roles || [])] as OrgRole[]);
  };

  const toggleDepartment = (code: DepartmentCode) => {
    setEditDepartments((prev) => {
      const next = prev.includes(code) ? prev.filter((d) => d !== code) : [...prev, code];
      if (editPrimaryDepartment && !next.includes(editPrimaryDepartment)) {
        setEditPrimaryDepartment(next[0] || '');
      }
      return next;
    });
  };

  const toggleOrgRole = (role: OrgRole) => {
    setEditOrgRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );
  };

  const handleSaveRoles = async () => {
    if (!editUser) return;
    await updateUser.mutateAsync({
      id: editUser.id,
      patch: {
        roles: editRoles,
        departments: editDepartments,
        primary_department: editPrimaryDepartment || editDepartments[0] || null,
        org_roles: editOrgRoles.length > 0 ? editOrgRoles : ['employee'],
      },
    });
    toast.success('Profil mis à jour');
    setEditUser(null);
  };

  const resetCreateForm = () => {
    setNewName('');
    setNewEmail('');
    setNewPassword('');
    setNewRole('responsable_reception');
    setShowPassword(false);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    try {
      await createUser.mutateAsync({
        email: newEmail,
        password: newPassword,
        full_name: newName,
        role: newRole,
      });
      toast.success(`Compte créé pour ${newEmail}`);
      setCreateOpen(false);
      resetCreateForm();
    } catch (err: any) {
      toast.error(err?.message ?? 'Erreur lors de la création du compte.');
    }
  };

  return (
    <div className="space-y-4 max-w-3xl">
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

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            Comptes & appartenance département
          </CardTitle>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <UserPlus className="h-4 w-4 mr-1.5" />
            Créer
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher email ou nom..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{u.full_name || u.email}</div>
                    <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {(u.departments || []).map((dept) => (
                        <Badge key={dept} variant="outline" className="text-[10px]">
                          {DEPARTMENT_LABELS[dept as DepartmentCode] || dept}
                          {u.primary_department === dept ? ' ★' : ''}
                        </Badge>
                      ))}
                      {(u.org_roles || []).map((role) => (
                        <Badge key={role} className="text-[10px] bg-slate-700">
                          {ORG_ROLE_LABELS[role as OrgRole] || role}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Badge variant={u.is_active ? 'default' : 'secondary'} className="text-[10px]">
                      {u.is_active ? 'Actif' : 'Inactif'}
                    </Badge>
                    <Button variant="ghost" className="h-7 w-7" onClick={() => openEdit(u)}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
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

      <Dialog open={!!editUser} onOpenChange={(v) => { if (!v) setEditUser(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Profil — {editUser?.full_name ?? editUser?.email}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">Rôle MES (espace)</Label>
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

            <div className="space-y-2">
              <Label className="text-xs">Départements (appartenance)</Label>
              <div className="flex flex-wrap gap-1.5">
                {DEPARTMENTS.map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => toggleDepartment(code)}
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-xs transition-colors',
                      editDepartments.includes(code)
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                        : 'border-border text-muted-foreground hover:bg-muted',
                    )}
                  >
                    {DEPARTMENT_LABELS[code]}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Département principal</Label>
              <Select
                value={editPrimaryDepartment || '_none'}
                onValueChange={(v) => setEditPrimaryDepartment(v === '_none' ? '' : v as DepartmentCode)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Principal..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Aucun</SelectItem>
                  {editDepartments.map((code) => (
                    <SelectItem key={code} value={code}>
                      {DEPARTMENT_LABELS[code]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Rôles workflow (approbations)</Label>
              <div className="flex flex-wrap gap-1.5">
                {ORG_ROLES.map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => toggleOrgRole(role)}
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-xs transition-colors',
                      editOrgRoles.includes(role)
                        ? 'border-sky-500 bg-sky-50 text-sky-800'
                        : 'border-border text-muted-foreground hover:bg-muted',
                    )}
                  >
                    {ORG_ROLE_LABELS[role]}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Un employé Stock voit Stock ; seul le responsable Stock de son département reçoit
                la notification d&apos;approbation — pas tous les rôles stock.
              </p>
            </div>
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

      <Dialog open={createOpen} onOpenChange={(v) => { setCreateOpen(v); if (!v) resetCreateForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Créer un compte utilisateur
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateUser} className="space-y-4">
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

            <div className="space-y-1.5">
              <Label htmlFor="new-password" className="text-xs font-medium">Mot de passe *</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pl-9 pr-9"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Rôle MES *</Label>
              <Select value={newRole} onValueChange={(v) => setNewRole(v as ActorRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {allRoles.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={createUser.isPending}>
                {createUser.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Créer le compte
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
