# UI and UX audit

Rendered in a real browser (Playwright) on an isolated stack with synthetic data, at 1440 px as a plant director, plus operator and inspector flows. Baselines are in `screenshots/before/`. No factory employee took part, so usability conclusions are the reviewer's, not measured.

## Findings from the baseline

| Area | Finding | Evidence |
|---|---|---|
| Identity | Orange active navigation against green actions, dark green shell, three competing font declarations (Manrope, Inter, Playfair) | `before/home.png`, `src/index.css`, `tailwind.config.ts` |
| Colour | 3,267 hardcoded colour classes in 151 files | Source count |
| Shape | `rounded-xl` 371, `rounded-lg` 365, `rounded-2xl` 124, plus `rounded-[24px]` and `[28px]` | Source count |
| Header | Nine controls; the role pill collided with search | `before/home.png` |
| Navigation | A five-step strip repeated the sidebar; Bureau and Direction hidden behind accordions | `before/receptions.png` |
| Titles | Each page had a header title and a second, different in-page title | "Stock — Entrepôt" and "Gestion du stock" |
| Copy | "Gestion fournisseurs claire et exploitable", "Module 1 — Fournisseurs", "Trust B0 — gates & claims", "Mock recall", missing French accents | `before/suppliers.png`, settings |
| Density | Suppliers: one record per screen, page 2,845 px tall. Receptions: 1,607 px | `before/suppliers.png` |
| Structure | Cards in cards, oversized KPI tiles, gradients and glows | `before/storage.png`, `before/sage-operations.png` |
| Data | Home showed raw UUIDs as lot names | `before/home.png` |
| Workflow | QC inspectors never answered the published checklist | `QCInspectionDialog.tsx` |
| Workflow | Toasts covered the primary action on Réception and blocked the click | Found in the browser run |
| Markup | A `<button>` nested in a `<button>` in the QC queue | Browser console |
| Phone | Greeting card and pill rows took about 130 px above the work | `after/phone-receptions.png`, first pass |

## Classification

| Area | Class | Action |
|---|---|---|
| Design tokens | RESTRUCTURE | One system in `tailwind.config.ts` and `index.css` |
| Sidebar | REDESIGN | Filière thread, no accordions |
| Header | REDESIGN | One title, search and tools |
| Five-step strip (`FlowStepper`) | REMOVE | Replaced by the thread. The component file is no longer used |
| Reception register | REDESIGN | Columns and rows |
| Reception intake | POLISH | Three steps kept; flat stepper and action bar |
| QC queue | REDESIGN | Scan field and work lists |
| QC inspection | POLISH | Checklist added, copy fixed; still one large dialog |
| Suppliers | RESTRUCTURE | Cards to table; detail stays in the side sheet |
| Stock | POLISH | Token and density only; zones are still cards |
| Production, Packaging, Expedition, Purchasing | POLISH | Token, title, copy |
| Analytics, Cockpit | POLISH | Flat surfaces; not restructured |
| Settings | POLISH | Developer wording removed |
| Sign-in | POLISH | Flat, no blur or glow |
| Phone navigation | RESTRUCTURE | Bottom bar only |

## Still weak

- Production has two tab levels, and "Transformation" still holds five sub-modules.
- Stock zones are 23 cards where a table would suit a warehouse lead better.
- Purchasing stacks banners above the work.
- Analytics carries many tiles; it was flattened, not rethought.
- Phone Réception shows one tab at a time in a scrolling row.
- `WorkflowNavigation.tsx` still holds unused tablet carousel logic.
