# Royal Palm Phase 1 - Schema Base de Donnees Reception

## Objectif

Ce schema couvre l'etape de reception des dattes:

- enregistrement de chaque arrivage
- pesage brut / tare / net
- generation d'un `LOT-ID`
- creation des unites logistiques
- traçabilite et notification qualite

## Tables coeur

### `suppliers`

Champs utilises par la reception:

- `id`
- `code`
- `name`
- `region`
- `oasis_name`
- `gps_coordinates`
- `supplier_status`
- `certifications`
- `quality_score`

Contraintes metier:

- `supplier_status = active` pour autoriser une reception
- bio declare bloque si aucune certification bio valide

### `purchase_orders`

Lien optionnel avec la reception.

Champs utiles:

- `id`
- `supplier_id`
- `order_number`
- `status`

### `receptions_v2`

En-tete de reception.

Champs existants/utilises:

- `id`
- `reception_number`
- `supplier_id`
- `material_id`
- `delivery_note_number`
- `delivery_note_photos`
- `vehicle_number`
- `driver_name`
- `quantity_total`
- `unit`
- `packaging_type`
- `status`
- `created_by`
- `created_at`

Extensions Phase 1 stockees dans le meme document:

- `purchase_order_id`
- `spontaneous_delivery`
- `gross_weight_kg`
- `tare_weight_kg`
- `declared_weight_kg`
- `weight_gap_percent`
- `crate_count`
- `average_weight_per_crate`
- `variety`
- `harvest_method`
- `maturity_stage`
- `harvest_datetime`
- `bio_declared`
- `arrival_temperature_c`
- `departure_time`
- `transport_condition`
- `quick_visual_state`
- `temporary_zone_id`
- `storage_zone_code`
- `phase1_alerts`
- `transport_duration_hours`
- `qc_score`
- `qc_grade`
- `qc_auto_reject_reasons`

### `reception_lots`

Lot traçable cree a l'entree.

Champs:

- `id`
- `reception_id`
- `lot_internal`
- `lot_supplier`
- `quantity`
- `unit`
- `origin_country`
- `origin_region`
- `origin_farm`
- `harvest_date`
- `maturity_stage`
- `variety`
- `stock_status`

Convention Phase 1:

- `lot_internal` = `TN-[REGION]-[FOURNISSEUR]-[AAAAMMJJ]-[SEQ]`

### `reception_units`

Unites logistiques derivees du lot:

- `id`
- `reception_lot_id`
- `unit_type`
- `barcode`
- `sscc`
- `quantity`
- `unit`
- `gross_weight`
- `net_weight`
- `tare_weight`
- `location_id`
- `position`
- `unit_status`
- `label_printed_at`

### `weighbridge_events`

Table recommandee pour industrialiser l'interface pont-bascule.

Champs proposes:

- `id`
- `reception_id`
- `event_type` (`GROSS`, `TARE`)
- `weight_kg`
- `source` (`MODBUS`, `MANUAL_OVERRIDE`)
- `reason`
- `captured_by`
- `captured_at`

### `reception_alerts`

Alertes metier de reception:

- ecart poids
- temperature arrivee
- vehicule deja vu dans la journee
- reception bloquee

### `system_notifications`

Notifications internes visibles dans la plateforme:

- reception validee en attente QC
- score fournisseur degrade
- fournisseur bloque

### `reception_audit_logs_v2` / `system_audit_logs`

Traçabilite inviolable:

- creation reception
- creation lot
- creation unites
- changement de statut
- decision QC

## Relations

- `suppliers 1 -> n receptions_v2`
- `purchase_orders 1 -> n receptions_v2`
- `receptions_v2 1 -> n reception_lots`
- `reception_lots 1 -> n reception_units`
- `receptions_v2 1 -> n qc_inspections`
- `receptions_v2 1 -> n reception_alerts`

## Index recommandes

- `suppliers(code)`
- `suppliers(fiscal_identifier)` unique
- `receptions_v2(created_at desc)`
- `receptions_v2(status)`
- `receptions_v2(supplier_id)`
- `receptions_v2(vehicle_number, actual_arrival_date)`
- `reception_lots(lot_internal)` unique
- `reception_units(reception_lot_id)`
- `qc_inspections(reception_id)`

## Regles serveur a faire respecter

- fournisseur actif obligatoire
- minimum 2 photos
- poids net > 0
- `tare < gross`
- alerte si ecart > 3%
- blocage bio si certification invalide
- `LOT-ID` unique genere cote serveur uniquement
- controle qualite separe du createur de reception
