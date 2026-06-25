import type { ApprovalMatrixStep, SiteCode, SiteConfig } from './p2p';
import { APPROVAL_MATRIX, SITE_CONFIGS } from './p2p';

export type SiteLanguage = 'fr' | 'en' | 'ar';
export type UiDensity = 'compact' | 'comfortable' | 'spacious';
export type TimeFormat = '24h' | '12h';
export type DateFormat = 'dd/MM/yyyy' | 'MM/dd/yyyy' | 'yyyy-MM-dd';
export type ShiftModel = '1x8' | '2x8' | '3x8' | 'custom';
export type ExpiryTrackingMode = 'optional' | 'recommended' | 'required';
export type ErpSyncMode = 'disabled' | 'manual' | 'scheduled' | 'near_real_time';

export interface SiteFeatures {
  receptions_enabled: boolean;
  phase2_enabled: boolean;
  production_enabled: boolean;
  packaging_enabled: boolean;
  logistics_enabled: boolean;
  purchasing_enabled: boolean;
  analytics_enabled: boolean;
  stock_enabled: boolean;
  supplier_master_enabled: boolean;
  materials_master_enabled: boolean;
  alerts_enabled: boolean;
  sage_enabled: boolean;
}

export interface SiteInterfacePreferences {
  ui_density: UiDensity;
  default_home_tab: 'home' | 'sage-operations' | 'production' | 'receptions' | 'analytics';
  show_kpi_cards: boolean;
  enable_animations: boolean;
  rows_per_page: number;
  date_format: DateFormat;
  time_format: TimeFormat;
}

export interface SiteOperationsSettings {
  allow_spontaneous_reception: boolean;
  require_purchase_order_for_reception: boolean;
  require_vehicle_number_on_reception: boolean;
  auto_assign_material_from_po: boolean;
  shift_model: ShiftModel;
  shift_handover_notes_required: boolean;
  production_auto_start_next_step: boolean;
  packaging_requires_final_scan: boolean;
  allow_negative_stock: boolean;
  stock_reservation_enabled: boolean;
}

export interface SiteQualitySettings {
  qc_hold_on_reception: boolean;
  supplier_lot_required: boolean;
  origin_tracking_required: boolean;
  expiry_tracking_mode: ExpiryTrackingMode;
  lot_release_requires_qc: boolean;
  default_qc_sample_percent: number;
  deviation_escalation_hours: number;
  recall_coordinator: string | null;
  allergen_tracking_enabled: boolean;
  cold_chain_monitoring_enabled: boolean;
}

export interface SiteDocumentSettings {
  reception_prefix: string;
  purchase_order_prefix: string;
  production_order_prefix: string;
  packaging_order_prefix: string;
  shipment_prefix: string;
  pallet_prefix: string;
  lot_prefix: string;
  numbering_padding: number;
  show_logo_on_prints: boolean;
  print_language: SiteLanguage;
  certificate_signatory: string | null;
  report_footer: string | null;
}

export interface SiteNotificationSettings {
  browser_notifications_enabled: boolean;
  email_notifications_enabled: boolean;
  low_stock_alert_enabled: boolean;
  expiry_alert_enabled: boolean;
  expiry_alert_days: number;
  qc_alert_enabled: boolean;
  production_delay_alert_enabled: boolean;
  daily_digest_enabled: boolean;
  digest_hour: string;
  escalation_after_minutes: number;
}

export interface SiteIntegrationSettings {
  scale_capture_enabled: boolean;
  barcode_scanner_enabled: boolean;
  label_printer_enabled: boolean;
  qr_labels_enabled: boolean;
  erp_sync_mode: ErpSyncMode;
  maintenance_sync_enabled: boolean;
  ai_assistant_enabled: boolean;
  ai_vision_sorting_enabled: boolean;
  api_webhooks_enabled: boolean;
  transport_tracking_enabled: boolean;
  google_maps_api_key: string | null;
  maps_default_zoom: number;
  tracking_refresh_seconds: number;
  mission_eta_alert_minutes: number;
}

export interface SiteP2PSettings {
  enable_minimum_quotes_rule: boolean;
  rfq_minimum_quote_count: number;
  rfq_quote_threshold_tnd: number;
  require_purchase_order_for_goods_receipt: boolean;
  default_invoice_tolerance_pct: number;
  require_goods_receipt_for_payment: boolean;
  sites: Record<SiteCode, SiteConfig>;
  approval_matrix: ApprovalMatrixStep[];
}

