# Royal Palm - Logique lot vs lot de stock

## Definition simple

Dans la logique usine Royal Palm, il faut distinguer deux objets differents:

### 1. Lot d'entree / lot de reception

C'est le lot cree au portail et a la reception.

Il sert a:

- tracer l'arrivage fournisseur
- porter le `LOT-ID` interne Royal Palm
- memoriser l'origine, la recolte, le poids, la maturite et le statut QC
- lier les palettes / caisses / unites logistiques d'entree

Cycle typique:

- arrivee camion
- pesee brut / tare / net
- creation reception
- creation du ou des lots d'entree
- etiquetage
- orientation QC / quarantaine / stockage brut

Table principale:

- `reception_lots`

### 2. Lot de stock

C'est le lot exploitable dans le magasin, en production ou en expedition.

Il sert a:

- suivre la quantite restante en stock
- suivre l'emplacement magasin
- appliquer FIFO / FEFO
- gerer consommation, transfert, expedition, inventaire

Cycle typique:

- lot d'entree libere ou transforme
- creation / alimentation du lot de stock
- mouvements de stock
- consommation production ou expedition

Table principale:

- `stock_lots`

## Regle UX a respecter

Dans l'interface:

- `reception_lots` doit etre affiche comme **lot d'entree**
- `stock_lots` doit etre affiche comme **lot de stock**
- `reception_units` doit etre affiche comme **unites logistiques**

## Regle metier Royal Palm

Un employe doit comprendre visuellement:

- **Reception** = ce qui entre dans l'usine
- **Stock** = ce qui est deja exploitable ou localise dans les zones de stockage

Donc:

- le `LOT-ID` Royal Palm appartient d'abord au lot d'entree
- le lot de stock represente ensuite son etat magasin / production / expedition
- les deux peuvent etre lies, mais ils ne doivent pas etre confondus dans l'UI
