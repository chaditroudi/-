| Role | Shell | Lands on | home | live | scan | alerts | receptions | storage | production | packaging | logistics | quality | suppliers | materials | purchasing | customers | export | maintenance | hr | analytics | sage-operations | settings |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `directeur_general` | direction | home | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |  | ● | ● | ● | ● | ● | ● | ● | ● |
| `directeur_usine` | direction | home | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |  | ● | ● | ● | ● | ● | ● | ● | ● |
| `responsable_production` | supervisor | home | ● | ● | ● | ● |  |  | ● | ● |  |  |  |  |  |  |  | ● | ● | ● | ● |  |
| `responsable_qualite` | supervisor | home | ● | ● | ● | ● | ● | ● |  |  |  | ● |  |  |  |  |  | ● | ● | ● | ● |  |
| `inspecteur_qualite` | floor | home | ● |  | ● | ● | ● |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `chef_reception` | floor | home | ● | ● | ● | ● | ● | ● |  |  |  |  |  |  |  |  |  |  | ● |  | ● |  |
| `operateur_reception` | floor | home | ● |  | ● | ● | ● |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `operateur_nettoyage` | floor | home | ● |  | ● | ● |  |  | ● |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `operateur_fumigation` | floor | home | ● |  | ● | ● |  |  | ● |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `operateur_triage_ia` | floor | home | ● |  | ● | ● |  |  | ● |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `operateur_conditionnement` | floor | home | ● |  | ● | ● |  |  |  | ● |  |  |  |  |  |  |  |  |  |  |  |  |
| `operateur_emballage` | floor | home | ● |  | ● | ● |  |  |  | ● |  |  |  |  |  |  |  |  |  |  |  |  |
| `magasinier_wms` | floor | home | ● |  | ● | ● |  | ● |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `responsable_logistique` | supervisor | home | ● | ● | ● | ● |  | ● |  |  | ● |  |  |  |  |  | ● |  | ● | ● |  |  |
| `responsable_achats` | supervisor | home | ● | ● | ● | ● |  |  |  |  |  |  | ● | ● | ● |  |  |  | ● | ● |  |  |
| `responsable_maintenance` | supervisor | home | ● |  | ● | ● |  |  | ● |  |  |  |  |  |  |  |  | ● | ● |  |  |  |
| `technicien_maintenance` | floor | home | ● |  | ● | ● |  |  | ● |  |  |  |  |  |  |  |  | ● |  |  |  |  |
| `administrateur_systeme` | direction | home | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| `fournisseur_externe` | floor | suppliers | ● |  |  |  |  |  |  |  |  |  | ● |  |  |  |  |  |  |  |  |  |
| `client_externe` | floor | logistics | ● |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `auditeur_externe` | floor | home | ● |  | ● | ● |  |  |  |  |  | ● |  |  |  |  |  |  |  |  |  |  |
| `technico_commercial` | supervisor | home | ● | ● | ● |  |  |  |  |  |  |  |  |  |  | ● | ● |  |  | ● |  |  |
| `directeur_achat` | supervisor | home | ● | ● | ● |  |  |  |  |  |  |  | ● | ● | ● |  |  |  | ● | ● |  |  |
| `resp_management_qualite` | supervisor | home | ● | ● | ● | ● |  |  |  |  |  | ● |  |  |  |  |  |  | ● | ● |  |  |
| `resp_qualite_haccp` | supervisor | home | ● | ● | ● | ● |  |  |  |  |  | ● |  |  |  |  |  |  | ● | ● |  |  |
| `responsable_reception` | floor | home | ● | ● | ● | ● | ● | ● |  |  |  |  |  |  |  |  |  |  | ● |  |  |  |
| `responsable_stock` | floor | home | ● | ● | ● | ● |  | ● |  |  |  |  |  |  | ● |  |  | ● | ● |  |  |  |
| `partenaire_client_export` | floor | logistics | ● |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |

### Write actions by role

