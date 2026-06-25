# Royal Palm - Checklist operateur reception et tracabilite

## Objectif

Ce document sert de guide terrain pour un operateur reception.

Il explique, dans l'ordre:

- comment creer une reception
- comment creer et peser un lot
- comment imprimer l'etiquette QR
- comment lancer le controle qualite
- comment orienter le lot vers le stock ou la quarantaine
- comment generer les documents
- comment retrouver la tracabilite du lot

## Format 1 - Checklist ultra simple

1. Aller dans `Receptions`
2. Cliquer `Nouvelle Reception`
3. Saisir fournisseur, camion, chauffeur, BL et informations d'arrivee
4. Enregistrer la reception
5. Ouvrir la reception creee
6. Aller dans l'onglet `Lots`
7. Verifier le lot cree
8. Cliquer `Peser le lot`
9. Verifier le poids net
10. Cliquer `Etiquette GS1`
11. Imprimer le QR code du lot
12. Si besoin, scanner le lot dans `Scan & Tracabilite`
13. Aller dans `Qualite` et lancer ou reprendre le controle QC
14. Si le lot est conforme, aller dans `Entrepot`
15. Affecter le lot a la zone de stockage
16. Si le lot n'est pas conforme, cliquer `Mettre en quarantaine`
17. Aller dans `Documents`
18. Generer `Bon de Reception Achat`
19. Generer `Bon d'Expedition Fournisseur` si necessaire
20. Pour suivre le lot plus tard, aller dans `Scan & Tracabilite`
21. Consulter `Historique complet` pour voir les evenements
22. Si le lot continue en production, suivre le flux dans `Production`
23. Si besoin d'impact client, consulter la section expedition dans la fiche lot

## Format 2 - SOP courte atelier

### Etape 1 - Demarrer la reception

- Ouvrir `Receptions`
- Cliquer `Nouvelle Reception`
- Renseigner les informations du camion, du chauffeur, du fournisseur et du bon de livraison
- Valider la creation

Resultat attendu:

- une reception est creee
- un numero de reception est genere
- un lot d'entree est rattache a la reception

### Etape 2 - Peser et identifier le lot

- Ouvrir la reception
- Aller dans `Lots`
- Cliquer `Peser le lot`
- Verifier le poids net
- Cliquer `Etiquette GS1`
- Imprimer l'etiquette QR du lot

Resultat attendu:

- le lot dispose d'une pesee nette
- le QR code du lot est disponible et imprimable

### Etape 3 - Controler la conformite

- Aller dans `Qualite`
- Lancer ou reprendre le controle QC
- Saisir les resultats et la decision

Decision metier:

- lot conforme: continuer vers `Entrepot`
- lot douteux ou non conforme: `Mettre en quarantaine`

### Etape 4 - Stocker ou bloquer

- Si le lot est accepte, aller dans `Entrepot`
- Affecter le lot a une zone de stockage
- Si le lot doit etre bloque, utiliser `Mettre en quarantaine`

Resultat attendu:

- le lot est soit stocke, soit bloque avec statut visible

### Etape 5 - Generer les documents

- Aller dans `Documents`
- Generer `Bon de Reception Achat`
- Generer `Bon d'Expedition Fournisseur` si le document fournisseur est requis

Resultat attendu:

- les documents sont sauvegardes et imprimables

### Etape 6 - Retrouver la tracabilite

- Aller dans `Scan & Tracabilite`
- Scanner ou rechercher le lot
- Ouvrir la fiche lot
- Consulter `Historique complet`

Resultat attendu:

- l'operateur retrouve la fiche lot temps reel
- les evenements de tracabilite sont visibles
- les liens production, stock et expedition sont consultables

## Format 3 - Action -> ecran -> bouton

| Action metier | Ecran | Bouton / onglet |
|---|---|---|
| Creer une reception | `Receptions` | `Nouvelle Reception` |
| Ouvrir une reception | `Receptions` | cliquer sur la ligne reception |
| Voir la fiche reception | fiche reception | `Fiche` |
| Voir la timeline reception | fiche reception | `Processus` |
| Voir les lots de la reception | fiche reception | `Lots` |
| Peser un lot | onglet `Lots` | `Peser le lot` |
| Voir une pesee | onglet `Lots` | `Voir pesee` |
| Imprimer le QR code lot | onglet `Lots` | `Etiquette GS1` |
| Reimprimer le QR code lot | onglet `Lots` | `Re-imprimer GS1` |
| Lancer le QC | onglet `Qualite` | `Lancer QC` |
| Reprendre le QC | onglet `Qualite` | `Reprendre QC` |
| Mettre un lot en quarantaine | onglet `Lots` | `Mettre en quarantaine` |
| Liberer un lot reception | onglet `Lots` | `Liberer` |
| Deplacer le lot en stockage | fiche reception | `Entrepot` |
| Ouvrir le bon reception achat | onglet `Documents` | `Bon de Reception Achat` |
| Ouvrir le bon expedition fournisseur | onglet `Documents` | `Bon d'Expedition Fournisseur` |
| Voir les audits de reception | fiche reception | `Audit` |
| Scanner un lot | `Scan & Tracabilite` | scan camera ou recherche lot |
| Ouvrir la fiche lot temps reel | `Scan & Tracabilite` | ouvrir le lot trouve |
| Voir les evenements traceabilite | fiche lot | `Historique complet` |
| Identifier les expeditions / clients lies | fiche lot | section `Stock fini et expedition client` |

## Rappel important

- `Reception` = entree usine
- `Lot d'entree` = lot cree a la reception
- `Lot de stock` = lot exploitable en magasin
- `Etiquette GS1` = etiquette QR du lot dans l'UI actuelle
- `Scan & Tracabilite` = point d'entree principal pour retrouver la fiche lot temps reel

## Emplacement du document

Fichier source:

- `docs/reception-operator-checklist.md`
