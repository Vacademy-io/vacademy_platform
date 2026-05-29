# 09 — Learner App Token Contract

`frontend-learner-dashboard-app` shares the same **base** system as admin (same Open Sans, same
`primary`/`danger`/`warning`/`success`/`info` semantics, same `react-hook-form`/`MyTable` patterns,
same governance rules) **plus** the extras below. These extras are valid **only** in the learner app.

> The `ui-design-guardian` agent is app-aware: it allows the tokens below in
> `frontend-learner-dashboard-app/**` and flags them as violations in `frontend-admin-dashboard/**`.

## Learner-only tokens

**Color**
- `primary-50…500` (no `600` — don't use `primary-600` in learner).
- `secondary-50…500` and `tertiary-50…500` (tertiary is a neutral support scale; admin has neither
  as full scales).
- Extra text/surface tokens: `--text-primary/secondary/muted`, `--surface`, `--surface-muted`.

**Typography**
- Font weights **300–700** available (admin only 400/500). Headings use 600 (`h1`/`h2` weight 600,
  `h3` weight 500) per the learner config. Still no arbitrary font sizes — use the `h1…caption` tokens.

**Radius**
- Adds `rounded-xl` and `rounded-2xl` on top of `sm/md/lg`.

**Breakpoints**
- Adds `xs` (350px) and `md-tablets` (769px) in addition to the Tailwind defaults. Use them for
  fine-grained mobile/tablet handling. Don't use them in admin.

**Spacing / z-index (catalogue system)** — `src/styles/catalogue-tokens.css`
- `--space-0 … --space-24` scale, sizing tokens, a documented **z-index scale**
  (`--catalogue-z-dropdown:10 … --catalogue-z-tooltip:70`), and transition tokens
  (`--catalogue-transition-fast/base/slow`). Prefer these within catalogue/course-card surfaces.

## Themes (learner only)

**Catalogue themes** — `src/styles/catalogue-themes.css`, applied via `data-catalogue-theme`:
`default, ocean, forest, sunset, midnight, rose, violet, amber, slate`. Each overrides the primary
scale + foreground. Also `data-catalogue-radius` = `sharp | rounded | pill`.

- Build catalogue UI against the **primary tokens** so it themes automatically. Don't hardcode a
  theme's color — let the active theme drive it.

**Play theme (gamified)** — `src/styles/play-theme.css`: `--play-gold/fire/green/purple/blue/pink/dark`,
`--play-radius-card/btn/badge`, and animations (`wiggle`, `bounce-in`, `xp-pop`, …).

- Use `play-*` tokens **only** inside the gamified ("Play") experience. Don't leak them into standard
  learner screens, and never into admin.

## What's intentional vs. drift

| Difference | Status |
|---|---|
| `tertiary`, catalogue themes, play-theme | **Intentional** — learner product needs them |
| Extra breakpoints (`xs`, `md-tablets`) | **Intentional** |
| Primary `600` missing in learner | Minor drift — converge later |
| Font-weight range (300–700 vs 400/500) | Minor drift — acceptable, learner needs lighter/bolder |
| Radius offset differences (`md = --radius` vs `--radius − 2px`) | Drift — converge later |
| Hardcoded pastel palette (`#afd9e8`, …) | **Debt** — promote to tokens ([08-modernization.md](./08-modernization.md)) |

Convergence work is tracked in [08-modernization.md](./08-modernization.md) (P4). Until then: in the
learner app, use the extras above freely; everywhere, the [governance rules](./06-governance.md)
(no raw hex, no arbitrary values, reuse components, one icon library) still apply.
