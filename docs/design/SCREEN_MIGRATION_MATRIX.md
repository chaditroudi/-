## 2026-11-01 continuation evidence (supersedes historical counts, not unseen-screen verdicts)

Branch: codex/phase-1-completion; reconciliation HEAD d617d587eb0ffebde4d3bfa66bafcc11c9ac78ad. Current UI corrections remain uncommitted pending final acceptance. Dev preflight: 458/458 structural checks, 105 captures at 1440/768/390, under .local/evidence/visual-preflight-08. Opened representative screens: home desktop, alerts phone, live desktop/phone, reception QC desktop/phone, stock desktop/phone, production tablet. Capture-only rows do not become PASS. Frozen reception now passes 17/17 after correction of phone-toast obstruction R; both failed and successful evidence are retained. Role preflight 1687/1687 and isolation 23/23 pass on their recorded snapshots. Factory trial, staging, production and industrial-quantity-dependent workflows remain unaccepted. See the current Phase 1 report for precise gates and next actions.

---

# Route migration matrix

Evidence words: **Seen** means the screenshot was opened and read. **Sweep** means the automated pass found no overflow, blank page or console error, and nobody looked at it. **Not seen** means neither.

Sweep covers 19 tabs at 1440, 1280, 768 and 390 as the factory director. It says nothing about how a screen looks.

The Test column names browser scenarios from `scripts/e2e/reception.e2e.mjs`. "None" means no browser test drives that screen.

Status words are defined in `VISUAL_ACCEPTANCE.md`. A screen is PASS only if it was restructured or deliberately kept, seen on a desk and a tablet or phone, and driven through its main action.