export interface SiteSettings {
  id: string;
  company_name: string;
  company_short_name: string;
  company_legal_name: string | null;
  site_code: string;
  country_code: string;
  logo_url: string | null;
  logo_base64: string | null;
  primary_color: string;
  accent_color: string;
  plant_name: string;
  plant_address: string | null;
  plant_phone: string | null;
  plant_email: string | null;
  features: SiteFeatures;
  default_language: SiteLanguage;
  currency: string;
  timezone: string;
  interface: SiteInterfacePreferences;
  operations: SiteOperationsSettings;
  quality: SiteQualitySettings;
  documents: SiteDocumentSettings;
  notifications: SiteNotificationSettings;
  integrations: SiteIntegrationSettings;
  p2p: SiteP2PSettings;
  updated_by: string | null;
  updated_at: string;
}

export interface ManagedUser {
  id: string;
  email: string;
  full_name: string | null;
  roles: string[];
  is_active: boolean;
  created_at: string;
}

export const DEFAULT_SETTINGS: SiteSettings = {
  id: 'global',
  company_name: 'Royal Palm Dates',
  company_short_name: 'RP',
  company_legal_name: 'Royal Palm Dates SARL',
  site_code: 'RP-TOZ',
  country_code: 'TN',
  logo_url: null,
  logo_base64: null,
  primary_color: '#107754',
  accent_color: '#d97706',
  plant_name: 'Usine Tozeur',
  plant_address: null,
  plant_phone: null,
  plant_email: null,
  features: {
    receptions_enabled: true,
    phase2_enabled: true,
    production_enabled: true,
    packaging_enabled: true,
    logistics_enabled: true,
    purchasing_enabled: true,
    analytics_enabled: true,
    stock_enabled: true,
    supplier_master_enabled: true,
    materials_master_enabled: true,
    alerts_enabled: true,
    sage_enabled: true,
  },
  default_language: 'fr',
  currency: 'TND',
  timezone: 'Africa/Tunis',
  interface: {
    ui_density: 'comfortable',
    default_home_tab: 'home',
    show_kpi_cards: true,
    enable_animations: true,
    rows_per_page: 25,
    date_format: 'dd/MM/yyyy',
    time_format: '24h',
  },
  operations: {
    allow_spontaneous_reception: true,
    require_purchase_order_for_reception: false,
    require_vehicle_number_on_reception: true,
    auto_assign_material_from_po: true,
    shift_model: '2x8',
    shift_handover_notes_required: true,
    production_auto_start_next_step: false,
    packaging_requires_final_scan: true,
    allow_negative_stock: false,
    stock_reservation_enabled: true,
  },
  quality: {
    qc_hold_on_reception: true,
    supplier_lot_required: true,
    origin_tracking_required: true,
    expiry_tracking_mode: 'recommended',
    lot_release_requires_qc: true,
    default_qc_sample_percent: 10,
    deviation_escalation_hours: 4,
    recall_coordinator: null,
    allergen_tracking_enabled: false,
    cold_chain_monitoring_enabled: false,
  },
  documents: {
    reception_prefix: 'REC',
    purchase_order_prefix: 'PO',
    production_order_prefix: 'OF',
    packaging_order_prefix: 'PKG',
    shipment_prefix: 'EXP',
    pallet_prefix: 'PAL',
    lot_prefix: 'LOT',
    numbering_padding: 5,
    show_logo_on_prints: true,
    print_language: 'fr',
    certificate_signatory: null,
    report_footer: null,
  },
  notifications: {
    browser_notifications_enabled: true,
    email_notifications_enabled: false,
    low_stock_alert_enabled: true,
    expiry_alert_enabled: true,
    expiry_alert_days: 30,
    qc_alert_enabled: true,
    production_delay_alert_enabled: true,
    daily_digest_enabled: true,
    digest_hour: '07:30',
    escalation_after_minutes: 60,
  },
  integrations: {
    scale_capture_enabled: false,
    barcode_scanner_enabled: true,
    label_printer_enabled: true,
    qr_labels_enabled: true,
    erp_sync_mode: 'manual',
    maintenance_sync_enabled: false,
    ai_assistant_enabled: false,
    ai_vision_sorting_enabled: false,
    api_webhooks_enabled: false,
    transport_tracking_enabled: true,
    google_maps_api_key: null,
    maps_default_zoom: 10,
    tracking_refresh_seconds: 30,
    mission_eta_alert_minutes: 30,
  },
  p2p: {
    enable_minimum_quotes_rule: true,
    rfq_minimum_quote_count: 3,
    rfq_quote_threshold_tnd: 1000,
    require_purchase_order_for_goods_receipt: false,
    default_invoice_tolerance_pct: 3,
    require_goods_receipt_for_payment: false,
    sites: {
      ROYALE_PALM: { ...SITE_CONFIGS.ROYALE_PALM },
      ECODATTE: { ...SITE_CONFIGS.ECODATTE },
      BIOSCHA: { ...SITE_CONFIGS.BIOSCHA },
    },
    approval_matrix: APPROVAL_MATRIX.map((step) => ({ ...step })),
  },
  updated_by: null,
  updated_at: new Date().toISOString(),
};

