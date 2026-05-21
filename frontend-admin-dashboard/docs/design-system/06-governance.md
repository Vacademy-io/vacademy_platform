# 06 — Governance & Frontend Architecture

The rules that keep the platform cohesive. These are **enforced** (agent + hook + lint) — see
[README ▸ How enforcement works](./README.md#how-enforcement-works).

## Hard rules — a developer must NOT

1. Create custom buttons/inputs/dropdowns/modals/tables. **Reuse** canonical components
   ([02-components.md](./02-components.md)).
2. Use random/raw colors: no hex in `.tsx`, no `bg-[#...]`, `text-[#...]`.
3. Use inline `style={{…}}` for color/spacing/typography. (Only exception: genuinely dynamic,
   user-generated values — isolate and comment them.)
4. Use arbitrary Tailwind values: `p-[7px]`, `text-[13px]`, `w-[680px]`, `rounded-[10px]`, `z-[9999]`.
5. Introduce inconsistent spacing — use the 4px scale and section rhythm
   ([01-foundations.md](./01-foundations.md)).
6. Build duplicate components (a second Button/Modal/Table). Extend the canonical one.
7. Add another icon library. **`@phosphor-icons/react` only.**
8. String-concatenate classNames — use `cn()` (`@/lib/utils`).

## Every new feature MUST

1. Reuse existing components and tokens.
2. Follow the spacing, typography, and color systems.
3. Match the design language (states, radius, shadow, alignment).
4. Handle **loading / empty / error / success** states.
5. Be responsive (mobile → desktop).
6. Pass the [QA checklist](./07-qa-checklist.md) before merge.

## Icons

- Standard: **`@phosphor-icons/react`** (v2). Size with classes: `<PencilSimple className="size-4" />`.
- Do **not** add `lucide-react`, `react-icons`, or legacy `phosphor-react` (v1) to new code.
  (Some legacy/internal components still import `lucide`/`phosphor-react` — leave those until the
  consolidation in [08-modernization.md](./08-modernization.md); don't copy the pattern.)
- App-specific custom icons live in `src/components/icons/`.

## Class authoring

- Merge with `cn()`; let `prettier-plugin-tailwindcss` order classes (don't fight it).
- Prefer semantic tokens over `neutral-*` for structural surfaces; `neutral-*` is fine for incidental
  greys.
- Keep `className` readable; extract repeated class sets into a component, not a copy-paste.

## Folder structure & where code goes

```
src/
  components/
    design-system/   # canonical branded components (MyButton, MyInput, MyTable, …) — REUSE
    ui/              # shadcn/Radix primitives (button, dialog, form, table, …)
    common/          # widely-shared feature components
    core/ shared/    # building blocks
    icons/           # custom icon components
  routes/            # TanStack file-based routing
    <feature>/
      index.tsx
      -components/    # route-local components (dash-prefixed = not a route)
      -hooks/  -stores/  -services/  -types/  -constants/  -utils/
  lib/  hooks/  services/  stores/  utils/  types/  constants/  schemas/  styles/
```

- **Route-local code** goes in dash-prefixed folders (`-components`, `-hooks`, …) so the router
  ignores it. Shared code graduates to top-level `components/` or `lib/`.
- If two features need the same UI, **promote it** to `components/` — don't duplicate.

## Naming conventions

- Component files & exports: **PascalCase** (`StudentTable.tsx` → `StudentTable`). Some design-system
  primitives use lowercase filenames (`button.tsx` exporting `MyButton`) — match the folder you're in.
- Route folders/slugs: **kebab-case** (`ai-video-editor/`).
- Hooks: `useXxx`. Zustand stores: `useXxxStore`. Types: PascalCase interfaces/types.
- API payload fields follow backend **snake_case** (see `docs/adding-new-slide-type.md`).

## Tooling that backs these rules

- ESLint (`.eslintrc`) with `eslint-plugin-tailwindcss`, Prettier (`.prettierrc`) with tailwind
  class sorting, Husky + lint-staged (`.lintstagedrc.json`) pre-commit.
- `scripts/design-lint.mjs` — deterministic checker for raw hex / arbitrary values / banned icons,
  run by the Claude hook and available manually.
- `ui-design-guardian` agent — builds & reviews UI against these docs.