| Route | Module | Main component | Decision | Required improvement | Changes implemented | Desktop | Tablet / phone | Interaction | Accessibility | Test | Final status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Shell, every route | Shell | `Index`, `AppSidebar`, `TopHeader` | RESTRUCTURE | One title, grouped navigation, sticky working | Rebuilt; `main` no longer blocks sticky; one `main` landmark | Seen | Seen | Driven | Contrast and names checked | All | PASS |
| `/auth` | Access | `Auth` | RESTRUCTURE | Flat sign-in | Rebuilt | Seen | Sweep not run | Driven by H | Not measured | H | NOT VERIFIED |
| `?tab=home` | Accueil | `HomePage` | POLISH | Keep the work list first | Lot chips and identity only | Seen | Sweep | Not driven | Contrast passed | None | NOT VERIFIED |
| `?tab=scan` | Scanner | `ScanStation` | POLISH | Correct column, named buttons | Lot fournisseur heading, close button named | Seen | Sweep | Not driven | Buttons named; not re-measured | None | NOT VERIFIED |
| `?tab=alerts`, `/alerts` | Alertes | `AlertsCenter` | MERGE | Two screens disagreed | One centre; stock view is a tab; shared figure line | Seen | Sweep | Tabs driven | Contrast passed | None | NOT VERIFIED |
| `?tab=live` | En direct | `FactoryCommandCenter` | POLISH | Words, not ledger codes | Labels and contrast corrected | Seen before the contrast fix | Sweep | Not driven | Contrast not re-measured | None | NOT VERIFIED |
| `?tab=receptions` register | Réception | `ReceptionDashboardV2` | RESTRUCTURE | Dense register | Grid rows, actions on tab row | Seen | Seen on phone | Driven | Passed | A, B, J, K, R | PASS |
| `?tab=receptions` intake | Réception | `ReceptionIntakeFlow` | RESTRUCTURE | Three steps, sticky actions, nothing over them | Sticky bar works; toasts and offline panel moved | Seen steps 1 and 3 | Seen on phone and tablet | Driven | Labels bound | A to F, H, L, R | PASS |
| `?tab=receptions` QC queue | Qualité | `ReceptionQcQueue` | RESTRUCTURE | Scan first, then work lists | Rows rebuilt; numbers no longer break | Seen | Seen on phone | Driven | Passed | G, S, V, P, Q | PASS |
| `?tab=receptions` QC form | Qualité | `QCInspectionDialog` | RESTRUCTURE | No verdict before measurements | Provisional score holds back classification and decision | Seen | Not seen | Driven | Not measured | P, Q | NOT VERIFIED |
| `?tab=storage` overview | Stock | `StorageZonesOverview` | RESTRUCTURE | Blocked never reads as available | Available and blocked separate; blocked counts per stage | Seen | Seen | Driven | Passed | V | PASS |
| `?tab=storage` lots | Stock | `StorageZonesOverview` | RESTRUCTURE | Filters, paging, trace, safe assign | Blocked lots read Isoler and only offer quarantine zones | Seen | Sweep | Driven as far as the dialog; assignment not submitted | Passed | None | NOT VERIFIED |
| `?tab=storage` zones | Stock | `StorageZonesOverview` | REDESIGN | 11,285 px of cards | List and one open zone: 1,951 px | Seen | Seen | Driven | Passed | None | PASS |
| `?tab=storage` mouvements, conditions | Stock | `StorageZonesOverview` | POLISH | Say why an action is disabled | Reason shown under the button | Not seen after the change | Sweep | Not driven | Scan button named | None | NOT VERIFIED |
| `?tab=storage` gestion | Stock | `StorageZonesOverview` | POLISH | Readable state, named buttons | Yes or no replaces coloured dots | Not seen | Sweep | Not driven | Buttons named | None | NOT VERIFIED |
| `?tab=production` à faire, ordres | Production | `ProductionToday`, `ProductionOrdersList` | REDESIGN | Open on the work | Rail plus sections | Seen | Seen on phone | Driven as far as opening an order | Passed | None | NOT VERIFIED |
| `?tab=production` order detail | Production | `ProductionOrderDetail` | REDESIGN | Lots and steps first | Rebuilt; start block stated; missing data stated | Seen with a draft order | Not seen | Opened only | Not measured | None | NOT VERIFIED |
| `?tab=production` stages | Production | `FumigationPanel`, `NettoyagePanel`, `HydratationPanel`, `TriagePanel` | RESTRUCTURE | Figure line above the work list | Tiles replaced | Seen empty only | Sweep | Creation dialog opened on fumigation only | Print button named | None | NOT VERIFIED |
| `?tab=production` lignes | Production | `ProductionLinesPanel` | REDESIGN | Eight 400 px cards | One list; a line opens in place | Seen | Sweep | Row opened | Passed | None | NOT VERIFIED |
| `?tab=production` bilan | Production | `MaterialBalancePanel` | POLISH | Readable percentages | Figures in text colour | Seen before the fix | Sweep | Read only | Not re-measured | None | NOT VERIFIED |
| `?tab=production` HACCP | Production | `HaccpDashboard` | RESTRUCTURE | Green ticks claimed unchecked programmes | Ticks removed; programmes in a table | Seen | Sweep | Update dialog opened | Passed | None | NOT VERIFIED |
| `?tab=production` indicateurs | Production | `ProductionKpiPanel` | KEEP | None chosen yet | Not touched | Seen | Sweep | Not driven | Passed | None | NOT VERIFIED |
| `?tab=packaging` | Conditionnement | `PackagingDashboard` | POLISH | Shared figure line | Tiles replaced, notice reworded | Seen before the change | Sweep | Not driven | Passed | None | NOT VERIFIED |
| `?tab=logistics` | Expédition | `LogisticsDashboard`, `TransportWorkspace` | POLISH | Figure line, French text | Tiles replaced, accents restored | Seen before the change | Sweep | Not driven | One unnamed field fixed by default | None | NOT VERIFIED |
| `?tab=suppliers` | Fournisseurs | `SuppliersList` | RESTRUCTURE | Real table | Rebuilt | Seen | Sweep | Not driven | Passed | None | NOT VERIFIED |
| `?tab=purchasing` | Achats | `PurchasingDashboard` | POLISH | Figure line, real total | Tiles replaced, `0.0k` removed | Seen | Seen | Not driven | Passed | None | NOT VERIFIED |
| `?tab=quality` | Qualité | `CAPAPanel`, `AuditTrailPanel` | POLISH | Figure line | Tiles replaced | Seen before the change | Sweep | Not driven | Passed | None | NOT VERIFIED |
| `?tab=export` | Export | `ExportDashboard` | KEEP | None chosen yet | Identity only | Seen | Sweep | Not driven | Fixed by default | None | NOT VERIFIED |
| `?tab=customers` | Clients | `CustomersDashboard` | KEEP | None chosen yet | Identity only | Seen empty only | Sweep | Not driven | Fixed by default | None | NOT VERIFIED |
| `?tab=hr` | RH | `HRDashboard` | POLISH | Figure line | Tiles replaced | Seen before the change | Sweep | Not driven | Passed | None | NOT VERIFIED |
| `?tab=maintenance` | Maintenance | `MaintenanceDashboard` | POLISH | Figure line | Tiles replaced | Seen before the change | Sweep | Not driven | Passed | None | NOT VERIFIED |
| `?tab=analytics` | Indicateurs | `AnalyticsDashboard`, `FounderAnalyticsDashboard` | RESTRUCTURE | No verdict on an idle plant | Score explained, figure line | Seen first tab only | Sweep | Other eight tabs not opened | Passed | None | NOT VERIFIED |
| `?tab=sage-operations` | Cockpit | `SageOperationsHub`, `MarginCockpitPanel`, `GoldenThreadPanel` | POLISH | No saving shown without production | Cost and variance held back | Seen before the change | Sweep | Not driven | Refresh button named | None | NOT VERIFIED |
| `?tab=settings` | Paramètres | `SettingsDashboard` | POLISH | Open on real settings, French diagnostics | Opens on Infos usine; Produit moved last | Seen before the change | Sweep | 12 tabs not opened | Seven fields unnamed on last measure, not re-measured | None | NOT VERIFIED |
| `/portail` | Fournisseurs | `SupplierPortal` | KEEP | Portal needs a supplier account to view | Identity only | Seen, no-account state only | Seen at 390 | Not driven | Not measured | None | BLOCKED: no supplier account in the seed |
| `/passport/:lotId` | Traçabilité | `PassportPage` | POLISH | A public page must not show codes or jargon | Status codes and wording replaced | Seen before the wording change | Seen before the wording change | Read only | Not measured | None | NOT VERIFIED |
| `/dashboard` | Accueil | Redirects to the home tab | KEEP | None | None | Redirect confirmed | Redirect confirmed | Not applicable | Not applicable | None | PASS |
| `*` | 404 | `NotFound` | KEEP | None | Identity only | Seen | Sweep | Link not clicked | One heading | None | NOT VERIFIED |
| Dark theme | All | Tokens | Not decided | Check or remove | None | Not seen | Not seen | Not driven | Not measured | None | NOT VERIFIED |
