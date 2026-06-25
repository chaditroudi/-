var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Injectable } from "@nestjs/common";
import { SiteSettingsModel } from "../../models/site-settings.model.js";
import { AuthUserModel } from "../../models/auth-user.model.js";
const DEFAULT_SETTINGS = {
    id: "global",
    company_name: "Royal Palm Dates",
    company_short_name: "RP",
    company_legal_name: "Royal Palm Dates SARL",
    site_code: "RP-TOZ",
    country_code: "TN",
    logo_url: null,
    logo_base64: null,
    primary_color: "#107754",
    accent_color: "#d97706",
    plant_name: "Usine Tozeur",
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
    default_language: "fr",
    currency: "TND",
    timezone: "Africa/Tunis",
    interface: {
        ui_density: "comfortable",
        default_home_tab: "home",
        show_kpi_cards: true,
        enable_animations: true,
        rows_per_page: 25,
        date_format: "dd/MM/yyyy",
        time_format: "24h",
    },
    operations: {
        allow_spontaneous_reception: true,
        require_purchase_order_for_reception: false,
        require_vehicle_number_on_reception: true,
        auto_assign_material_from_po: true,
        shift_model: "2x8",
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
        expiry_tracking_mode: "recommended",
        lot_release_requires_qc: true,
        default_qc_sample_percent: 10,
        deviation_escalation_hours: 4,
        recall_coordinator: null,
        allergen_tracking_enabled: false,
        cold_chain_monitoring_enabled: false,
    },
    documents: {
        reception_prefix: "REC",
        purchase_order_prefix: "PO",
        production_order_prefix: "OF",
        packaging_order_prefix: "PKG",
        shipment_prefix: "EXP",
        pallet_prefix: "PAL",
        lot_prefix: "LOT",
        numbering_padding: 5,
        show_logo_on_prints: true,
        print_language: "fr",
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
        digest_hour: "07:30",
        escalation_after_minutes: 60,
    },
    integrations: {
        scale_capture_enabled: false,
        barcode_scanner_enabled: true,
        label_printer_enabled: true,
        qr_labels_enabled: true,
        erp_sync_mode: "manual",
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
            ROYALE_PALM: {
                code: "ROYALE_PALM",
                name: "Royale Palm Tunisia",
                bio_certification_required: false,
                phytosanitary_required: false,
                lot_traceability_required: false,
                dluo_required: false,
                fds_required: false,
                forex_enabled: true,
                systematic_quarantine: false,
                cert_alert_days: [60, 30],
            },
            ECODATTE: {
                code: "ECODATTE",
                name: "EcoDatte",
                bio_certification_required: true,
                phytosanitary_required: true,
                lot_traceability_required: false,
                dluo_required: false,
                fds_required: false,
                forex_enabled: false,
                systematic_quarantine: false,
                cert_alert_days: [60, 30],
            },
            BIOSCHA: {
                code: "BIOSCHA",
                name: "Bioscha",
                bio_certification_required: false,
                phytosanitary_required: false,
                lot_traceability_required: true,
                dluo_required: true,
                fds_required: true,
                forex_enabled: false,
                systematic_quarantine: true,
                cert_alert_days: [60, 30],
            },
        },
        approval_matrix: [
            { level: "dept_manager", threshold_gte: 0, label: "Responsable département" },
            { level: "purchasing_manager", threshold_gte: 1000, label: "Responsable Achats" },
            { level: "daf", threshold_gte: 10000, label: "DAF" },
            { level: "general_direction", threshold_gte: 50000, label: "Direction Générale" },
        ],
    },
    updated_by: null,
    updated_at: new Date().toISOString(),
};
const mergeSection = (defaults, value) => ({
    ...defaults,
    ...(value || {}),
});
const mergeP2PSettings = (value) => ({
    ...DEFAULT_SETTINGS.p2p,
    ...(value || {}),
    sites: {
        ROYALE_PALM: mergeSection(DEFAULT_SETTINGS.p2p.sites.ROYALE_PALM, value?.sites?.ROYALE_PALM),
        ECODATTE: mergeSection(DEFAULT_SETTINGS.p2p.sites.ECODATTE, value?.sites?.ECODATTE),
        BIOSCHA: mergeSection(DEFAULT_SETTINGS.p2p.sites.BIOSCHA, value?.sites?.BIOSCHA),
    },
    approval_matrix: Array.isArray(value?.approval_matrix) && value.approval_matrix.length > 0
        ? value.approval_matrix.map((step) => ({
            level: step.level,
            threshold_gte: Number(step.threshold_gte ?? 0),
            label: step.label,
        }))
        : DEFAULT_SETTINGS.p2p.approval_matrix.map((step) => ({ ...step })),
});
const normalizeSettings = (value) => ({
    ...DEFAULT_SETTINGS,
    ...(value || {}),
    features: mergeSection(DEFAULT_SETTINGS.features, value?.features),
    interface: mergeSection(DEFAULT_SETTINGS.interface, value?.interface),
    operations: mergeSection(DEFAULT_SETTINGS.operations, value?.operations),
    quality: mergeSection(DEFAULT_SETTINGS.quality, value?.quality),
    documents: mergeSection(DEFAULT_SETTINGS.documents, value?.documents),
    notifications: mergeSection(DEFAULT_SETTINGS.notifications, value?.notifications),
    integrations: mergeSection(DEFAULT_SETTINGS.integrations, value?.integrations),
    p2p: mergeP2PSettings(value?.p2p),
});
let SettingsService = class SettingsService {
    async getSettings() {
        let doc = await SiteSettingsModel.findOne({ id: "global" }).lean().exec();
        if (!doc) {
            doc = await SiteSettingsModel.create(DEFAULT_SETTINGS);
        }
        const { _id, ...rest } = doc;
        return normalizeSettings(rest);
    }
    async updateSettings(patch, updatedBy) {
        const current = await this.getSettings();
        const { id: _id, ...safeUpdate } = patch;
        const merged = normalizeSettings({
            ...current,
            ...safeUpdate,
            features: safeUpdate.features ? mergeSection(current.features, safeUpdate.features) : current.features,
            interface: safeUpdate.interface ? mergeSection(current.interface, safeUpdate.interface) : current.interface,
            operations: safeUpdate.operations ? mergeSection(current.operations, safeUpdate.operations) : current.operations,
            quality: safeUpdate.quality ? mergeSection(current.quality, safeUpdate.quality) : current.quality,
            documents: safeUpdate.documents ? mergeSection(current.documents, safeUpdate.documents) : current.documents,
            notifications: safeUpdate.notifications ? mergeSection(current.notifications, safeUpdate.notifications) : current.notifications,
            integrations: safeUpdate.integrations ? mergeSection(current.integrations, safeUpdate.integrations) : current.integrations,
            p2p: safeUpdate.p2p ? mergeP2PSettings({ ...current.p2p, ...safeUpdate.p2p }) : current.p2p,
            updated_by: updatedBy,
            updated_at: new Date().toISOString(),
        });
        const updated = await SiteSettingsModel.findOneAndUpdate({ id: "global" }, { $set: merged }, { upsert: true, new: true, lean: true }).exec();
        const { _id: __id, ...rest } = updated;
        return normalizeSettings(rest);
    }
    async listUsers() {
        const users = await AuthUserModel.find({})
            .select("-passwordHash -password_hash")
            .lean()
            .exec();
        return users.map((u) => ({
            id: u.id,
            email: u.email,
            is_active: u.is_active ?? true,
            full_name: u.user_metadata?.full_name ?? null,
            roles: u.user_metadata?.roles ?? (u.user_metadata?.role ? [u.user_metadata.role] : []),
            created_at: u.created_at,
        }));
    }
    async updateUser(userId, patch) {
        const update = { updated_at: new Date().toISOString() };
        if (typeof patch.is_active === "boolean") {
            update.is_active = patch.is_active;
        }
        if (Array.isArray(patch.roles) && patch.roles.length > 0) {
            update["user_metadata.roles"] = patch.roles;
        }
        await AuthUserModel.updateOne({ id: userId }, { $set: update }).exec();
        const updated = (await AuthUserModel.findOne({ id: userId })
            .select("-passwordHash -password_hash")
            .lean()
            .exec());
        return {
            id: updated.id,
            email: updated.email,
            is_active: updated.is_active ?? true,
            full_name: updated.user_metadata?.full_name ?? null,
            roles: updated.user_metadata?.roles ?? [],
            created_at: updated.created_at,
        };
    }
};
SettingsService = __decorate([
    Injectable()
], SettingsService);
export { SettingsService };
export const settingsService = new SettingsService();
