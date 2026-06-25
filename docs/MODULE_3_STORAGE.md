# Module 3 - Stockage et Gestion des Zones

## Objectif

Module 3 couvre la cartographie Royal Palm, les emplacements physiques, les mouvements de lots et le monitoring des conditions de stockage.

## Exigences fonctionnelles

- Synchroniser le plan Royal Palm complet: ZR-01 a ZR-10, SB-01 a SB-04, CF-A1 a CF-B3, FU-01 a FU-02, ZE-01.
- Creer des emplacements structures au format `[ZONE]-[ALLEE]-[RACK]-[NIVEAU]`, exemple `CF-A1-02-05-3`.
- Suivre la capacite par zone et par emplacement en palettes et en kg.
- Calculer le statut emplacement: libre, occupe, reserve, bloque.
- Afficher la temperature actuelle et l'humidite actuelle depuis la derniere lecture capteur IoT.
- Enregistrer les lectures capteur: temperature, humidite, gaz, capteur, date.
- Classer les conditions en normal, warning, critical selon les plages cibles.
- Enregistrer les mouvements avec ID sequentiel `MVYYYYMMDD-####`, LOT-ID scanne, type, source, destination, palettes, motif, timestamp, operateur et notes.
- Appliquer les types de mouvement: entree zone, sortie zone, transfert, inventaire, ajustement.
- Appliquer les motifs: reception, fumigation, lavage, triage, emballage, picking export, inventaire, autre.
- Bloquer les mouvements vers un emplacement bloque ou au-dela de sa capacite, et suggerer une destination si aucune destination precise n'est donnee.

## Exigences non fonctionnelles

- Les ecritures passent par des endpoints back-end authentifies.
- Les endpoints stockage sont limites aux roles stock, logistique, reception et maintenance.
- Les listes UI sont paginees/limitees cote affichage pour eviter une table trop lourde.
- Les donnees historiques restent append-only pour les lectures capteur et mouvements.
- Le module reste compatible avec les collections existantes `storage_zones`, `alerts` et le shell React/Vite.

## Donnees

Collections principales:

- `storage_zones`: zones Royal Palm, capacite, famille, type physique, cible temperature, capteurs, charge courante, statut condition.
- `storage_locations`: emplacements physiques, zone parente, capacite, occupation, statut, lots presents, derniere lecture.
- `storage_condition_readings`: historique des lectures capteur.
- `storage_location_movements`: journal des mouvements entre emplacements.

## API

`POST /api/storage/module3/seed`

- Synchronise les zones et genere les emplacements manquants.
- Idempotent: les zones existantes sont mises a jour, les emplacements existants sont conserves.

`POST /api/storage/readings`

- Body: `storageZoneId` ou `zoneCode`, optionnel `locationId`, `temperatureC`, `humidityPercent`, `gasPpm`, `sensorRef`.
- Cree une lecture, met a jour la derniere condition de la zone/emplacement, cree une alerte si critique.

`POST /api/storage/move`

- Body: `movementType`, `lotCode`, `quantityPalettes`, `reason`, optionnel `sourceLocationId`, `destinationLocationId`, `destinationZoneId`, `quantityKg`, `notes`.
- Source obligatoire sauf `ENTREE_ZONE`.
- Destination obligatoire sauf `SORTIE_ZONE`; si seul `destinationZoneId` est fourni, le serveur suggere le meilleur emplacement disponible.
- Verifie capacite et statut destination, met a jour l'occupation source/destination, journalise le mouvement.
- `movementDate` et `performedBy` ne sont pas acceptes depuis le client: le timestamp vient du serveur et l'operateur vient du token authentifie.

## Validation

- Les codes emplacement sont valides avec le format `[ZONE]-[ALLEE]-[RACK]-[NIVEAU]`.
- Une lecture rattachee a un emplacement doit appartenir a la zone selectionnee.
- Le LOT-ID est obligatoire pour tout mouvement.
- Le LOT-ID doit correspondre a un lot de stock existant.
- Le motif doit appartenir a la liste Module 3.
- La quantite palettes est obligatoire avec defaut 1 et doit etre superieure a 0.
- Une destination bloquee ou pleine retourne une erreur metier.
- Si la source contient une liste de lots, le LOT-ID scanne doit etre present dans cette source.

## Tests

- `server/src/modules/storage/storage-domain.test.ts` couvre la cartographie, la generation d'emplacements, les seuils de condition et le recalcul de statut.
- `server/src/modules/storage/storage.service.test.ts` couvre les regles d'enregistrement de mouvement: LOT-ID existant, quantite palette, timestamp serveur et operateur authentifie.
- Les tests de build TypeScript couvrent l'integration des routes et hooks.

## Deploiement

- Variables attendues identiques au reste de l'application: `VITE_API_URL`, configuration Mongo/API existante.
- CI recommande: `npm test`, `npm run build`, puis build Docker.
- Rollback: revenir a la version precedente du backend et du frontend; les nouvelles collections sont additives et ne modifient pas les anciens documents critiques.
- Migration progressive: lancer `/api/storage/module3/seed` apres deploiement pour peupler le plan Royal Palm.
