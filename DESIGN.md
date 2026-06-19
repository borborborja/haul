# Haul — Design Tokens

Single source of truth for the Haul visual language. Both clients consume these:
`web/src/ui/theme.ts` (CSS/React) and `android/app/src/main/java/com/bor_devs/shoplist/ui/theme/*` (Compose).

## Typography
- **Display / headings:** Bricolage Grotesque (700–800), tight tracking (-0.02em).
- **Body / UI:** DM Sans (400–700).
- **Labels / codes / counters:** DM Mono (400–500), uppercase, +0.1em tracking.

## Brand
- Accent (primary): `#10B981`
- On-accent ink (dark text on accent): `#06231A`
- On-accent light (white text on accent button, desktop): `#FFFFFF`
- Amber (auto-clean): `#F5B700`
- Danger: `#EF4444`

## Themes — **Light + Dark only**
| Token     | Light       | Dark              |
|-----------|-------------|-------------------|
| bg        | `#FBFCFA`   | `#0A1512`         |
| surface   | `#FFFFFF`   | `#13261F`         |
| surface2  | `#F4F5F1`   | `#0E1D17`         |
| text      | `#0E1B16`   | `#EAF2EC`         |
| muted     | `#9AA8A0`   | `#7E938A`         |
| line      | `rgba(0,0,0,.07)` | `rgba(255,255,255,.07)` |
| seg       | `#EFF1ED`   | `#13261F`         |
| sidebar   | `#F6F7F3`   | `#0E1D17`         |

AMOLED, Auto and Android Material-You dynamic color are intentionally removed.

## Category accents (keyed by store/catalog category key)
`fruit #EF4444 · veg #22C55E · meat #B45309 · dairy #60A5FA · pantry #FB923C ·`
`cleaning #A78BFA · home #64748B · snacks #FB7185 · frozen #06B6D4 ·`
`processed #F43F5E · drinks #6366F1 · spices #F59E0B · other #94A3B8`

## Shapes
- Cards / buttons: radius 11–18 (px on web, dp on Android).
- Sheets / heroes: radius 22–30.
- Pills / toggles / checkboxes: fully rounded.
- Light: soft shadows. Dark: hairline borders (`line`).
- Item rows/cards: 5px (4dp) left category-color bar.

## Layout
- **Mobile:** single-column phone shell — header (list name → switcher, sync dot, settings) · Plan/Shop segmented toggle · add bar · catalog chips · view selector (list/compact/grid) · grouped list / shop progress ring.
- **Desktop (web ≥ 900px):** sidebar (logo, lists, theme toggle, account) + main (topbar with add bar + Plan/Shop) → Plan kanban board by category / Shop progress rail + item grid.
