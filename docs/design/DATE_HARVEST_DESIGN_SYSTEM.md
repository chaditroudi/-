# Date Harvest design system

Source of truth: `tailwind.config.ts` and `src/index.css`. Use the tokens; do not add colours, radii or shadows in components.

## Direction

The product comes from its material. The shell is the skin of a ripe date, the page is the salt flat of Chott el Djerid near Tozeur, and the one light in the interface comes from Deglet Nour, "date of light". Everything else stays flat and quiet, so a status is the loudest thing on screen.

Rejected first idea: a dark green shell with a green accent. That is what the app already had and what most industrial SaaS looks like.

## Colour

| Name | Hex | Use |
|---|---|---|
| Datte noire | `#2B1810` | Shell |
| Sel | `#EEF1F1` | Page background |
| Encre | `#1F1B18` | Text |
| Palme | `#0E5A4B` | Primary action |
| Deglet | `#C98A1B` | The Filière thread only |
| Blanc | `#FFFFFF` | Surfaces |

| Semantic | Hex | Rule |
|---|---|---|
| Success | `#1B7A4B` | Always with a word |
| Warning | `#8F5D09` | Always with a word |
| Danger | `#B3261E` | Always with a word |
| Information | `#1F6287` | Always with a word |
| Disabled | `#9A9F9A` | Never for information |
| Focus | `#A76E0C` | 2px ring, 2px offset |

Status is never colour alone: every status has its label.

`tailwind.config.ts` maps Tailwind's names onto five scales (`palme`, `deglet`, `danger`, `djerid`, `pierre`). `bg-emerald-50` resolves to Palme and `text-amber-700` to Deglet, so all 3,267 existing colour classes use the system and no module can add a hue of its own. Violet and purple fold into Djerid; dark mode tokens exist but were not reviewed in this pass.

## Type

Barlow comes from road and plate signage: legible at a distance and generous with accented French. Barlow Semi Condensed saves width in headings and table heads.

| Role | Style |
|---|---|
| Page title | Semi Condensed 600, 18 px, in the header |
| Section title | Semi Condensed 600, 18 px |
| Table head | Semi Condensed 600, 13 px |
| Body | Barlow 400, 14 to 16 px, line height 1.45 |
| Label | Barlow 500, 12 to 14 px, sentence case |
| Codes (`font-mono`) | Semi Condensed 600, tabular, slashed zero |

All figures are tabular. No uppercase labels or tracked eyebrows. Fonts load from Google Fonts, so an offline workstation falls back to the system font.

## Shape and depth

Radius: 3 px controls, 4 px panels, 6 px large surfaces. `rounded-full` only for avatars, dots and counts. No resting shadows: `shadow-sm` is empty. Overlays keep `shadow-lg`. No gradients, glows or blur.

## Layout

```
+----------+--------------------------------------+
| Datte    | Page title        Search    tools    |  48 px, 56 px on touch
| 232 px   +--------------------------------------+
| Aujourd. | tabs                       actions   |
| Filière  | filters                              |
|  | thread| table or work list                   |
| Bureau   |                                      |
| Direction|                                      |
+----------+--------------------------------------+
```

- One title per screen, in the header. Page bodies start with their work.
- Lists are tables or `divide-y` rows, not cards.
- Sidebar collapses to icons, and starts collapsed under 1024 px. Phones use the bottom bar.
- Breakpoints: 390 phone, 768 tablet, 1024 sidebar, 1280 laptop.

## Signature

The Filière thread: a thin line through the five stages of a lot's path in the sidebar, lit in Deglet from Réception down to the stage on screen. It replaces the old five-step strip. Nothing else uses Deglet as decoration.

## Components

| Pattern | Rule |
|---|---|
| Button | 40 px, 44 px on touch. One primary action per view |
| Input | 40 px, 44 px on touch, white on Sel |
| Table | Muted head row, 8 px cell padding, right-aligned numbers with units |
| Tabs | Underline, never a pill |
| Badge | Tinted, square, always text |
| Toast | Bottom right, so it cannot cover the primary actions |
| Dialog | Only for focused tasks; the QC inspection and PIN signature |
| Reception row | `ReceptionRow` and `ReceptionListHead` in `ReceptionDashboardV2.tsx` |
| QC checklist | `QcChecklistAnswers`; answers are never prefilled |

## Summary line

Figures for a screen sit in one `SummaryStrip` above its work list: a joined band of label, value and an optional line under it. It replaces rows of separate tiles, so a figure reads as context for the work and never competes with it.

## Notifications

Toasts appear bottom left beside the sidebar on a desk, because every primary action is on the right, and at the top on a phone, where actions sit at the bottom. Only what happened after the screen opened may pop up. The rest stays in the bell.

## Interaction

- Primary action last and on the right.
- Validation names what is missing, and entries are kept on failure.
- Motion only answers an action. Page changes fade for 140 ms, and pulsing dots are removed.
- `:focus-visible` shows the Deglet ring everywhere.
