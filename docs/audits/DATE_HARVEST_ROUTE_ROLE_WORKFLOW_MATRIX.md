# Route, role and workflow matrix

Date: 6 Nov 2026, `main` at `1556ff0`. Sources: `src/App.tsx`, `src/pages/Index.tsx`, `src/lib/roleAccess.ts`, `src/lib/apiAccess.ts`, the screen files.
**Who can open what, and who can write what, is generated:** [`generated-role-matrix.md`](generated-role-matrix.md) (`npx vite-node scripts/docs/role-matrix.ts`). Regenerate it instead of editing it.

## Top-level routes

| Route | Component | Who | Notes |
|---|---|---|---|
| `/` | `pages/Index.tsx` | signed-in staff | The shell; screen chosen by `?tab=` |
| `/auth` | `pages/Auth.tsx` | everyone | Sign-in, language switcher, password change |
| `/dashboard` | `pages/Dashboard.tsx` | signed-in | Legacy link, renders the shell |
| `/alerts` | `pages/AlertsCenter.tsx` | roles with the alerts tab | Standalone alert list |
| `/portail` | `pages/SupplierPortal.tsx` | `fournisseur_externe`, directors, admin | Supplier self-service; suppliers land here |
| `/passport/:lotId` | `pages/PassportPage.tsx` | public | Public lot passport |
| `*` | `pages/NotFound.tsx` | everyone | Recovery |

## Screens inside the shell (`/?tab=`)

| Tab | Screen | Sub-views / inner tabs | Opens when the role can read | Main write actions |
|---|---|---|---|---|
| `home` | `home/HomePage` (+ `RoleLanding`, `LotJourneyHub`) | `view=fiches` → `fiches/FichesTechniquesHub` | always | — |
| `live` | `home/FactoryCommandCenter` | — | `GET /api/analytics/live-factory` | — |
| `scan` | `scan/ScanStation` | historique, qualite, stock, transfo, production, expedition | `GET /api/trust/golden-thread` | recall |
| `alerts` | `alerts/AlertsCenter` → `FactoryAlertsCenter` | — | `GET /api/batches/alerts` | acknowledge alerts |
| `receptions` | `reception/ReceptionDashboardV2` | today, pending, registry, alerts, qc; `view=new` (intake), `view=bra` (`documents/DocumentsWorkspace`) | `GET /api/receptions` | receptionCreate, receptionCancel, receptionQc, storageMove |
| `storage` (+ legacy `stock-*`) | `batches/StorageZonesOverview` | dashboard, lots, zones, mouvements, conditions, gestion | `GET /api/stock/reception-lots` | storageMove, stockUpdate, stockMovement, inventoryCreate |
| `production` | `production/ProductionWorkspace` | today, orders, pipeline, done, fumigation, nettoyage, hydratation, triage, flux, balance, haccp, kpi, alertes (`views.ts`) | `GET /api/production/orders` | productionCreate/Plan/Start/Step/Check/Allocate/Output/Complete/Cancel; phase2 cycle actions |
| `packaging` | `packaging/PackagingDashboard` | orders, bom, labels, palettes | `GET /api/packaging/orders` | packagingCreate/Start/Progress/Toggle/Close, packagingPalette, packagingSeal |
| `logistics` | `logistics/LogisticsDashboard`, `TransportWorkspace` | shipments, bde, stock-pf, transport, compliance, recall; `view=bde` → `DocumentsWorkspace` | `GET /api/stock/shipments` | shipmentCreate/Update, stockExpedition |
| `quality` | `quality/QualityDashboard` | capa, audit | `GET /api/capa-tickets` | CAPA create/update |
| `suppliers` | `mes/SuppliersList`, `SupplierDetailSheet`, `SupplierDialog` | — | `GET /api/suppliers` | supplier create/update |
| `materials` | `mes/MaterialsList` | — | `GET /api/materials` | material create/update/delete |
| `purchasing` | `purchasing/PurchasingDashboard` | requisitions, orders, rfq, receipts, invoices, certificates, kpis, settlements | `GET /api/purchasing/requisitions` | requisitionCreate, PO, receipts, invoices |
| `customers` | `customers/CustomersDashboard` | — | `GET /api/customers` | customer create/update |
| `export` | `export/ExportDashboard` | orders, contracts, coa | `GET /api/export-orders` | export order status, contracts, COA |
| `maintenance` | `maintenance/MaintenanceDashboard` | requests list | `GET /api/maintenance/requests` | request create/assign/close |
| `hr` | `employees/HRDashboard` | pointages, taches | `GET /api/employees` | timesheets, tasks, employees |
| `analytics` | `analytics/AnalyticsDashboard` (managers) or `FounderAnalyticsDashboard` (directors/admin) | managers: direction, production, quality, stock, costs · directors: live, funnel, reception, stock, phase2, packaging, alerts, suppliers, audit | `GET /api/analytics/health-score` | — |
| `sage-operations` | `home/SageOperationsHub` | margin cockpit, golden thread | `GET /api/trust/golden-thread` | — |
| `settings` | `settings/SettingsDashboard` | fiches, branding, features, plant, operations, quality, costing, documents, notifications, p2p, integrations, users, product | admin roles | settings writes, users, PINs |

Other URL parameters kept by the shell: `lot=`, `focus=` (e.g. `quarantine`), `action=new`, `fiche=`, `module=` (production alias of `view=`).

## Role groups and what each needs first

| Group (`getShellDensity`) | Roles | First job on a shift | Where it lives today |
|---|---|---|---|
| floor — reception | `operateur_reception`, `chef_reception`, `responsable_reception` | Book a delivery, weigh, finish drafts | `receptions` today / `view=new` |
| floor — quality | `inspecteur_qualite` | Inspect lots waiting for QC | `receptions` `view=qc` |
| floor — processing | `operateur_nettoyage`, `operateur_fumigation`, `operateur_triage_ia` | Run the active cycle of their stage | `production` `view=nettoyage/fumigation/triage` |
| floor — packaging | `operateur_conditionnement`, `operateur_emballage` | Run packaging orders, pallets | `packaging` |
| floor — warehouse | `magasinier_wms`, `responsable_stock` | Place, move, isolate lots | `storage` |
| floor — maintenance | `technicien_maintenance` | Work maintenance requests | `maintenance` |
| floor — external | `auditeur_externe`, `fournisseur_externe`, `client_externe`, `partenaire_client_export` | Read-only audit / portal | `quality`, `/portail`, `logistics` |
| supervisor | `responsable_production`, `responsable_qualite`, `responsable_logistique`, `responsable_achats`, `responsable_maintenance`, `technico_commercial`, `directeur_achat`, `resp_management_qualite`, `resp_qualite_haccp` | Queues, exceptions, approvals in their domain | module screens + analytics |
| direction | `directeur_usine`, `directeur_general`, `administrateur_systeme` | Plant view, decisions, configuration | `live`, `analytics`, `settings` |

## Workflow handoffs (server-enforced)

| From | To | Gate |
|---|---|---|
| Reception intake | QC | Intake booked with lots; drafts versioned (`DRAFT_STALE`, `DRAFT_CLOSED`) |
| QC | Storage | Decision with numeric PIN; only a QC decision releases stock |
| Storage | Processing | Source lot released (`STOCK_LIBERE`) and placed |
| Fumigation | Triage | Premium route needs fumigation CCP on the lot ledger |
| Triage | Packaging | Graded sub-lots `<lot>-<session>-EX/C1/C2`, mass balance reconciled |
| Packaging | Shipment | Sealed pallets; idempotent orders |
| Shipment | Customer | Readiness checks (`assertShipmentReadyToShip`) |
