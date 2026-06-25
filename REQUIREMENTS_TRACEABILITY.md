# Requirements Traceability

Date: 2026-05-04
Scope: cartographie des exigences Royal Palm vers l'architecture actuelle du projet existant

## Source Set

Codes utilises dans la matrice:

- `FCD` = `Royal_Palm_Full_Chain_Documentation.md`
- `PIFR` = `Royal_Palm_Plateforme_Intelligente_FR.md`
- `BMF` = `Royal_Palm_Backlog_Modulaire_FR.md`
- `M01A` = `Royal_Palm_Module_01_Amont_FR.md`
- `M01E` = `Royal_Palm_Module_01_Ecrans_FR.md`
- `EP00` = `00_README_Execution_Pack.md`
- `EP01` = `01_Royal_Palm_Playbook_AZ.md`
- `EP02` = `02_Royal_Palm_Registre_Papiers_Formulaires.md`
- `EP03` = `03_Royal_Palm_Contrats_Donnees_Interfaces.md`
- `EP04` = `04_Royal_Palm_KPI_Risques_Validation.md`
- `EP05` = `05_Royal_Palm_Roadmap_Execution_26_Semaines.md`
- `EP06` = `06_Royal_Palm_Confirmation_Matrix_FR.md`

## Architecture Actuelle Detectee

- Frontend: SPA `React 18 + TypeScript + Vite` avec navigation par onglets dans `src/pages/Index.tsx`.
- UI: architecture modulaire par domaine sous `src/components/*` (`reception`, `stock`, `production`, `logistics`, `purchasing`, `analytics`, `batches`, `mes`).
- Data access: hooks metier sous `src/hooks/*`, client Mongo/API dans `src/integrations/mongodb/client.ts`, typage sous `src/types/*`.
- Auth et roles: `src/hooks/useAuth.ts`, `src/contexts/AuthContext.tsx`, `src/types/roles.ts`, `src/components/auth/ProtectedRoute.tsx`.
- Backend: `Node.js + Express` centralise dans `server/index.js`, API generique `/api/auth/*`, `/api/db/*`, `/api/rpc/*`, services techniques sous `server/services/*`.
- Persistence: adaptateur dynamique `MongoDB/Mongoose` avec fallback local JSON (`server/local-db.json`).
- Proxy dev: `vite.config.ts` redirige `/api` vers `http://localhost:4000`.
- Tests: Vitest couvre maintenant le front minimal et le socle serveur `auth/RBAC/middleware` via `server/services/*.test.js`.

## Legende Cible Code

- `EXISTANT`: emplacement deja present dans le projet
- `EXTENDRE`: emplacement existant a completer
- `NOUVEAU`: emplacement recommande, absent a ce stade

## Matrice Requirement -> Spec -> Module Code Cible

