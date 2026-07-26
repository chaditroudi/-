import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import {
  Wrench,
  Clock,
  CheckCircle,
  Flag,
  XCircle,
  FileText,
} from 'lucide-react';
import { useAuthContext } from '@/contexts/AuthContext';
import type { ActorRole } from '@/types/roles';
import {
  useMaintenanceRequests,
  useMaintenanceStats,
  useCreateMaintenanceRequest,
  useUpdateMaintenanceRequest,
  useSubmitMaintenanceRequest,
  useApproveMaintenanceRequest,
  useRejectMaintenanceRequest,
  useReturnMaintenanceRequest,
  useCancelMaintenanceRequest,
  useCompleteMaintenanceRequest,
  useDeleteMaintenanceRequest,
} from '@/hooks/useMaintenance';
import type { MaintenanceRequest } from '@/types/maintenance';
import { MaintenanceRequestsList } from './MaintenanceRequestsList';
import {
  MaintenanceRequestDialog,
  type MaintenanceRequestSaveData,
} from './MaintenanceRequestDialog';

const MAINTENANCE_ACCESS_ROLES: ActorRole[] = [
  'responsable_maintenance',
  'technicien_maintenance',
  'responsable_production',
  'responsable_qualite',
  'responsable_stock',
  'magasinier_wms',
  'responsable_logistique',
  'responsable_reception',
  'chef_reception',
  'responsable_achats',
  'directeur_general',
  'directeur_usine',
  'administrateur_systeme',
];

const MAINTENANCE_APPROVER_ROLES: ActorRole[] = [
  'responsable_maintenance',
  'responsable_production',
  'responsable_qualite',
  'responsable_stock',
  'responsable_logistique',
  'responsable_reception',
  'directeur_general',
  'directeur_usine',
  'administrateur_systeme',
];

const MAINTENANCE_CLOSER_ROLES: ActorRole[] = [
  'responsable_maintenance',
  'technicien_maintenance',
  'directeur_general',
  'directeur_usine',
  'administrateur_systeme',
];

export const MaintenanceDashboard = () => {
  const { hasAnyRole, profile, user } = useAuthContext();
  const currentUserId = user?.id ?? null;
  const primaryDepartment =
    ((user?.user_metadata as Record<string, unknown> | undefined)?.primary_department as
      | string
      | undefined) ?? null;

  const hasAccess = hasAnyRole(MAINTENANCE_ACCESS_ROLES);
  const canApprove = hasAnyRole(MAINTENANCE_APPROVER_ROLES);
  const canComplete = hasAnyRole(MAINTENANCE_CLOSER_ROLES);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<MaintenanceRequest | null>(null);

  const { data: requests = [], isLoading } = useMaintenanceRequests(undefined, {
    enabled: hasAccess,
  });
  const { data: stats } = useMaintenanceStats({ enabled: hasAccess });

  const createRequest = useCreateMaintenanceRequest();
  const updateRequest = useUpdateMaintenanceRequest();
  const submitRequest = useSubmitMaintenanceRequest();
  const approveRequest = useApproveMaintenanceRequest();
  const rejectRequest = useRejectMaintenanceRequest();
  const returnRequest = useReturnMaintenanceRequest();
  const cancelRequest = useCancelMaintenanceRequest();
  const completeRequest = useCompleteMaintenanceRequest();
  const deleteRequest = useDeleteMaintenanceRequest();

  const handleNew = () => {
    setSelected(null);
    setDialogOpen(true);
  };

  const handleEdit = (request: MaintenanceRequest) => {
    setSelected(request);
    setDialogOpen(true);
  };

  const handleSave = (data: MaintenanceRequestSaveData) => {
    if (selected) {
      updateRequest.mutate(
        { id: selected.id, ...data },
        { onSuccess: () => setDialogOpen(false) },
      );
    } else {
      createRequest.mutate(
        { ...data, requester_name: profile?.full_name ?? undefined, status: 'SUBMITTED' },
        { onSuccess: () => setDialogOpen(false) },
      );
    }
  };

  if (!hasAccess) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">
              Ce module est réservé au circuit de demandes de maintenance.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statCards = [
    { label: 'En attente', value: stats?.pending ?? 0, icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
    { label: 'Approuvées', value: stats?.approved ?? 0, icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-500/10' },
    { label: 'Clôturées', value: stats?.completed ?? 0, icon: Flag, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { label: 'Rejetées', value: stats?.rejected ?? 0, icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/10' },
    { label: 'Total', value: stats?.total ?? requests.length, icon: FileText, color: 'text-sky-500', bg: 'bg-sky-500/10' },
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Wrench className="h-6 w-6 text-primary" />
            Maintenance
          </h1>
          <p className="text-muted-foreground">
            Demandes d&apos;intervention — validation département → Maintenance → DAF.
          </p>
        </div>
        {isLoading && <div className="text-xs text-muted-foreground">Chargement...</div>}
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`rounded-lg p-2 ${stat.bg}`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <MaintenanceRequestsList
        requests={requests}
        currentUserId={currentUserId}
        canApprove={canApprove}
        canComplete={canComplete}
        onNew={handleNew}
        onEdit={handleEdit}
        onDelete={(id) => deleteRequest.mutate(id)}
        onSubmit={(id) => submitRequest.mutate({ id })}
        onApprove={(id) => approveRequest.mutate({ id })}
        onReject={(id, reason) => rejectRequest.mutate({ id, reason })}
        onReturn={(id, reason) => returnRequest.mutate({ id, reason })}
        onCancel={(id, reason) => cancelRequest.mutate({ id, reason })}
        onComplete={(id) => completeRequest.mutate({ id })}
      />

      <MaintenanceRequestDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        request={selected}
        defaultDepartment={primaryDepartment}
        onSave={handleSave}
        isLoading={createRequest.isPending || updateRequest.isPending}
      />
    </div>
  );
};
