import { apiRequest } from '@/integrations/mongodb/client';
import type {
  BoxMaterial,
  LabelBrand,
  LabelLanguage,
  LabelStatus,
  PackagingBOMItem,
  PackagingFormat,
  PackagingLine,
  PackagingOrder,
  PackagingOrderStatus,
  PackagingPalette,
  PrivateLabelClient,
  TriageGradeInput,
} from '@/types/packaging';

type ApiEnvelope<T> = {
  data: T;
};

export type PackagingBomInput = {
  name: string;
  sku: string;
  format: PackagingFormat;
  net_weight_g: number;
  gross_weight_g: number;
  box_material: BoxMaterial;
  boxes_per_layer: number;
  layers_per_palette: number;
  label_template_id: string | null;
  label_template_name: string | null;
  is_private_label: boolean;
  private_label_client_id: string | null;
  private_label_client_name: string | null;
  notes: string | null;
  created_by: string;
};

export type LabelTemplateInput = {
  name: string;
  version: string;
  brand: LabelBrand;
  client_name: string | null;
  language: LabelLanguage;
  market: string;
  product_name: string;
  variety: string | null;
  origin: string;
  net_weight_g: number;
  ingredients: string;
  allergens: string | null;
  storage_temp: string;
  use_by_days: number;
  gtin: string | null;
  created_by: string;
};

export type PrivateLabelClientInput = {
  name: string;
  code: string;
  country: string;
  contact_name: string | null;
  contact_email: string | null;
};

export type AvailablePackagingSublot = {
  id: string;
  lot_number: string;
  parent_lot_number: string;
  parent_reception_id: string;
  grade: TriageGradeInput;
  weight_kg: number;
  destination: string;
  created_at: string;
  variety?: string | null;
  origin_country?: string | null;
};

export type CreatePackagingOrderInput = {
  source_sublot_id: string;
  source_lot_number: string;
  source_weight_kg: number;
  grade: TriageGradeInput;
  bom_id: string;
  bom_name: string;
  bom_format: PackagingFormat;
  bom_net_weight_g: number;
  label_template_id: string;
  label_template_name: string;
  label_status: LabelStatus;
  line: PackagingLine;
  planned_at: string;
  operator_name: string;
  chef_ligne: string | null;
  worker_count: number;
  notes: string | null;
  created_by: string;
};

export type UpdatePackagingProgressInput = {
  id: string;
  produced_units: number;
  rejected_units: number;
  checkweigher_count: number;
  checkweigher_failures: number;
  metal_detector_failures: number;
  target_units: number;
  order_number: string;
};

export type CreatePackagingPaletteInput = {
  order_id: string;
  order_number: string;
  bom_id: string;
  box_count: number;
  gross_weight_per_box_g: number;
};

export type SealPackagingPaletteInput = {
  id: string;
  order_id: string;
  palette_number: string;
  seal_number: string;
  sealed_by: string;
  serial_counter: number;
};

