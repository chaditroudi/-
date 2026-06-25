# Architecture UX - Application Complete

## Vision

L'application doit fonctionner comme un systeme d'execution usine simple, rapide et rassurant pour tous les employes:

- reception
- qualite
- stock
- production
- export
- supervision

Le principe central est:

- **agir vite**
- **voir ce qui bloque**
- **comprendre quoi faire ensuite**

## Architecture globale

L'app doit etre organisee en 4 couches d'usage:

1. **Accueil**
   - priorites du jour
   - alertes
   - raccourcis metier
   - files d'attente

2. **Executer**
   - reception
   - qualite
   - stock
   - production
   - expedition

3. **Superviser**
   - tableaux de bord
   - KPI
   - blocages
   - historique

4. **Administrer**
   - fournisseurs
   - matieres
   - achats
   - parametres

## Regles UX directrices

- une page = un objectif principal
- les actions critiques doivent etre visibles sans defilement excessif
- les ecrans d'atelier privilegient les cartes, listes actionnables et statuts lisibles
- les tables denses sont reservees aux ecrans d'analyse ou d'administration
- la navigation globale reste courte et stable
- la navigation locale se fait par onglets, filtres et sections internes

## Navigation cible

### Navigation principale

- Accueil
- Receptions
- Production
- Alertes
- Stockage
- Lots
- Produits
- Fournisseurs
- Matieres
- Achats
- Logistique
- Analytics
- SAGE Hub

### Logique de regroupement

- `Essentiel`
  Accueil, Receptions, Production, Alertes
- `Qualite & Stock`
  Stockage, Lots, Produits, Batches
- `Administration`
  Fournisseurs, Matieres, Achats, Logistique, Analytics, SAGE Hub

## Modes d'affichage

### Operateur

- tres peu d'options visibles
- gros boutons
- ecrans centres sur une tache
- messages explicites

### Responsable

- indicateurs
- priorites
- filtres
- acces detail

### Administrateur

- vues completes
- parametres
- historique
- exports

## Grammaire visuelle

- header global contextuel
- hero de module court avec:
  - titre
  - contexte
  - action principale
  - chiffres essentiels
- cartes KPI homogenes
- listes d'action avec statuts a droite
- badges de statut standardises
- surfaces claires et peu bruitees

## Ergonomie

- cibles tactiles minimales 44x44
- boutons principaux 48px hauteur sur tablette
- formulaires en blocs courts
- labels toujours visibles
- feedback direct apres action
- usage fort des statuts visuels: couleur + texte

## Accessibilite

- contraste fort
- focus visible
- navigation clavier
- compatibilite RTL
- formulation simple des erreurs
- icones toujours accompagnees de texte pour les actions critiques

## Scalabilite

Nouveaux modules doivent reutiliser les memes patterns:

- hero de page
- tuiles KPI
- file d'attente
- formulaire wizard
- panneau detail
- alertes
- historique/audit

## Pages prioritaires

1. shell global
2. accueil
3. receptions
4. stock
5. fournisseurs
6. analytics
7. logistique / export