const mergeSection = <T extends Record<string, any>>(defaults: T, value?: Partial<T> | null): T => ({
  ...defaults,
  ...(value ?? {}),
});

export const normalizeSiteSettings = (value?: Partial<SiteSettings> | null): SiteSettings => ({
  ...DEFAULT_SETTINGS,
  ...(value ?? {}),
  company_legal_name: value?.company_legal_name ?? DEFAULT_SETTINGS.company_legal_name,
  site_code: value?.site_code ?? DEFAULT_SETTINGS.site_code,
  country_code: value?.country_code ?? DEFAULT_SETTINGS.country_code,
  features: mergeSection(DEFAULT_SETTINGS.features, value?.features),
  interface: mergeSection(DEFAULT_SETTINGS.interface, value?.interface),
  operations: mergeSection(DEFAULT_SETTINGS.operations, value?.operations),
  quality: mergeSection(DEFAULT_SETTINGS.quality, value?.quality),
  documents: mergeSection(DEFAULT_SETTINGS.documents, value?.documents),
  notifications: mergeSection(DEFAULT_SETTINGS.notifications, value?.notifications),
  integrations: mergeSection(DEFAULT_SETTINGS.integrations, value?.integrations),
  p2p: {
    ...DEFAULT_SETTINGS.p2p,
    ...(value?.p2p ?? {}),
    sites: {
      ROYALE_PALM: {
        ...DEFAULT_SETTINGS.p2p.sites.ROYALE_PALM,
        ...(value?.p2p?.sites?.ROYALE_PALM ?? {}),
      },
      ECODATTE: {
        ...DEFAULT_SETTINGS.p2p.sites.ECODATTE,
        ...(value?.p2p?.sites?.ECODATTE ?? {}),
      },
      BIOSCHA: {
        ...DEFAULT_SETTINGS.p2p.sites.BIOSCHA,
        ...(value?.p2p?.sites?.BIOSCHA ?? {}),
      },
    },
    approval_matrix:
      value?.p2p?.approval_matrix?.map((step) => ({ ...step })) ??
      DEFAULT_SETTINGS.p2p.approval_matrix.map((step) => ({ ...step })),
  },
  updated_at: value?.updated_at ?? DEFAULT_SETTINGS.updated_at,
});

export const FEATURE_META: Record<keyof SiteFeatures, { label: string; description: string; tab: string }> = {
  receptions_enabled: {
    label: 'Réceptions',
    description: 'Arrivages, pesée, lots réception et contrôles d’entrée',
    tab: 'receptions',
  },
  phase2_enabled: {
    label: 'Phase 2',
    description: 'Fumigation, nettoyage, hydratation et triage',
    tab: 'production',
  },
  production_enabled: {
    label: 'Ordres de fabrication',
    description: 'Ordres, étapes de production et suivi d’exécution',
    tab: 'production',
  },
  packaging_enabled: {
    label: 'Conditionnement & Étiquetage',
    description: 'Ordres de conditionnement, étiquettes GS1 et palettes',
    tab: 'packaging',
  },
  logistics_enabled: {
    label: 'Logistique & Expédition',
    description: 'Préparation expédition, transport et chargement',
    tab: 'logistics',
  },
  purchasing_enabled: {
    label: 'Achats',
    description: 'Demandes d’achat, commandes et suivi fournisseurs',
    tab: 'purchasing',
  },
  analytics_enabled: {
    label: 'Analytics & Indicateurs',
    description: 'KPI, qualité, stock, rentabilité et pilotage',
    tab: 'analytics',
  },
  stock_enabled: {
    label: 'Stock & Mouvements',
    description: 'Lots, inventaires, mouvements et traçabilité stock',
    tab: 'stock-dashboard',
  },
  supplier_master_enabled: {
    label: 'Référentiel fournisseurs',
    description: 'Base fournisseurs, certifications et statut achat',
    tab: 'suppliers',
  },
  materials_master_enabled: {
    label: 'Référentiel matières',
    description: 'Matières premières, produits, unités et attributs',
    tab: 'materials',
  },
  alerts_enabled: {
    label: 'Alertes',
    description: 'Centre d’alertes, priorisation et traitement des écarts',
    tab: 'alerts',
  },
  sage_enabled: {
    label: 'SAGE Hub',
    description: 'Pont entre opérations, finance, achats et contrôle',
    tab: 'sage-operations',
  },
};