export const packagingApi = {
  listBoms: async () => {
    const response = await apiRequest<ApiEnvelope<PackagingBOMItem[]>>('/packaging/boms');
    return response.data || [];
  },

  createBom: async (payload: PackagingBomInput) => {
    const response = await apiRequest<ApiEnvelope<PackagingBOMItem>>('/packaging/boms', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return response.data;
  },

  updateBom: async (id: string, payload: Record<string, unknown>) => {
    const response = await apiRequest<ApiEnvelope<PackagingBOMItem>>(`/packaging/boms/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return response.data;
  },

  toggleBomActive: async (id: string, is_active: boolean) => {
    const response = await apiRequest<ApiEnvelope<PackagingBOMItem>>(`/packaging/boms/${encodeURIComponent(id)}/toggle-active`, {
      method: 'POST',
      body: JSON.stringify({ is_active }),
    });
    return response.data;
  },

  listLabelTemplates: async (status?: LabelStatus) => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    const suffix = params.toString() ? `?${params.toString()}` : '';
    const response = await apiRequest<ApiEnvelope<LabelTemplate[]>>(`/packaging/label-templates${suffix}`);
    return response.data || [];
  },

  createLabelTemplate: async (payload: LabelTemplateInput) => {
    const response = await apiRequest<ApiEnvelope<LabelTemplate>>('/packaging/label-templates', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return response.data;
  },

  updateLabelTemplate: async (id: string, payload: Record<string, unknown>) => {
    const response = await apiRequest<ApiEnvelope<LabelTemplate>>(`/packaging/label-templates/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return response.data;
  },

  approveLabelTemplate: async (id: string, approved_by: string) => {
    const response = await apiRequest<ApiEnvelope<LabelTemplate>>(`/packaging/label-templates/${encodeURIComponent(id)}/approve`, {
      method: 'POST',
      body: JSON.stringify({ approved_by }),
    });
    return response.data;
  },

  archiveLabelTemplate: async (id: string) => {
    const response = await apiRequest<ApiEnvelope<LabelTemplate>>(`/packaging/label-templates/${encodeURIComponent(id)}/archive`, {
      method: 'POST',
    });
    return response.data;
  },

  listPrivateLabelClients: async () => {
    const response = await apiRequest<ApiEnvelope<PrivateLabelClient[]>>('/packaging/private-label-clients');
    return response.data || [];
  },

  createPrivateLabelClient: async (payload: PrivateLabelClientInput) => {
    const response = await apiRequest<ApiEnvelope<PrivateLabelClient>>('/packaging/private-label-clients', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return response.data;
  },

  togglePrivateLabelClient: async (id: string, active: boolean) => {
    const response = await apiRequest<ApiEnvelope<PrivateLabelClient>>(`/packaging/private-label-clients/${encodeURIComponent(id)}/toggle-active`, {
      method: 'POST',
      body: JSON.stringify({ active }),
    });
    return response.data;
  },

  listAvailableSublots: async () => {
    const response = await apiRequest<ApiEnvelope<AvailablePackagingSublot[]>>('/packaging/available-sublots');
    return response.data || [];
  },

  listOrders: async (status?: PackagingOrderStatus) => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    const suffix = params.toString() ? `?${params.toString()}` : '';
    const response = await apiRequest<ApiEnvelope<PackagingOrder[]>>(`/packaging/orders${suffix}`);
    return response.data || [];
  },

  createOrder: async (payload: CreatePackagingOrderInput) => {
    const response = await apiRequest<ApiEnvelope<PackagingOrder>>('/packaging/orders', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return response.data;
  },

  startOrder: async (id: string, label_status: LabelStatus) => {
    const response = await apiRequest<ApiEnvelope<PackagingOrder>>(`/packaging/orders/${encodeURIComponent(id)}/start`, {
      method: 'POST',
      body: JSON.stringify({ label_status }),
    });
    return response.data;
  },

  updateProgress: async (id: string, payload: Omit<UpdatePackagingProgressInput, 'id'>) => {
    const response = await apiRequest<ApiEnvelope<PackagingOrder>>(`/packaging/orders/${encodeURIComponent(id)}/progress`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return response.data;
  },

  toggleRunState: async (id: string, current_status: PackagingOrderStatus) => {
    const response = await apiRequest<ApiEnvelope<{ status: PackagingOrderStatus }>>(`/packaging/orders/${encodeURIComponent(id)}/toggle-run`, {
      method: 'POST',
      body: JSON.stringify({ current_status }),
    });
    return response.data;
  },

  closeOrder: async (
    id: string,
    payload: {
      started_at: string;
      produced_units: number;
      target_units: number;
      order_number: string;
    },
  ) => {
    const response = await apiRequest<ApiEnvelope<PackagingOrder>>(`/packaging/orders/${encodeURIComponent(id)}/close`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return response.data;
  },

  listOrderPalettes: async (orderId: string) => {
    const response = await apiRequest<ApiEnvelope<PackagingPalette[]>>(`/packaging/orders/${encodeURIComponent(orderId)}/palettes`);
    return response.data || [];
  },

  listPalettes: async () => {
    const response = await apiRequest<ApiEnvelope<PackagingPalette[]>>('/packaging/palettes');
    return response.data || [];
  },

  createPalette: async (payload: CreatePackagingPaletteInput) => {
    const response = await apiRequest<ApiEnvelope<PackagingPalette>>('/packaging/palettes', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return response.data;
  },

  sealPalette: async (id: string, payload: Omit<SealPackagingPaletteInput, 'id'>) => {
    const response = await apiRequest<ApiEnvelope<{ sscc: string; palette_number: string }>>(`/packaging/palettes/${encodeURIComponent(id)}/seal`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return response.data;
  },
};