| ID | Requirement / capacite | Spec source | Module code cible |
|---|---|---|---|
| `REQ-01` | Gouvernance plateforme lot-centrique, web + mobile, chaine complete fournisseur -> expedition | `PIFR` sections 1-5, 13-16; `FCD` sections 3-5, 7-11; `EP01` sections 1-3; `EP06` sections 3, 7 | `EXISTANT` `src/pages/Index.tsx`, `src/components/layout/*`, `src/components/home/*`, `server/index.js` |
| `REQ-02` | Referentiels, roles, permissions, master data site/locations/produits/varietes | `BMF` Module 1; `PIFR` sections 10-12; `FCD` sections 6-8; `EP03` sections 1-2; `EP05` V1 | `EXISTANT` `src/hooks/useAuth.ts`, `src/contexts/AuthContext.tsx`, `src/types/roles.ts`, `src/components/mes/*`; `EXTENDRE` `src/types/*`, `server/index.js`; `NOUVEAU` `server/models/*`, `server/routes/*`, `server/controllers/*` |
| `REQ-02A` | Authentification JWT et routes protegees | `BMF` Module 1; `PIFR` sections 5.1-5.2, 12; `EP03` sections 5, 7; `EP05` V1 | `EXISTANT` `server/services/auth.js`, `server/services/middleware.js`, `server/index.js`, `src/hooks/useAuth.ts`, `src/components/auth/ProtectedRoute.tsx`, `src/App.tsx` |
| `REQ-02B` | RBAC par domaines metier `achat`, `reception`, `qualite`, `magasin`, `production`, `export`, `admin` | `BMF` Module 1; `PIFR` sections 5, 12; `FCD` section 8; `EP03` sections 2, 4, 7; `EP05` V1 | `EXISTANT` `server/services/rbac.js`, `server/services/middleware.js`, `server/index.js`; `EXTENDRE` `src/types/roles.ts` pour converger a terme vers les roles cibles normalises |
| `REQ-02C` | Audit trail de base `createdBy/updatedBy` + event logs | `FCD` section 6, 8, 9; `PIFR` sections 4.8, 12, 14; `EP03` section 5; `EP04` sections 1-3; `EP05` V3-V6 | `EXISTANT` `server/services/audit.js`, `server/index.js`, collection `system_audit_logs`; `EXTENDRE` `src/components/analytics/*` pour visualisation audit |
| `REQ-02D` | Conventions d'erreurs API homogenes avec codes et `requestId` | `EP03` section 7; `EP04` sections 2-4; `EP05` V1 | `EXISTANT` `server/services/apiErrors.js`, `server/index.js`, `src/integrations/mongodb/client.ts` |
| `REQ-03` | Gestion fournisseur qualifie, certificats, statut bio/conventionnel, score fournisseur | `M01A` 4.1; `M01E` section 2; `PIFR` 4.1, 7.1, 8.1; `EP02` docs `RP-FOU-*`; `EP03` 3.1; `EP04` risque derive fournisseur | `EXISTANT` `src/components/mes/SuppliersList.tsx`, `src/hooks/useSuppliers.ts`, `src/types/mes.ts`; `EXTENDRE` `server/index.js` |
| `REQ-04` | Demandes/commandes achat, lignes, ecarts reception vs commande, impressions | `M01A` 4.2; `M01E` section 3; `PIFR` 6.1, 7.1; `BMF` Module 1; `EP02` `RP-ACH-BON-004`; `EP03` 3.2, 7; `EP05` V1 | `EXISTANT` `src/components/purchasing/*`, `src/hooks/usePurchasing.ts`, `src/types/purchasing.ts`; `EXTENDRE` `server/index.js` |
| `REQ-05` | Pre-annonce arrivage / inbound notice / planning arrivages | `M01A` 4.3; `PIFR` 4.2, 6.2, 7.2; `FCD` 5.1-5.2; `EP01` workflow A-Z; `EP03` objets `InboundNotice`; `EP05` V2 | `EXTENDRE` `src/components/reception/ReceptionWizard.tsx`, `src/hooks/useReceptionsV2.ts`, `src/types/reception.ts`; `NOUVEAU` `src/components/reception/InboundNotice*`, `server/models/InboundNotice*` |
| `REQ-06` | Gate check vehicule / entree site / gestion exceptions reception | `PIFR` 4.2, 6.2; `M01A` 4.3-4.4; `EP01` sections 2, 5; `EP02` `RP-GAT-CHK-006`; `EP04` risque reception hors standard | `EXTENDRE` `src/components/reception/ReceptionWizard.tsx`, `src/components/reception/ReceptionDashboardV2.tsx`, `src/hooks/useReceptionsV2.ts`; `NOUVEAU` `src/components/reception/GateCheck*` |
| `REQ-07` | Pesee brut/tare/net, ticket pesee, lien reception -> poids nets | `PIFR` 4.2, 6.3; `M01A` 4.4; `BMF` Module 2; `EP02` `RP-PSG-TKT-007`, `RP-REC-BON-008`; `EP03` 3.3-4, 6; `EP05` V2 | `EXISTANT` `src/components/reception/ScaleTelemetry.tsx`, `src/components/reception/TareCalculator.tsx`, `src/components/reception/SessionLedger.tsx`, `src/hooks/useReceptionsV2.ts`; `EXTENDRE` `server/index.js` |
| `REQ-08` | Creation lot reception, etiquette, QR/barcode, genealogie parentage | `PIFR` 4.2, 6.3, 11; `M01A` 4.4-4.5; `M01E` section 5; `BMF` Module 2; `EP02` `RP-LOT-LBL-010`, `RP-LOT-FRM-011`; `EP03` 3.4-4; `EP04` risque lot orphelin | `EXISTANT` `src/components/reception/ReceptionWizard.tsx`, `src/components/reception/UnitsManagement.tsx`, `src/components/reception/LabelPrintDialog.tsx`, `src/hooks/useReceptionsV2.ts`, `src/hooks/useBatches.ts`, `src/types/reception.ts`, `src/types/batch.ts` |
| `REQ-09` | Quarantaine, QC entrant, decision lot, downgrade/rejet/orientation route | `PIFR` 4.2, 6.4, 7.3, 11; `FCD` 5.3-5.4; `M01A` 4.6; `BMF` Module 3; `EP02` `RP-QA-FRM-013/014`; `EP03` objets `QualityCheck`, statuts lot; `EP04` KPI/UAT | `EXISTANT` `src/components/reception/QCInspectionDialog.tsx`, `src/components/reception/PreQualityCheck.tsx`, `src/components/reception/AlertsPanel.tsx`, `src/components/batches/*`, `src/hooks/useReceptionsV2.ts`, `src/hooks/useBatches.ts` |
| `REQ-10` | Stock MP, chambres froides, emplacements, segregation bio/conventionnel | `PIFR` 4.3, 7.4, 11, 13; `FCD` 5.5, 6; `M01A` 4.7; `BMF` Module 4; `EP03` objets `Location`, `StockMovement`; `EP04` risques melange bio / lots sans emplacement; `EP05` V3 | `EXISTANT` `src/components/stock/*`, `src/components/batches/StorageZonesOverview.tsx`, `src/components/reception/StorageAssignment.tsx`, `src/hooks/useStock.ts`, `src/types/stock.ts` |
| `REQ-11` | Mouvements internes scannes, audit trail, journalisation user/date/heure | `M01A` 4.8; `PIFR` 5.2, 6.2-6.4, 12; `BMF` Module 4, Module 14; `EP02` `RP-STK-BON-016`; `EP03` 3.5, 4-5; `EP04` KPI mouvements / UAT | `EXISTANT` `src/components/stock/MovementsList.tsx`, `src/components/stock/TransferDialog.tsx`, `src/hooks/useStock.ts`; `EXTENDRE` `server/index.js`; `NOUVEAU` `server/services/audit/*` |
| `REQ-12` | Ordres de fabrication, allocation lots liberes, rendement, rebut, lot enfant | `PIFR` 4.4, 6.5-6.10, 7.5; `FCD` 5.6-5.13; `BMF` Module 5; `EP03` objets `WorkOrder`; `EP04` regle aucun OF avec lot non libere; `EP05` V4 | `EXISTANT` `src/components/production/*`, `src/hooks/useProduction.ts`, `src/types/production.ts`; `EXTENDRE` `server/index.js` |
| `REQ-13` | Route premium entier bout en bout | `PIFR` 4.5, 7.6; `FCD` 5.8; `BMF` Module 6 | `EXTENDRE` `src/components/production/*`, `src/hooks/useProduction.ts`; `NOUVEAU` `src/components/production/routes/premium/*`, `src/types/production.ts` |
| `REQ-14` | Route denoyautage et genealogie chair / noyau | `PIFR` 4.5, 7.6; `FCD` 5.9; `BMF` Module 7 | `NOUVEAU` `src/components/production/routes/pitting/*`, `src/hooks/useProduction.ts`, `src/types/production.ts`, `server/models/WorkOrder*` |
| `REQ-15` | Route dattes hachees | `PIFR` 4.5, 7.6; `FCD` 5.10; `BMF` Module 8 | `NOUVEAU` `src/components/production/routes/chopped/*`, `src/hooks/useProduction.ts`, `src/types/production.ts` |
| `REQ-16` | Route pate de dattes | `PIFR` 4.5, 7.6; `FCD` 5.11; `BMF` Module 9 | `NOUVEAU` `src/components/production/routes/paste/*`, `src/hooks/useProduction.ts`, `src/types/production.ts` |
| `REQ-17` | Routes sirop et poudre / sucre de dattes | `PIFR` 4.5, 7.6; `FCD` 5.12-5.13; `BMF` Module 10 | `NOUVEAU` `src/components/production/routes/syrup-powder/*`, `src/hooks/useProduction.ts`, `src/types/production.ts` |
| `REQ-18` | Packaging, etiquettes client/pays, private label, palette | `PIFR` 4.6, 7.7; `FCD` 5.14; `BMF` Module 11; `EP02` `RP-PKG-*`; `EP03` objets `PackagingRun`, `Pallet`, interfaces imprimante etiquette | `EXISTANT` `src/components/reception/LabelPrintDialog.tsx`; `EXTENDRE` `src/components/production/*`, `src/components/logistics/LogisticsDashboard.tsx`; `NOUVEAU` `src/components/packaging/*`, `src/types/stock.ts` |
| `REQ-19` | Stock produit fini, reservation, expedition, conteneur, scelle, cloture | `PIFR` 4.7, 7.8; `FCD` 5.15-5.16; `BMF` Module 12; `EP02` `RP-EXP-BON-021/023`; `EP03` objet `Shipment`; `EP04` UAT expedition; `EP05` V5 | `EXISTANT` `src/components/logistics/LogisticsDashboard.tsx`, `src/components/stock/*`, `src/hooks/useStock.ts`; `EXTENDRE` `server/index.js` |
| `REQ-20` | Dossier documentaire, checklist export, versions et statuts documentaires | `EP02` sections 1-5; `EP03` 4, 6-7; `EP04` KPI conformite; `EP05` V1, V5; `EP06` sections 4-6 | `EXISTANT` `src/components/purchasing/PurchaseOrderPrint.tsx`, `src/components/purchasing/printPurchaseOrder.ts`; `EXTENDRE` `src/components/logistics/LogisticsDashboard.tsx`; `NOUVEAU` `src/components/documents/*`, `server/models/Document*` |
| `REQ-21` | Non-conformites, CAPA, blocages, recall drill, audit trail qualite | `PIFR` 4.8, 7.3, 14-15; `FCD` 6, 9-11; `BMF` Module 13; `EP02` `RP-QA-NC-024`, `RP-QA-CAP-025`, `RP-QA-RCL-026`; `EP03` objets `NonConformance`, `CAPA`; `EP04` risques/UAT; `EP05` V6 | `EXISTANT` `src/components/batches/NonConformityDialog.tsx`, `src/components/batches/AlertsDashboard.tsx`; `EXTENDRE` `src/hooks/useBatches.ts`, `server/index.js`; `NOUVEAU` `src/components/quality/*`, `server/models/NonConformance*`, `server/models/CAPA*` |
| `REQ-22` | Application mobile terrain, scan, photo preuve, execution rapide, offline partiel | `PIFR` 5.2-5.3, 7.2, 14; `BMF` Module 14; `M01A` sections mobile; `M01E` sections 2.8, 3.9, 4.9, 5.8; `EP05` V2-V5 | `EXISTANT` `src/components/reception/PhotoCapture.tsx`, `src/components/reception/ReceptionWizard.tsx`, `src/components/reception/LabelPrintDialog.tsx`, `src/components/ui/sidebar.tsx`; `NOUVEAU` application mobile dediee ou shell PWA avec scan/offline |
| `REQ-23` | Dashboards, KPI, risques, alertes, acceptance/go-live | `PIFR` 13-15; `FCD` 9-11; `BMF` Module 15; `EP04` sections 1-4; `EP05` section 3-4 | `EXISTANT` `src/components/analytics/*`, `src/hooks/useAnalytics.ts`, `src/hooks/useAdvancedAnalytics.ts`, `src/components/home/*` |
| `REQ-24` | Interfaces externes: bascule, imprimante etiquette, ERP, labo, IoT froid, API minimales | `EP03` sections 5-7; `EP01` sections 4-5; `EP05` V2-V6; `EP06` sections 5, 7 | `EXTENDRE` `server/index.js`, `src/integrations/mongodb/client.ts`, `src/types/*`; `NOUVEAU` `server/routes/*`, `server/controllers/*`, `server/services/*`, connecteurs interfaces |
| `REQ-25` | Roadmap de deploiement 26 semaines et priorites MVP | `BMF` sections 1-2, 4-7; `EP05` complet; `EP00` contenu/usage; `EP06` section 7 | `CIBLE TRANSVERSE` pilotage implementation, a refleter dans backlog et statuts; voir `IMPLEMENTATION_STATUS.md` |

## Notes de Traceabilite

- La structure actuelle du code couvre deja les grands domaines `reception`, `stock`, `production`, `purchasing`, `logistics`, `analytics`, mais de facon inegale selon les modules Royal Palm.
- Les exigences les mieux ancrees dans le code existant sont `REQ-02A` a `REQ-02D`, `REQ-03`, `REQ-04`, `REQ-07`, `REQ-08`, `REQ-09`, `REQ-10`, `REQ-12`, `REQ-19`, `REQ-23`.
- Les zones avec plus fort ecart spec -> code sont `REQ-05`, `REQ-06`, `REQ-13` a `REQ-18`, `REQ-20`, `REQ-21`, `REQ-22`, `REQ-24`.
- Les specs execution pack (`EP02` a `EP05`) introduisent des obligations fortes de contrats, papiers, UAT et go-live qui ne sont pas encore visibles comme modules dedies dans l'architecture actuelle.
