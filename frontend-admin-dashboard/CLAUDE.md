# CLAUDE.md — frontend-admin-dashboard

Guidance for Claude Code when working in this app (React + TypeScript + Tailwind + TanStack Router).

## UI work MUST follow the Vacademy Design System

Whenever you build, modify, or review **any** UI here (components, screens, forms, tables, dialogs,
styling), conform to the design system in [`docs/design-system/`](./docs/design-system/README.md).

### Build it right the first time (primary rule)

When a developer asks to build/create/add UI, **generate conforming code from the start**:

1. **First**, consult the relevant design-system doc (tokens, the component reuse map, forms/tables
   patterns) — before writing any JSX.
2. **Then** write UI that already uses design tokens + canonical components. Use the exact tokens and
   `MyButton`/`MyInput`/`MyTable`/etc. from the reuse map.

Do **not** write throwaway/non-conforming UI and fix it afterward. The checker, edit hook, and commit
gate are only a safety net for the rare miss — not the workflow. The default is: correct on the first pass.

**Delegate UI build/review to the `ui-design-guardian` agent** (`.claude/agents/ui-design-guardian.md`)
for substantial UI work; for small inline edits, apply its rules directly.

### Non-negotiables (full detail in docs/design-system/)
- **Reuse canonical components** — never hand-roll a button/input/dropdown/modal/table. Use
  `MyButton`, `MyInput`, `MyDropdown`, `SelectField`, `MyTable`, `MyDialog`, `StatusChip`, etc. from
  `@/components/design-system/*` and primitives from `@/components/ui/*`. (`02-components.md`)
- **Tokens only** — no raw hex, no arbitrary Tailwind values (`bg-[#fff]`, `text-[13px]`, `p-[7px]`),
  no inline `style` for color/spacing/type. Use `primary-*`, `danger/warning/success/info-*`,
  semantic surfaces, `text-h1…caption`, the 4px spacing scale, `rounded-sm/md/lg`. (`01-foundations.md`)
- **Icons:** `@phosphor-icons/react` only.
- **Forms:** react-hook-form + zod + `Form`/`FormField` + `MyInput`/`SelectField`. (`03-forms.md`)
- **Tables:** `MyTable` + `MyPagination`. (`04-tables-lists.md`)
- **Every screen:** loading + empty + error + success states; responsive mobile→desktop. (`05`,`07`)
- **Merge classes with `cn()`** (`@/lib/utils`).
- **Scope:** forward-looking — don't refactor unrelated existing UI.

### Self-check
Before finishing UI changes, run:
```bash
node ../scripts/design-lint.mjs <changed files>
```
Fix every reported error. (A PostToolUse hook also runs this automatically after `.tsx`/`.css` edits.)

## Other conventions
- API payload fields use **snake_case** (see `docs/adding-new-slide-type.md`).
- Route-local code goes in dash-prefixed folders (`-components/`, `-hooks/`, …).
- Components PascalCase; routes kebab-case; hooks `useXxx`; stores `useXxxStore`.
