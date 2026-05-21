# 05 — Responsive Design

Every screen must work on **mobile, tablet, desktop**. Build mobile-first, then layer breakpoints.

## Breakpoints

| Token | Min width | Notes |
|---|---|---|
| (base) | 0 | mobile-first default |
| `sm` | 640px | large phones |
| `md` | 768px | tablets |
| `lg` | 1024px | small laptops |
| `xl` | 1280px | desktops |
| `2xl` | 1400px | wide (container max) |

Learner app adds `xs` (350px) and `md-tablets` (769px) — use them only there
([09-learner-app.md](./09-learner-app.md)).

## Rules

- **Mobile-first**: write base styles for mobile, add `sm:`/`md:`/`lg:` to scale up. Don't write
  desktop-first with `max-*` overrides.
- **No fixed pixel widths** that break small screens. Use `w-full`, `max-w-*`, `flex-1`, grid `minmax`.
  No `w-[680px]` on containers.
- **Layout via flex/grid + `gap-*`**, with responsive columns:
  `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`. Don't fake gaps with margins.
- **Tables on mobile**: allow horizontal scroll within a container (`overflow-x-auto`) or switch to a
  card/stacked layout — never let a table break the page width.
- **Dialogs/sheets on mobile**: full-width with safe padding; `Sheet` (bottom/side) is often better
  than a centered modal on small screens.
- **Touch targets**: ≥ 40px (the `medium` button/input sizes satisfy this). Don't ship `small`-only
  controls as the primary tap target on mobile.
- **Typography scaling**: use responsive tokens (`text-h2 sm:text-h1`), not arbitrary sizes.
- **Spacing scaling**: `p-4 sm:p-6`; tighten on mobile, breathe on desktop.

## Common bugs to prevent

- Horizontal overflow (a child wider than the viewport) — wrap wide content, use `min-w-0` on flex
  children that contain truncating text.
- Uneven spacing between breakpoints — use the same `gap-*` token, just change column count.
- Misaligned cards — equal heights via grid; don't pad individual cards to match.
- Sticky headers/sidebars overlapping content — respect the z-index scale
  ([01-foundations.md](./01-foundations.md)).

## Checklist (per screen)

- [ ] Works at 360px wide with no horizontal scroll (except intentional table scroll).
- [ ] Works at 768px (tablet) and ≥1280px (desktop).
- [ ] Primary actions reachable and ≥40px on touch.
- [ ] No arbitrary fixed widths; layout uses grid/flex + `gap-*`.
- [ ] Tables scroll or restack; dialogs fit mobile.