| Action | Server route | Roles allowed |
|---|---|---|
| receptionCreate | `POST /api/receptions/intake` | `directeur_general`, `directeur_usine`, `responsable_qualite`, `chef_reception`, `operateur_reception`, `administrateur_systeme`, `responsable_reception` |
| receptionCancel | `POST /api/receptions/:receptionId/cancel` | `directeur_general`, `directeur_usine`, `responsable_qualite`, `chef_reception`, `administrateur_systeme`, `responsable_reception` |
| receptionQc | `POST /api/qc/submit` | `directeur_general`, `directeur_usine`, `responsable_qualite`, `inspecteur_qualite`, `administrateur_systeme`, `resp_management_qualite`, `resp_qualite_haccp` |
| storageMove | `POST /api/reception-lots/:lotId/storage-moves` | `directeur_general`, `directeur_usine`, `responsable_qualite`, `chef_reception`, `operateur_reception`, `magasinier_wms`, `responsable_logistique`, `administrateur_systeme`, `responsable_reception`, `responsable_stock` |
| requisitionCreate | `POST /api/purchasing/requisitions` | `directeur_general`, `directeur_usine`, `responsable_production`, `responsable_qualite`, `chef_reception`, `magasinier_wms`, `responsable_logistique`, `responsable_achats`, `responsable_maintenance`, `administrateur_systeme`, `directeur_achat`, `responsable_reception`, `responsable_stock` |
| recall | `POST /api/trust/recall` | `directeur_general`, `directeur_usine`, `responsable_production`, `responsable_qualite`, `inspecteur_qualite`, `responsable_logistique`, `administrateur_systeme`, `resp_management_qualite`, `resp_qualite_haccp` |
| productionCreate | `POST /api/production/orders` | `directeur_general`, `directeur_usine`, `responsable_production`, `operateur_nettoyage`, `operateur_fumigation`, `operateur_triage_ia`, `operateur_conditionnement`, `operateur_emballage`, `administrateur_systeme` |
| productionUpdate | `PATCH /api/production/orders/:id` | `directeur_general`, `directeur_usine`, `responsable_production`, `operateur_nettoyage`, `operateur_fumigation`, `operateur_triage_ia`, `operateur_conditionnement`, `operateur_emballage`, `administrateur_systeme` |
| productionPlan | `POST /api/production/orders/:id/plan` | `directeur_general`, `directeur_usine`, `responsable_production`, `operateur_nettoyage`, `operateur_fumigation`, `operateur_triage_ia`, `operateur_conditionnement`, `operateur_emballage`, `administrateur_systeme` |
| productionStart | `POST /api/production/orders/:id/start` | `directeur_general`, `directeur_usine`, `responsable_production`, `operateur_nettoyage`, `operateur_fumigation`, `operateur_triage_ia`, `operateur_conditionnement`, `operateur_emballage`, `administrateur_systeme` |
| productionComplete | `POST /api/production/orders/:id/complete` | `directeur_general`, `directeur_usine`, `responsable_production`, `operateur_nettoyage`, `operateur_fumigation`, `operateur_triage_ia`, `operateur_conditionnement`, `operateur_emballage`, `administrateur_systeme` |
| productionCancel | `POST /api/production/orders/:id/cancel` | `directeur_general`, `directeur_usine`, `responsable_production`, `operateur_nettoyage`, `operateur_fumigation`, `operateur_triage_ia`, `operateur_conditionnement`, `operateur_emballage`, `administrateur_systeme` |
| productionAllocate | `POST /api/production/orders/:id/allocate-lot` | `directeur_general`, `directeur_usine`, `responsable_production`, `operateur_nettoyage`, `operateur_fumigation`, `operateur_triage_ia`, `operateur_conditionnement`, `operateur_emballage`, `administrateur_systeme` |
| productionRemoveAllocation | `DELETE /api/production/allocations/:id` | `directeur_general`, `directeur_usine`, `responsable_production`, `operateur_nettoyage`, `operateur_fumigation`, `operateur_triage_ia`, `operateur_conditionnement`, `operateur_emballage`, `administrateur_systeme` |
| productionOutput | `POST /api/production/output-lots` | `directeur_general`, `directeur_usine`, `responsable_production`, `operateur_nettoyage`, `operateur_fumigation`, `operateur_triage_ia`, `operateur_conditionnement`, `operateur_emballage`, `administrateur_systeme` |
| productionStep | `PATCH /api/production/steps/:id` | `directeur_general`, `directeur_usine`, `responsable_production`, `operateur_nettoyage`, `operateur_fumigation`, `operateur_triage_ia`, `operateur_conditionnement`, `operateur_emballage`, `administrateur_systeme` |
| productionCheck | `POST /api/production/quality-checks` | `directeur_general`, `directeur_usine`, `responsable_production`, `operateur_nettoyage`, `operateur_fumigation`, `operateur_triage_ia`, `operateur_conditionnement`, `operateur_emballage`, `administrateur_systeme` |
| packagingCreate | `POST /api/packaging/orders` | `directeur_general`, `directeur_usine`, `responsable_production`, `responsable_qualite`, `operateur_conditionnement`, `operateur_emballage`, `administrateur_systeme`, `resp_qualite_haccp`, `responsable_stock` |
| packagingStart | `POST /api/packaging/orders/:id/start` | `directeur_general`, `directeur_usine`, `responsable_production`, `responsable_qualite`, `operateur_conditionnement`, `operateur_emballage`, `administrateur_systeme`, `resp_qualite_haccp`, `responsable_stock` |
| packagingProgress | `PATCH /api/packaging/orders/:id/progress` | `directeur_general`, `directeur_usine`, `responsable_production`, `responsable_qualite`, `operateur_conditionnement`, `operateur_emballage`, `administrateur_systeme`, `resp_qualite_haccp`, `responsable_stock` |
| packagingClose | `POST /api/packaging/orders/:id/close` | `directeur_general`, `directeur_usine`, `responsable_production`, `responsable_qualite`, `operateur_conditionnement`, `operateur_emballage`, `administrateur_systeme`, `resp_qualite_haccp`, `responsable_stock` |
| packagingSeal | `POST /api/packaging/palettes/:id/seal` | `directeur_general`, `directeur_usine`, `responsable_production`, `responsable_qualite`, `operateur_conditionnement`, `operateur_emballage`, `administrateur_systeme`, `resp_qualite_haccp`, `responsable_stock` |
| packagingPalette | `POST /api/packaging/palettes` | `directeur_general`, `directeur_usine`, `responsable_production`, `responsable_qualite`, `operateur_conditionnement`, `operateur_emballage`, `administrateur_systeme`, `resp_qualite_haccp`, `responsable_stock` |
| packagingToggle | `POST /api/packaging/orders/:id/toggle-run` | `directeur_general`, `directeur_usine`, `responsable_production`, `responsable_qualite`, `operateur_conditionnement`, `operateur_emballage`, `administrateur_systeme`, `resp_qualite_haccp`, `responsable_stock` |
| stockUpdate | `PATCH /api/stock/lots/:id` | `directeur_general`, `directeur_usine`, `responsable_qualite`, `chef_reception`, `magasinier_wms`, `responsable_logistique`, `administrateur_systeme`, `responsable_reception`, `responsable_stock` |
| stockMovement | `POST /api/stock/movements` | `directeur_general`, `directeur_usine`, `responsable_qualite`, `chef_reception`, `magasinier_wms`, `responsable_logistique`, `administrateur_systeme`, `responsable_reception`, `responsable_stock` |
| stockExpedition | `POST /api/stock/expedition` | `directeur_general`, `directeur_usine`, `responsable_qualite`, `chef_reception`, `magasinier_wms`, `responsable_logistique`, `administrateur_systeme`, `responsable_reception`, `responsable_stock` |
| shipmentCreate | `POST /api/stock/shipments` | `directeur_general`, `directeur_usine`, `responsable_qualite`, `chef_reception`, `magasinier_wms`, `responsable_logistique`, `administrateur_systeme`, `responsable_reception`, `responsable_stock` |
| shipmentUpdate | `PATCH /api/stock/shipments/:id` | `directeur_general`, `directeur_usine`, `responsable_qualite`, `chef_reception`, `magasinier_wms`, `responsable_logistique`, `administrateur_systeme`, `responsable_reception`, `responsable_stock` |
| inventoryCreate | `POST /api/stock/inventory-counts` | `directeur_general`, `directeur_usine`, `responsable_qualite`, `chef_reception`, `magasinier_wms`, `responsable_logistique`, `administrateur_systeme`, `responsable_reception`, `responsable_stock` |

### What each screen needs to open

| Tab | Read resource | Server route |
|---|---|---|
| live | liveFactory | `GET /api/analytics/live-factory` |
| scan | goldenThread | `GET /api/trust/golden-thread` |
| alerts | batchAlerts | `GET /api/batches/alerts` |
| receptions | receptions | `GET /api/receptions` |
| storage | receptionLots | `GET /api/stock/reception-lots` |
| production | productionOrders | `GET /api/production/orders` |
| packaging | packagingOrders | `GET /api/packaging/orders` |
| logistics | shipments | `GET /api/stock/shipments` |
| purchasing | requisitions | `GET /api/purchasing/requisitions` |
| quality | capaTickets | `GET /api/capa-tickets` |
| suppliers | suppliers | `GET /api/suppliers` |
| materials | materials | `GET /api/materials` |
| export | exportOrders | `GET /api/export-orders` |
| customers | customers | `GET /api/customers` |
| hr | employees | `GET /api/employees` |
| maintenance | maintenanceRequests | `GET /api/maintenance/requests` |
| analytics | healthScore | `GET /api/analytics/health-score` |
| sage-operations | goldenThread | `GET /api/trust/golden-thread` |
