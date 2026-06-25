export const DEFAULT_ADMIN = {
    email: "admin@ecodatte.local",
    password: "Admin123!",
    fullName: "System Administrator",
    role: "administrateur_systeme",
    roles: [
        "admin",
        "administrateur_systeme",
        "directeur_general",
        "directeur_usine",
        "responsable_production",
        "responsable_qualite",
        "inspecteur_qualite",
        "chef_reception",
        "operateur_reception",
        "operateur_nettoyage",
        "operateur_fumigation",
        "operateur_triage_ia",
        "operateur_conditionnement",
        "operateur_emballage",
        "magasinier_wms",
        "responsable_logistique",
        "responsable_achats",
        "responsable_maintenance",
        "technicien_maintenance",
        "fournisseur_externe",
        "client_externe",
        "auditeur_externe",
        "technico_commercial",
        "directeur_achat",
        "resp_management_qualite",
        "resp_qualite_haccp",
        "responsable_reception",
        "responsable_stock",
        "partenaire_client_export",
    ],
    domains: ["admin", "direction", "achat", "reception", "qualite", "production", "magasin", "export", "maintenance"],
};
export const STEP_DEFINITIONS = [
    { code: "RECEPTION", name: "Reception", description: "Reception et identification des lots", sequence_order: 1 },
    { code: "QC_IN", name: "Controle Qualite", description: "Controle qualite entrant", sequence_order: 2 },
    { code: "CLEANING", name: "Nettoyage", description: "Lavage et nettoyage", sequence_order: 3 },
    { code: "TREATMENT", name: "Traitement", description: "Traitement des lots", sequence_order: 4 },
    { code: "DRYING", name: "Sechage", description: "Hydratation / sechage", sequence_order: 5 },
    { code: "SORTING", name: "Triage", description: "Triage et calibrage", sequence_order: 6 },
    { code: "PACKING", name: "Conditionnement", description: "Conditionnement primaire et secondaire", sequence_order: 7 },
    { code: "STORAGE", name: "Entreposage", description: "Stockage et expedition", sequence_order: 8 },
];
export const QC_CHECKLISTS = [
    {
        code: "QC-DATES-STD",
        name: "Reception dattes",
        reception_type: "DATTE",
        description: "Checklist standard reception dattes",
        version: 1,
        items: [
            { code: "DOCS", category: "Documents", name: "Conformite BL et certificats", severity: "MAJEUR", sequence_order: 1 },
            { code: "TRACE", category: "Origine", name: "Origine et tracabilite", severity: "CRITIQUE", sequence_order: 2 },
            { code: "HUM", category: "Physicochimie", name: "Humidite reception", severity: "MAJEUR", sequence_order: 3 },
            { code: "VIS", category: "Visuel", name: "Aspect visuel et defauts", severity: "MAJEUR", sequence_order: 4 },
            { code: "CONT", category: "Contamination", name: "Parasites / moisissures", severity: "CRITIQUE", sequence_order: 5 },
        ],
    },
    {
        code: "QC-PACK-STD",
        name: "Reception emballages",
        reception_type: "EMBALLAGE",
        description: "Checklist standard reception emballages",
        version: 1,
        items: [
            { code: "REF", category: "Reference", name: "Reference article", severity: "MAJEUR", sequence_order: 1 },
            { code: "PACKINT", category: "Emballage", name: "Integrite emballage", severity: "MAJEUR", sequence_order: 2 },
            { code: "LABEL", category: "Etiquetage", name: "Etiquetage fournisseur", severity: "MINEUR", sequence_order: 3 },
        ],
    },
];
export const DEMO_STOCK_LOCATIONS = [
    { code: "MP-A1", name: "Zone MP A1", zone: "MP", capacity_kg: 15000, capacity_units: 120, current_load_kg: 0, current_load_units: 0, is_cold: false, is_dry: true, access_level: "standard", is_active: true },
    { code: "PF-B1", name: "Zone PF B1", zone: "PF", capacity_kg: 9000, capacity_units: 80, current_load_kg: 0, current_load_units: 0, is_cold: true, is_dry: true, access_level: "standard", is_active: true },
    { code: "EMB-C1", name: "Zone EMB C1", zone: "EMB", capacity_kg: 4000, capacity_units: 60, current_load_kg: 0, current_load_units: 0, is_cold: false, is_dry: true, access_level: "standard", is_active: true },
];
export const DEMO_PRODUCTS = [
    { code: "MP-DN-001", name: "Deglet Nour Fraiche", category: "MP", unit: "kg", variety: "Deglet Nour", threshold_min: 1000, threshold_security: 2000, threshold_max: 10000, rotation_rule: "FIFO", is_active: true },
    { code: "PF-DN-001", name: "Deglet Nour Conditionnee", category: "PF", unit: "kg", variety: "Deglet Nour", threshold_min: 500, threshold_security: 1000, threshold_max: 6000, rotation_rule: "FEFO", is_active: true },
];
export const FLUX_CODE_CONFIG = [
    { code: 'F1', label: 'Datte branchée', color: '#D4A017' },
    { code: 'F2', label: 'Datte vrac calibrée', color: '#C8860A' },
    { code: 'F3', label: 'Datte dénoyautée', color: '#A0780A' },
    { code: 'F4', label: 'Datte glacée / enrobée', color: '#E8B84B' },
    { code: 'F5', label: 'Pâte de datte', color: '#8B6914' },
    { code: 'F6', label: 'Sirop de datte', color: '#B5651D' },
    { code: 'F7', label: 'Sucre de datte', color: '#CD853F' },
    { code: 'F8', label: 'Noyaux valorisés', color: '#6B4423' },
];
export const ORDER_STATUS_CONFIG = [
    { code: 'draft', label: 'Brouillon', color: 'bg-gray-500' },
    { code: 'planned', label: 'Planifié', color: 'bg-blue-500' },
    { code: 'in_progress', label: 'En cours', color: 'bg-yellow-500' },
    { code: 'completed', label: 'Terminé', color: 'bg-green-500' },
    { code: 'cancelled', label: 'Annulé', color: 'bg-red-500' },
];
export const STEP_STATUS_CONFIG = [
    { code: 'pending', label: 'En attente', color: 'bg-gray-400' },
    { code: 'in_progress', label: 'En cours', color: 'bg-blue-500' },
    { code: 'completed', label: 'Terminé', color: 'bg-green-500' },
    { code: 'failed', label: 'Échoué', color: 'bg-red-500' },
    { code: 'skipped', label: 'Ignoré', color: 'bg-orange-400' },
];
export const DEMO_MATERIALS = [
    { code: "MAT-BOX-001", name: "Carton export 5kg", unit: "piece", min_stock: 200, is_active: true },
    { code: "MAT-PAL-001", name: "Palette Europe", unit: "piece", min_stock: 50, is_active: true },
];
export const DEMO_SUPPLIERS = [
    {
        code: "SUP-0001",
        name: "Cooperative Oasis Tozeur",
        country: "Tunisie",
        is_active: true,
        supplier_status: "active",
        produced_varieties: ["Deglet Nour"],
        quality_score: 88,
        contract_type: "saisonnier",
        contract_start_date: "2026-05-24",
        contract_end_date: "2026-12-31",
        contract_records: [
            {
                reference: "CTR-DEMO-2026",
                type: "saisonnier",
                status: "active",
                start_date: "2026-05-24",
                end_date: "2026-12-31",
                compliance_status: "compliant",
            },
        ],
    },
];
