# Royal Palm Phase 1 - API Backend Reception

## Endpoint principal

`POST /api/receptions/intake`

Endpoint metier dedie a l'etape de reception. Il remplace un enchainement fragile de plusieurs appels frontend et centralise:

- validation fournisseur
- validation des poids
- verification Bio
- creation reception
- generation du `LOT-ID`
- creation des unites logistiques
- creation des alertes et notifications
- journal d'audit

## Authentification

- JWT obligatoire
- meme controle d'acces que les ecritures reception

## Payload

```json
{
  "supplier_id": "uuid",
  "purchase_order_id": "uuid-ou-null",
  "spontaneous_delivery": true,
  "reception_type": "DATTE",
  "material_id": "uuid",
  "delivery_note_number": "BL-2026-001",
  "delivery_note_photos": ["data:image/jpeg;base64,...", "data:image/jpeg;base64,..."],
  "vehicle_number": "TU-4521-A",
  "driver_name": "Ali",
  "gross_weight_kg": 8420,
  "tare_weight_kg": 3200,
  "declared_weight_kg": 5220,
  "variety": "Deglet Nour",
  "harvest_method": "Manuelle traditionnelle",
  "maturity_stage": "Tamar",
  "harvest_datetime": "2026-10-15",
  "bio_declared": false,
  "arrival_temperature_c": 27.5,
  "departure_time": "05:30",
  "transport_condition": "bache",
  "quick_visual_state": "bon",
  "storage_zone_code": "ZR-01",
  "packaging_type": "CAISSES_20KG",
  "unit_count": 8,
  "unit_type": "PALETTE",
  "unit": "kg",
  "remarks": "Quelques caisses ecrasees",
  "lots": [
    {
      "lot_supplier": "LOT-HAJ-SALAH-01",
      "quantity": 5220,
      "origin_country": "Tunisie",
      "origin_region": "Tozeur",
      "origin_farm": "Oasis Ras El Ain",
      "harvest_date": "2026-10-14",
      "maturity_stage": "SECHE",
      "variety": "Deglet Nour"
    }
  ]
}
```

## Reponse

```json
{
  "data": {
    "reception": {},
    "lots": [],
    "units": [],
    "notifications": [],
    "alerts": []
  }
}
```

## Regles serveur

- fournisseur obligatoire et `active`
- si `purchase_order_id` est renseigne, il doit appartenir au fournisseur
- minimum 2 photos
- `gross_weight_kg > 0`
- `tare_weight_kg >= 0`
- `tare_weight_kg < gross_weight_kg`
- poids net calcule cote serveur uniquement
- si `declared_weight_kg > 0`, calcul de l'ecart et alertes
- `variety`, `harvest_method`, `maturity_stage`, `arrival_temperature_c`, `vehicle_number`, `storage_zone_code` obligatoires
- `bio_declared = true` bloque si aucune certification bio valide
- `lots` obligatoires avec somme des quantites egale au poids net
- `LOT-ID` genere uniquement cote serveur

## Effets metier

1. creation d'une reception `EN_ATTENTE_QC` ou `BLOQUE`
2. creation d'un ou plusieurs `reception_lots`
3. creation des `reception_units`
4. creation des `reception_alerts`
5. creation de `system_notifications`
6. creation des entrees de `system_audit_logs`

## Extensions prevues

- branchement Modbus pour `gross_weight_kg` et `tare_weight_kg`
- impression physique QR/RFID via `LabelService`
- generation d'evenements `weighbridge_events`
- tache SMS/push reelle vers l'equipe qualite
