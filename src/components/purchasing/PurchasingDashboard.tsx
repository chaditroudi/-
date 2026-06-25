import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  FileText, ShoppingCart, TrendingUp, Clock,
  CheckCircle, XCircle, Send, Package, Factory, ArrowRight,
  FileSearch, Truck, Receipt, ShieldCheck, BarChart3,
} from 'lucide-react';
import { RequisitionsList } from './RequisitionsList';
import { RequisitionDialog } from './RequisitionDialog';
import { RequisitionDetailSheet } from './RequisitionDetailSheet';
import { PurchaseOrdersList } from './PurchaseOrdersList';
import { PurchaseOrderDialog } from './PurchaseOrderDialog';
import { PurchaseOrderDetail } from './PurchaseOrderDetail';
import { RFQPanel } from './p2p/RFQPanel';
import { GoodsReceiptsPanel } from './p2p/GoodsReceiptsPanel';
import { InvoicesPanel } from './p2p/InvoicesPanel';
import { CertificatesPanel } from './p2p/CertificatesPanel';
import { P2PKpiPanel } from './p2p/P2PKpiPanel';
import { 
  useRequisitions, 
  useCreateRequisition, 
  useUpdateRequisition,
  useApproveRequisition,
  useRejectRequisition,
  useDeleteRequisition,
  usePurchaseOrders,
  useCreatePurchaseOrder,
  useUpdatePurchaseOrder,
  useSendPurchaseOrder,
  useConfirmPurchaseOrder,
  useApprovePurchaseOrder,
  useReceivePurchaseOrderLine,
  useSavePurchaseOrderThreeWayMatch,
  useDeletePurchaseOrder,
  useClosePurchaseOrder,
  usePurchasingStats
} from '@/hooks/usePurchasing';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useMaterials } from '@/hooks/useMaterials';
import { PurchaseRequisition, PurchaseOrder, normalizePurchaseOrderStatus } from '@/types/purchasing';
import { useAuthContext } from '@/contexts/AuthContext';
import type { ActorRole } from '@/types/roles';

const REQUISITION_WORKFLOW_ROLES: ActorRole[] = [
  'responsable_stock',
  'responsable_achats',
  'directeur_achat',
  'directeur_general',
  'directeur_usine',
  'administrateur_systeme',
];

const PURCHASE_ORDER_MANAGEMENT_ROLES: ActorRole[] = [
  'responsable_achats',
  'directeur_achat',
  'directeur_general',
  'directeur_usine',
  'administrateur_systeme',
];

const PURCHASE_ORDER_READ_ROLES: ActorRole[] = [
  ...PURCHASE_ORDER_MANAGEMENT_ROLES,
  'responsable_stock',
  'responsable_reception',
  'chef_reception',
  'operateur_reception',
];

type RequisitionSaveData = {
  requester_name: string;
  department: string | null;
  material_id: string | null;
  material_name: string;
  quantity: number;
  unit: string;
  urgency: 'low' | 'normal' | 'high' | 'critical';
  justification: string | null;
  estimated_cost: number | null;
  preferred_supplier_id: string | null;
  notes: string | null;
  status: string;
};

type OrderLineSaveData = {
  material_id?: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
};

type PurchaseOrderSaveData = {
  supplier_id: string;
  requisition_id: string | null;
  order_type: string | null;
  order_date: string;
  expected_delivery_date: string | null;
  currency: string;
  tax_amount: number;
  subtotal: number;
  total_amount: number;
  payment_terms: string | null;
  advance_paid: number | null;
  delivery_address: string | null;
  delivery_site: string | null;
  transport_mode: string | null;
  incoterm: string | null;
  supplier_reference: string | null;
  variety: string | null;
  quality_expected: string | null;
  bio_required: boolean;
  tolerance_pct: number | null;
  notes: string | null;
  created_by: string;
};

