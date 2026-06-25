# Royal Palm Phase 1 - Workflow Frontend React Reception

## Ecran

Le wizard React de reception doit suivre 4 etapes operateur.

## Etape 1 - Origine et controle rapide

Champs saisis:

- fournisseur
- bon de livraison
- plaque vehicule
- chauffeur
- photos
- poids annonce
- temperature arrivee
- heure depart
- condition transport
- etat visuel
- bio declare
- variete
- stade de maturation
- methode de recolte

Comportement:

- affichage des informations fournisseur
- calcul des signaux Phase 1 en temps reel
- avertissement si certification bio invalide
- blocage visuel si moins de 2 photos

## Etape 2 - Pesage

Champs saisis/calculees:

- type de contenant
- nombre d'unites
- poids brut
- tare unitaire
- tare totale
- poids net

Comportement:

- validation du poids brut
- calcul automatique tare et net
- alerte si net incoherent

## Etape 3 - Lots

Champs:

- un ou plusieurs sous-lots
- reference fournisseur
- quantite
- origine
- date de recolte

Comportement:

- la somme des lots doit egaler le poids net
- pre-remplissage sur la variete choisie a l'etape 1

## Etape 4 - Validation

Actions:

- affichage recapitulatif complet
- saisie d'observations
- appel de `POST /api/receptions/intake`

## Sequence technique

1. le frontend recupere la session connectee
2. il prepare un payload unique d'intake
3. il appelle `/api/receptions/intake`
4. il recoit `reception`, `lots`, `units`, `alerts`
5. il affiche la confirmation avec `reception_number` et le `LOT-ID`
6. il invalide les queries React Query existantes

## Etats UX recommandes

- `idle`: formulaire editable
- `submitting`: boutons desactives + spinner
- `success`: resume reception + code lot + impression
- `error`: message backend explicite

## Points d'attention

- ne jamais generer le `LOT-ID` cote frontend
- ne jamais calculer la validation finale uniquement cote UI
- garder un seul appel de validation final pour eviter les receptions partielles
