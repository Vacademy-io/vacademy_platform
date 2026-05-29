# 08 — Modernization Strategy & Remediation Backlog

This doc is **forward strategy** + the **backlog of existing debt** to fix later. The design system
(docs 01–07) governs *new* work; this is how we make the *whole* product feel cohesive over time.

## Product UX direction

Move from "a collection of developer-built screens" to "a cohesive, professional, productized
platform." Principles:

1. **Reduce clutter.** Fewer actions per screen; one primary action; push secondary actions into
   overflow menus / detail panels. Remove unused fields and dead entry points.
2. **Clear hierarchy.** Consistent page header → section → content rhythm. Use the type scale and
   spacing system so importance is obvious.
3. **Guided flows.** Multi-step where forms are long; sensible defaults; progressive disclosure of
   advanced options.
4. **Consistent surfaces.** Same card/dialog/table treatment everywhere; one elevation step per
   surface; aligned grids.
5. **Premium polish.** Smooth, consistent transitions; empty states with helpful next steps; no
   layout shift / flicker (loading skeletons).
6. **Productized, not operational.** Plain language, helpful empty/error copy, no exposed internal
   jargon or debug-looking UI.

## How to modernize without a big-bang rewrite

- **Strangler approach**: every new/changed screen conforms (enforced now). The product converges as
  surfaces are touched.
- **Hotspot passes**: schedule focused cleanups of the highest-traffic screens (dashboards, student
  lists, course details) using the QA checklist.
- **Component-led**: improving a canonical component (e.g. `MyTable` density) upgrades every consumer
  at once — prefer this over per-screen tweaks.

## Remediation backlog (prioritized)

> Not in scope for the current change; tracked here so it isn't lost.

**P1 — guardrails & worst offenders**
- [ ] Turn `eslint-plugin-tailwindcss` rules to `error` on changed files (done if Deliverable 3-B
      accepted) and monitor.
- [ ] Burn down the ~1000 (admin) / ~309 (learner) arbitrary Tailwind values, starting with shared
      components and high-traffic routes.
- [ ] Replace inline `style={{…#hex}}` in the ~20 design-editor files where not genuinely dynamic.

**P2 — consolidation**
- [ ] Remove duplicate components: `ModernButton` → `MyButton`, `ModernInput` → `MyInput`; converge
      learner's simpler table onto `MyTable`.
- [ ] Single icon library: migrate `lucide-react` / `phosphor-react` v1 / `react-icons` usages to
      `@phosphor-icons/react`; remove the dead deps.

**P3 — token system completeness**
- [ ] Add an explicit **shadow scale** token set (currently Tailwind defaults).
- [ ] Promote learner's hardcoded **pastel palette** (`#afd9e8`, `#b6e2b6`, …) to CSS variables.
- [ ] Add a shared **spacing** and **z-index** token layer to admin (learner already has catalogue
      scales).

**P4 — cross-app convergence**
- [ ] Align admin↔learner token drift (primary shades, radius variants, font weights) into a shared
      token contract; decide which learner-only tokens (tertiary, themes, play-theme) stay
      app-specific. See [09-learner-app.md](./09-learner-app.md).
- [ ] Extract the design system into a shared package consumed by both apps (longer-term).

**P5 — living documentation**
- [ ] Storybook stories for every canonical component, linked from [02-components.md](./02-components.md).
- [ ] Optional `/design-review` slash command wrapping the agent for one-keystroke diff review.

## Definition of "modernized" for a screen

A screen is "done" when it passes [07-qa-checklist.md](./07-qa-checklist.md) end-to-end: tokens only,
canonical components, all four states, responsive, accessible, and clutter removed.
