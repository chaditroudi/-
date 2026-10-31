# Screen migration matrix

"System" means the screen uses the tokens, primitives and shell. "Rebuilt" means its layout or workflow was changed by hand. Screens marked "System" were reviewed only if listed in `VISUAL_ACCEPTANCE.md`.

| Screen | Tab | System | Rebuilt | Left to do |
|---|---|---|---|---|
| Application shell | all | Yes | Yes | |
| Sign-in | `/auth` | Yes | Yes | Language control styling |
| Accueil | `home` | Yes | Partly | Lot chips fixed; layout unchanged |
| Scanner | `scan` | Yes | No | Rows use larger actions than needed |
| Alertes | `alerts` | Yes | Title only | |
| En direct | `live` | Yes | No | |
| Réception register | `receptions` | Yes | Yes | |
| Reception intake | `receptions` | Yes | Partly | Steps 2 and 3 not visually reviewed after the change |
| Contrôle QC queue | `receptions` | Yes | Yes | |
| QC inspection dialog | `receptions` | Yes | Partly | Section tabs still use the old pill style |
| Lot release dialog | `receptions` | Yes | Partly | |
| Reception detail | `receptions` | Yes | No | |
| Bons BRA | `receptions` | Yes | No | |
| Stock | `storage` | Yes | Density only | Zones as a table |
| Production | `production` | Yes | Title only | Tab depth |
| Conditionnement | `packaging` | Yes | No | |
| Expédition | `logistics` | Yes | Title and copy | |
| Fournisseurs | `suppliers` | Yes | Yes | |
| Supplier detail sheet and form | `suppliers` | Yes | No | |
| Achats | `purchasing` | Yes | Title only | Banner stack |
| Qualité | `quality` | Yes | Title only | |
| Export | `export` | Yes | No | |
| Clients | `customers` | Yes | No | |
| Maintenance | `maintenance` | Yes | Title only | |
| Ressources humaines | `hr` | Yes | No | |
| Indicateurs | `analytics` | Yes | Flat surfaces | Structure |
| Cockpit usine | `sage-operations` | Yes | Title only | |
| Paramètres | `settings` | Yes | Wording | |
| Articles | `materials` | Not reached | No | The director role has no access, so it was not rendered |
| Supplier portal | `/portal` | Yes | No | Not rendered |
| Lot passport | `/passport` | Yes | No | Not rendered |