export const PurchasingDashboard = ({ onNavigate }: { onNavigate?: (tab: string, prefillPOId?: string) => void }) => {
  const { t } = useTranslation();
  const { hasAnyRole, roles, profile } = useAuthContext();
  const currentUser = profile?.full_name ?? 'Utilisateur';
  const [activeTab, setActiveTab] = useState('requisitions');
  const [reqDialogOpen, setReqDialogOpen] = useState(false);
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedReq, setSelectedReq] = useState<PurchaseRequisition | null>(null);
  const [detailReq, setDetailReq] = useState<PurchaseRequisition | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const [fromRequisition, setFromRequisition] = useState<PurchaseRequisition | null>(null);

  const canManageRequisitions = hasAnyRole(REQUISITION_WORKFLOW_ROLES);
  const canManagePurchaseOrders = hasAnyRole(PURCHASE_ORDER_MANAGEMENT_ROLES);
  const canReadPurchaseOrders = hasAnyRole(PURCHASE_ORDER_READ_ROLES);
  const isStockPlanningUser = roles.includes('responsable_stock');
  const hasPurchasingAccess = canManageRequisitions || canReadPurchaseOrders;

  useEffect(() => {
    if (!canManagePurchaseOrders && activeTab === 'orders') {
      setActiveTab('requisitions');
    }
  }, [activeTab, canManagePurchaseOrders]);

  // Data
  const { data: requisitions = [], isLoading: reqLoading } = useRequisitions(undefined, {
    enabled: canManageRequisitions,
  });
  const {
    data: orders = [],
    isLoading: ordersLoading,
    error: ordersError,
  } = usePurchaseOrders(undefined, {
    enabled: canReadPurchaseOrders,
  });
  const { data: suppliers = [] } = useSuppliers();
  const { data: materials = [] } = useMaterials();
  const { data: stats } = usePurchasingStats({
    enabled: hasPurchasingAccess,
  });

  // Mutations
  const createReq = useCreateRequisition();
  const updateReq = useUpdateRequisition();
  const approveReq = useApproveRequisition();
  const rejectReq = useRejectRequisition();
  const deleteReq = useDeleteRequisition();

  const createOrder = useCreatePurchaseOrder();
  const updateOrder = useUpdatePurchaseOrder();
  const sendOrder = useSendPurchaseOrder();
  const confirmOrder = useConfirmPurchaseOrder();
  const approveOrder = useApprovePurchaseOrder();
  const receiveOrderLine = useReceivePurchaseOrderLine();
  const saveThreeWayMatch = useSavePurchaseOrderThreeWayMatch();
  const deleteOrder = useDeletePurchaseOrder();
  const closeOrder = useClosePurchaseOrder();
 
  const workflowMessage = useMemo(() => {
    if (!isStockPlanningUser) {
      return 'Les besoins sont consolidés et validés avant transmission. Le magasinier reste limité au suivi du stock disponible.';
    }

    return 'Le magasinier suit uniquement les quantités disponibles. Les besoins d\'achat sont consolidés et validés par l\'équipe de gestion des stocks après planification, puis transmis au service achats.';
  }, [isStockPlanningUser]);

  // Handlers
  const handleNewReq = () => {
    setSelectedReq(null);
    setReqDialogOpen(true);
  };

  const handleEditReq = (req: PurchaseRequisition) => {
    setSelectedReq(req);
    setReqDialogOpen(true);
  };

  const handleSaveReq = (data: RequisitionSaveData) => {
    if (selectedReq) {
      updateReq.mutate({ id: selectedReq.id, ...data }, {
        onSuccess: () => setReqDialogOpen(false)
      });
    } else {
      createReq.mutate({ ...data, status: 'pending_approval' }, {
        onSuccess: () => setReqDialogOpen(false)
      });
    }
  };

  const handleCreateOrderFromReq = (req: PurchaseRequisition) => {
    setFromRequisition(req);
    setSelectedOrder(null);
    setActiveTab('orders');
    setOrderDialogOpen(true);
  };

  const handleNewOrder = () => {
    setFromRequisition(null);
    setSelectedOrder(null);
    setActiveTab('orders');
    setOrderDialogOpen(true);
  };

  const handleEditOrder = (order: PurchaseOrder) => {
    setFromRequisition(null);
    setSelectedOrder(order);
    setOrderDialogOpen(true);
  };

  const handleSaveOrder = (orderData: PurchaseOrderSaveData, lines: OrderLineSaveData[]) => {
    if (selectedOrder) {
      updateOrder.mutate(
        {
          id: selectedOrder.id,
          order: {
            ...orderData,
            requisition_id: orderData.requisition_id ?? selectedOrder.requisition_id,
            status: selectedOrder.status,
            invoice_status: selectedOrder.invoice_status,
            receipt_status: selectedOrder.receipt_status,
            goods_receipt_count: selectedOrder.goods_receipt_count ?? 0,
          },
          lines,
        },
        {
          onSuccess: () => setOrderDialogOpen(false),
        },
      );
      return;
    }

    createOrder.mutate({ order: orderData, lines }, {
      onSuccess: () => {
        setOrderDialogOpen(false);
        setFromRequisition(null);
        setActiveTab('orders');
      }
    });
  };
 
  const handleViewOrder = (order: PurchaseOrder) => {
    setSelectedOrder(order);
    setDetailDialogOpen(true);
  };

  const statCards = canManagePurchaseOrders
    ? [
        {
          label: t('purchasing.status.pending'),
          value: stats?.requisitions.pending || 0,
          icon: Clock,
          color: 'text-yellow-500',
          bg: 'bg-yellow-500/10'
        },
        {
          label: t('purchasing.status.approved'),
          value: stats?.requisitions.approved || 0,
          icon: CheckCircle,
          color: 'text-green-500',
          bg: 'bg-green-500/10'
        },
        {
          label: 'BC soumis / confirmés',
          value: (stats?.orders.submitted || 0) + (stats?.orders.confirmed || 0),
          icon: Send,
          color: 'text-blue-500',
          bg: 'bg-blue-500/10'
        },
        {
          label: 'Livraisons partielles',
          value: stats?.orders.partiallyDelivered || 0,
          icon: Factory,
          color: 'text-orange-500',
          bg: 'bg-orange-500/10'
        },
        {
          label: t('common.total'),
          value: `${((stats?.orders.monthlyAmount || 0) / 1000).toFixed(1)}k`,
          icon: TrendingUp,
          color: 'text-emerald-500',
          bg: 'bg-emerald-500/10',
          suffix: 'TND'
        },
      ]
    : [
        {
          label: 'DA en attente',
          value: stats?.requisitions.pending || 0,
          icon: Clock,
          color: 'text-yellow-500',
          bg: 'bg-yellow-500/10'
        },
        {
          label: 'DA validées',
          value: stats?.requisitions.approved || 0,
          icon: CheckCircle,
          color: 'text-green-500',
          bg: 'bg-green-500/10'
        },
        {
          label: 'DA refusées',
          value: stats?.requisitions.rejected || 0,
          icon: XCircle,
          color: 'text-red-500',
          bg: 'bg-red-500/10'
        },
        {
          label: 'BC en cours',
          value: (stats?.orders.submitted || 0) + (stats?.orders.confirmed || 0) + (stats?.orders.partiallyDelivered || 0),
          icon: Send,
          color: 'text-blue-500',
          bg: 'bg-blue-500/10'
        },
        {
          label: 'Demandes totales',
          value: stats?.requisitions.total || requisitions.length,
          icon: FileText,
          color: 'text-emerald-500',
          bg: 'bg-emerald-500/10'
        },
      ];

  if (!hasPurchasingAccess) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('purchasing.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Ce module est réservé au workflow de validation des besoins et au service achats.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('purchasing.title')}</h1>
          <p className="text-muted-foreground">
            {canManagePurchaseOrders
              ? `${t('purchasing.requisitions')} & ${t('purchasing.orders')}`
              : 'Validation des besoins d\'achat avant transmission au service achats'}
          </p>
        </div>
        {(reqLoading || ordersLoading) && (
          <div className="text-xs text-muted-foreground">Synchronisation SAGE en cours...</div>
        )}
      </div>

      {/* Reception bridge banner */}
      {(() => {
        const awaitingReception = orders.filter((o) => {
          const cs = (o as any).canonical_status ?? normalizePurchaseOrderStatus(o.status);
          return cs === 'confirmed' || cs === 'partially_delivered';
        });
        if (!awaitingReception.length || !onNavigate) return null;
        return (
          <div className="flex flex-col gap-2 px-4 py-2.5 bg-sky-50 border border-sky-200 rounded-xl text-sm">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-sky-600 shrink-0" />
              <span className="font-semibold text-sky-700">
                {awaitingReception.length} commande(s) confirmée(s) en attente de réception physique
              </span>
            </div>
            <div className="flex flex-wrap gap-2 pl-6">
              {awaitingReception.slice(0, 5).map((o) => (
                <button
                  key={o.id}
                  onClick={() => onNavigate('receptions', o.id)}
                  className="inline-flex items-center gap-1 text-xs font-mono font-semibold text-sky-700 bg-sky-100 hover:bg-sky-200 px-2 py-0.5 rounded transition-colors"
                >
                  {o.order_number} <ArrowRight className="h-3 w-3" />
                </button>
              ))}
              {awaitingReception.length > 5 && (
                <button
                  onClick={() => onNavigate('receptions')}
                  className="text-xs text-sky-600 hover:text-sky-800 underline underline-offset-2"
                >
                  +{awaitingReception.length - 5} autres
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${stat.bg}`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {stat.value}
                    {stat.suffix && <span className="text-sm font-normal ml-1">{stat.suffix}</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="requisitions" className="gap-2">
            <FileText className="h-4 w-4" />
            {t('purchasing.requisitions')}
          </TabsTrigger>
          {canManagePurchaseOrders && (
            <TabsTrigger value="orders" className="gap-2">
              <ShoppingCart className="h-4 w-4" />
              {t('purchasing.orders')}
            </TabsTrigger>
          )}
          {canManagePurchaseOrders && (
            <TabsTrigger value="rfq" className="gap-2">
              <FileSearch className="h-4 w-4" />
              Appels d'offres
            </TabsTrigger>
          )}
          {canManagePurchaseOrders && (
            <TabsTrigger value="receipts" className="gap-2">
              <Truck className="h-4 w-4" />
              Réceptions
            </TabsTrigger>
          )}
          {canManagePurchaseOrders && (
            <TabsTrigger value="invoices" className="gap-2">
              <Receipt className="h-4 w-4" />
              Factures
            </TabsTrigger>
          )}
          <TabsTrigger value="certificates" className="gap-2">
            <ShieldCheck className="h-4 w-4" />
            Certificats
          </TabsTrigger>
          {canManagePurchaseOrders && (
            <TabsTrigger value="kpis" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              KPIs P2P
            </TabsTrigger>
          )}
        </TabsList>

         <TabsContent value="requisitions" className="mt-4">
           <RequisitionsList
             requisitions={requisitions}
             onNew={handleNewReq}
             onEdit={handleEditReq}
             onView={(req) => setDetailReq(req)}
             onDelete={(id) => deleteReq.mutate(id)}
             onApprove={(id, name) => approveReq.mutate({ id, approverName: name })}
             onReject={(id, reason, name) => rejectReq.mutate({ id, reason, rejectorName: name })}
             onCreateOrder={handleCreateOrderFromReq}
             canCreate={canManageRequisitions}
             canApprove={canManageRequisitions}
             canReject={canManageRequisitions}
             canEdit={canManageRequisitions}
             canDelete={canManageRequisitions}
             canCreateOrder={canManagePurchaseOrders}
             workflowMessage={workflowMessage}
           />
         </TabsContent>

         {canManagePurchaseOrders && (
           <TabsContent value="orders" className="mt-4">
             <PurchaseOrdersList
               orders={orders}
               isLoading={ordersLoading}
               errorMessage={ordersError instanceof Error ? ordersError.message : null}
               onNew={handleNewOrder}
               onEdit={handleEditOrder}
               onDelete={(id) => deleteOrder.mutate(id)}
               onSend={(id) => sendOrder.mutate(id)}
               onConfirm={(id) => confirmOrder.mutate({ id })}
               onApprove={(id, approverName) => approveOrder.mutate({ id, approverName })}
               onReceive={handleViewOrder}
               onClose={(id) => closeOrder.mutate(id)}
               onView={handleViewOrder}
             />
           </TabsContent>
         )}

         {canManagePurchaseOrders && (
           <TabsContent value="rfq" className="mt-4">
             <RFQPanel suppliers={suppliers} currentUser={currentUser} />
           </TabsContent>
         )}

         {canManagePurchaseOrders && (
           <TabsContent value="receipts" className="mt-4">
             <GoodsReceiptsPanel
               suppliers={suppliers}
               orders={orders}
               currentUser={currentUser}
             />
           </TabsContent>
         )}

         {canManagePurchaseOrders && (
           <TabsContent value="invoices" className="mt-4">
             <InvoicesPanel
               suppliers={suppliers}
               orders={orders}
               currentUser={currentUser}
             />
           </TabsContent>
         )}

         <TabsContent value="certificates" className="mt-4">
           <CertificatesPanel suppliers={suppliers} />
         </TabsContent>

         {canManagePurchaseOrders && (
           <TabsContent value="kpis" className="mt-4">
             <P2PKpiPanel />
           </TabsContent>
         )}
       </Tabs>
 
       {/* Dialogs */}
       <RequisitionDialog
         open={reqDialogOpen}
         onOpenChange={setReqDialogOpen}
         requisition={selectedReq}
         materials={materials}
         suppliers={suppliers}
         onSave={handleSaveReq}
         isLoading={createReq.isPending || updateReq.isPending}
       />
 
       <PurchaseOrderDialog
         open={orderDialogOpen}
         onOpenChange={setOrderDialogOpen}
         order={selectedOrder}
         fromRequisition={fromRequisition}
         materials={materials}
         suppliers={suppliers}
        onSave={handleSaveOrder}
        isLoading={createOrder.isPending || updateOrder.isPending}
      />
 
       <PurchaseOrderDetail
         open={detailDialogOpen}
         onOpenChange={setDetailDialogOpen}
         order={selectedOrder}
         onReceiveLine={(payload) => receiveOrderLine.mutate(payload)}
         onSaveThreeWayMatch={(payload) => saveThreeWayMatch.mutate(payload)}
         isReceiving={receiveOrderLine.isPending}
         isSavingThreeWayMatch={saveThreeWayMatch.isPending}
       />

       <RequisitionDetailSheet
         requisition={detailReq}
         linkedOrder={detailReq ? orders.find((o) => o.requisition_id === detailReq.id) ?? null : null}
         onClose={() => setDetailReq(null)}
         canCreateOrder={canManagePurchaseOrders}
         onCreateOrder={(req) => {
           setDetailReq(null);
           handleCreateOrderFromReq(req);
         }}
       />
     </div>
   );
 };
