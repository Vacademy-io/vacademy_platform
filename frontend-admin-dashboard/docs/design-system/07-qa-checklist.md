# 07 — UI QA Checklist (mandatory pre-merge)

Run this before opening/approving any PR that touches UI. The `ui-design-guardian` agent checks the
same list automatically. A PR should not merge with unchecked ❌ items.

## 1. Tokens & color
- [ ] No raw hex in `.tsx`; no `bg-[#…]` / `text-[#…]` arbitrary colors.
- [ ] Colors use tokens (`primary-*`, `danger/warning/success/info-*`, semantic surfaces).
- [ ] Status meaning maps to the right semantic family (not decorative color).
- [ ] Works in dark mode (uses semantic tokens, not hardcoded light/dark).

## 2. Typography
- [ ] Uses type tokens (`text-h1…caption`), no `text-[Npx]`.
- [ ] One `h1` per page; heading levels not skipped for styling.
- [ ] Open Sans only; weights within the app's allowed set.

## 3. Spacing & layout
- [ ] 4px scale only; no `p-[7px]`/`gap-[13px]` arbitrary spacing.
- [ ] Layout via grid/flex + `gap-*`; no margin-hacked gaps.
- [ ] Consistent section rhythm; aligned cards/sections; no random gaps.

## 4. Components
- [ ] Reuses canonical components (no hand-rolled button/input/dropdown/modal/table).
- [ ] No duplicate component introduced.
- [ ] `cn()` used for conditional classes.
- [ ] Icons from `@phosphor-icons/react` only.

## 5. States (all four)
- [ ] **Loading** (skeleton/spinner, no blank flash).
- [ ] **Empty** (clear message + primary action where relevant).
- [ ] **Error** (inline + retry path; not just a toast).
- [ ] **Success/populated** correct.
- [ ] Interactive elements: hover, focus-visible ring, active, disabled.

## 6. Forms
- [ ] react-hook-form + zod; inline `FormMessage` errors.
- [ ] Visible labels (not placeholder-as-label); required marked consistently.
- [ ] Only necessary fields; long/optional fields deferred or removed.
- [ ] Long dropdowns searchable; submit uses `onAsyncClick` (no double submit).
- [ ] Button order: `[secondary Cancel] [primary Save]`, right-aligned.

## 7. Tables
- [ ] `MyTable` + `MyPagination`; server-side sort/pagination for large data.
- [ ] ≤2 inline row actions (rest in `…` overflow); destructive → `AlertDialog`.
- [ ] Number columns right-aligned; loading/empty states present.

## 8. Responsiveness
- [ ] No horizontal overflow at 360px (except intentional table scroll).
- [ ] Verified at mobile / tablet / desktop.
- [ ] Touch targets ≥40px for primary actions.
- [ ] No arbitrary fixed widths breaking small screens.

## 9. Accessibility basics
- [ ] Labels tied to inputs; icon-only buttons have `aria-label`.
- [ ] Keyboard reachable; Esc closes overlays; focus ring visible.
- [ ] Sufficient contrast (token pairs already meet this — don't override).
- [ ] Essential info not conveyed by color/tooltip alone.

## 10. Final
- [ ] `node scripts/design-lint.mjs <changed paths>` is clean.
- [ ] `pnpm lint` / type-check pass on changed files.
- [ ] Screenshots (mobile + desktop) attached to the PR for UI changes.
