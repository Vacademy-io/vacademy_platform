# Vacademy Design System & UI Governance

This is the **single source of truth** for how UI is built across the Vacademy platform
(`frontend-admin-dashboard` and `frontend-learner-dashboard-app`). It exists to stop UI drift:
inconsistent buttons, random colors, font/alignment issues, uneven spacing, ad-hoc dropdowns,
weak forms, cluttered tables, and "developer-built admin panel" feel.

It is **forward-looking**: follow it for all *new* and *changed* UI. Existing screens are not
retro-fixed here — that work is tracked separately in [08-modernization.md](./08-modernization.md).

> These docs are also read by the **`ui-design-guardian`** agent (`.claude/agents/ui-design-guardian.md`),
> which builds and reviews UI against them automatically. See [How enforcement works](#how-enforcement-works).

---

## Golden rules (the TL;DR)

1. **Reuse, don't rebuild.** Use the canonical components in
   `src/components/design-system/*` and `src/components/ui/*`. Never hand-roll a button, input,
   dropdown, modal, or table. → [02-components.md](./02-components.md)
2. **Tokens only, never raw values.** Use theme tokens (`bg-primary-500`, `text-body`,
   `text-danger-600`). Never raw hex (`#3b82f6`), never arbitrary Tailwind (`bg-[#fff]`, `p-[7px]`,
   `text-[13px]`), never inline `style={{ color: '#...' }}`. → [01-foundations.md](./01-foundations.md)
3. **One icon library:** `@phosphor-icons/react`. Do not add `lucide-react`, `react-icons`, or the
   legacy `phosphor-react` v1 to new code. → [06-governance.md](./06-governance.md)
4. **Forms** use `react-hook-form` + `zod` + `Form`/`FormField` + `SelectField`/`MultiSelectField`.
   → [03-forms.md](./03-forms.md)
5. **Tables** use `MyTable` (TanStack v8) + `MyPagination`. → [04-tables-lists.md](./04-tables-lists.md)
6. **Every screen handles 4 states:** loading, empty, error, and success. → [07-qa-checklist.md](./07-qa-checklist.md)
7. **Merge classes with `cn()`** from `src/lib/utils.ts`. Never string-concatenate classNames.
8. **Responsive by default** — mobile, tablet, desktop. → [05-responsive.md](./05-responsive.md)

If you only read one thing, read those eight lines and [06-governance.md](./06-governance.md).

---

## Index

| Doc | What it covers |
|---|---|
| [01-foundations.md](./01-foundations.md) | Color, typography, spacing, radius, shadow, z-index tokens + usage rules |
| [02-components.md](./02-components.md) | Canonical component reuse map + per-component standards |
| [03-forms.md](./03-forms.md) | Form & data-entry UX standards |
| [04-tables-lists.md](./04-tables-lists.md) | Table & list experience standards |
| [05-responsive.md](./05-responsive.md) | Mobile / tablet / desktop rules |
| [06-governance.md](./06-governance.md) | Hard dev rules + frontend architecture conventions |
| [07-qa-checklist.md](./07-qa-checklist.md) | Mandatory pre-merge UI review checklist |
| [08-modernization.md](./08-modernization.md) | Modernization strategy + future-remediation backlog |
| [09-learner-app.md](./09-learner-app.md) | Learner-app-specific token contract (themes, tertiary, play-theme) |

---

## Which app am I in?

Rules are **app-aware**. Most tokens are shared, but the learner app has extras.

| | `frontend-admin-dashboard` | `frontend-learner-dashboard-app` |
|---|---|---|
| Primary scale | `primary-50…600` | `primary-50…500` |
| Secondary / Tertiary | `secondary` (DEFAULT only) | `secondary-50…500`, `tertiary-50…500` |
| Font weights | 400, 500 | 300–700 |
| Radius extras | `sm/md/lg` | + `xl`, `2xl` |
| Breakpoints | Tailwind defaults | + `xs` (350px), `md-tablets` (769px) |
| Themes | none | 9 catalogue themes + `play-theme` (gamified) |

`tertiary-*`, theme classes, and `play-*` tokens are **valid only in the learner app**. Using them
in admin is a violation. See [09-learner-app.md](./09-learner-app.md).

---

## How enforcement works

Three layers keep UI conformant **without anyone remembering to do it**:

1. **`CLAUDE.md`** in each frontend tells every Claude Code session to build in Vacademy format and
   delegate UI work to the `ui-design-guardian` agent. (Automatic for AI-assisted work.)
2. **A `PostToolUse` hook** (`.claude/settings.json`) runs `scripts/design-lint.mjs` after any
   `.tsx`/`.css` edit and surfaces violations immediately. (Automatic, no command typed.)
3. **ESLint + lint-staged** gate **changed files** at commit time so even hand-written code can't
   introduce raw hex / arbitrary values. (Automatic for everyone; legacy files untouched.)

You can also run the checker manually:

```bash
node scripts/design-lint.mjs <path-to-file-or-dir>
```

---

## Maintaining these docs

- When a token or canonical component changes, update [01-foundations.md](./01-foundations.md) /
  [02-components.md](./02-components.md) **and** the inline rules in `.claude/agents/ui-design-guardian.md`
  (its rules are a distilled mirror of these docs).
- Keep examples copy-pasteable and grounded in real file paths.
