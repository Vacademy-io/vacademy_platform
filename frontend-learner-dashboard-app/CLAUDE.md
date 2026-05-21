# CLAUDE.md — frontend-learner-dashboard-app

Guidance for Claude Code when working in this app (React + TypeScript + Tailwind + TanStack Router).

## UI work MUST follow the Vacademy Design System

Whenever you build, modify, or review **any** UI here (components, screens, forms, tables, dialogs,
styling), conform to the Vacademy design system. The canonical docs live in the admin app at
[`frontend-admin-dashboard/docs/design-system/`](../frontend-admin-dashboard/docs/design-system/README.md);
**learner-specific rules are in `09-learner-app.md`**.

### Build it right the first time (primary rule)

When a developer asks to build/create/add UI, **generate conforming code from the start**: first
consult the design-system docs (tokens, component reuse map, learner extras in `09-learner-app.md`),
then write UI that already uses design tokens + canonical components. Do **not** write
throwaway/non-conforming UI and fix it later — the checker, edit hook, and commit gate are only a
safety net, not the workflow. Correct on the first pass.

**Delegate UI build/review to the `ui-design-guardian` agent** (`.claude/agents/ui-design-guardian.md`),
which is app-aware and applies the learner token contract automatically.

### Non-negotiables
- **Reuse canonical components** — never hand-roll a button/input/dropdown/modal/table. Use this app's
  `@/components/design-system/*` and `@/components/ui/*` equivalents.
- **Tokens only** — no raw hex, no arbitrary Tailwind values, no inline `style` for color/spacing/type.
- **Learner extras are allowed here (and only here):** `secondary-*`, `tertiary-*`, catalogue themes
  (`data-catalogue-*`), `play-*` tokens (Play/gamified screens only), `rounded-xl`/`2xl`, breakpoints
  `xs`/`md-tablets`, font weights 300–700. See `09-learner-app.md`. Note: primary scale is `50…500`.
- **Icons:** `@phosphor-icons/react` only.
- **Forms:** react-hook-form + zod + `Form`/`FormField`. **Tables:** `MyTable` + `MyPagination`.
- **Every screen:** loading + empty + error + success states; responsive mobile→desktop.
- **Merge classes with `cn()`**.
- **Scope:** forward-looking — don't refactor unrelated existing UI.

### Self-check
Before finishing UI changes, run:
```bash
node ../scripts/design-lint.mjs <changed files>
```
Fix every reported error. (A PostToolUse hook also runs this automatically after `.tsx`/`.css` edits.)
