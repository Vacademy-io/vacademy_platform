# 02 — Component Standards

**Rule #1: reuse, don't rebuild.** Before writing any UI primitive, use the canonical component.
If something is missing, extend the canonical component — don't fork a new one.

Paths below are relative to `frontend-admin-dashboard/src` (the learner app mirrors most of these
under its own `src`).

---

## Canonical component reuse map

| Need | Use | Import path |
|---|---|---|
| Button | `MyButton` | `@/components/design-system/button` |
| Text input | `MyInput` | `@/components/design-system/input` |
| Dropdown (menu/value) | `MyDropdown` | `@/components/design-system/dropdown` |
| Select (in a form) | `SelectField` | `@/components/design-system/select-field` |
| Multi-select (form) | `MultiSelectField` | `@/components/design-system/multi-select-field` |
| Multi-select (standalone) | `MultiSelect` | `@/components/design-system/multi-select` |
| Searchable select | `SearchableSelect` | `@/components/design-system/searchable-select` |
| Data table | `MyTable` | `@/components/design-system/table` |
| Pagination | `MyPagination` | `@/components/design-system/pagination` |
| Dialog / modal | `MyDialog` | `@/components/design-system/dialog` |
| Confirm dialog | `AlertDialog` | `@/components/ui/alert-dialog` |
| Side drawer | `Sheet` | `@/components/ui/sheet` |
| Status badge | `StatusChip` | `@/components/design-system/status-chips` |
| Filter / input chips | `Chips`, `ChipsWrapper` | `@/components/design-system/chips` |
| Card | `Card` + subcomponents | `@/components/ui/card` |
| Tabs | `Tabs` … | `@/components/ui/tabs` |
| Sidebar | `Sidebar` … | `@/components/ui/sidebar` |
| Toast | `toast` / `Toaster` (Sonner) | `@/components/ui/sonner` |
| Tooltip | `Tooltip` … | `@/components/ui/tooltip` |
| Alert (inline) | `Alert` … | `@/components/ui/alert` |
| Form plumbing | `Form`, `FormField`, … | `@/components/ui/form` |
| Checkbox / Radio / Switch | `Checkbox` / `RadioGroup` / `Switch` | `@/components/ui/*` |
| Skeleton loader | `Skeleton` | `@/components/ui/skeleton` |
| Class merge | `cn()` | `@/lib/utils` |

**Deprecated — do not use in new code:** `ModernButton` → use `MyButton`; `ModernInput` → use
`MyInput`. Don't import the raw shadcn `@/components/ui/button` directly for app buttons — use
`MyButton` (it wraps it with the brand variants + async double-submit handling).

---

## Buttons — `MyButton`

```tsx
import { MyButton } from '@/components/design-system/button';

<MyButton buttonType="primary" scale="large" onClick={...}>Save</MyButton>
<MyButton buttonType="secondary" scale="medium">Cancel</MyButton>
<MyButton buttonType="text" scale="small">Skip</MyButton>

// Async with built-in spinner + double-submit prevention:
<MyButton buttonType="primary" onAsyncClick={async () => { await save(); }} loadingText="Saving…">
  Save
</MyButton>

// Icon-only:
<MyButton layoutVariant="icon" scale="medium" aria-label="Edit"><PencilSimple /></MyButton>
```

| Prop | Values | Notes |
|---|---|---|
| `buttonType` | `primary` \| `secondary` \| `text` | default `primary` |
| `scale` | `large` \| `medium` \| `small` | default `medium` (h-10 / h-9 / h-6) |
| `layoutVariant` | `default` \| `icon` \| `floating` \| `extendedFloating` | default `default` |
| `onAsyncClick` | `async (e) => void` | shows spinner, blocks double submit |
| `loadingText` | string | shown during async |
| `disable` | boolean | also respects native `disabled` |

States are built-in: hover (`primary-400`), active, disabled (`primary-300`). **Don't** restyle with
custom bg/text classes. One **primary** button per view; everything else secondary/text.

---

## Inputs — `MyInput`

```tsx
import { MyInput } from '@/components/design-system/input';

<MyInput label="Email" inputType="email" size="medium" required
         value={email} onChange={setEmail} error={errors.email} />
```

Sizes `large|medium|small`; built-in label, required marker, error display (with icon), and password
toggle when `inputType="password"`. In forms, wrap with `FormField` (see [03-forms.md](./03-forms.md)).
Don't use a bare `<input>`.

---

## Dropdowns & selects

- **`MyDropdown`** — menu or value selector; accepts `string[]` or rich
  `{ label, value, icon?, subItems? }[]`. Use for action menus and simple value pickers.
- **`SelectField`** — react-hook-form single select; renders label + `FormMessage`.
- **`MultiSelectField`** — react-hook-form multi select; shows selections as removable badges.
- **`SearchableSelect`** — combobox with search for long option lists (**use when >~8 options**).

Rules: long lists must be searchable; show a clear placeholder; never leave a dropdown with no empty
state. Don't build a custom dropdown with raw Radix unless extending these.

---

## Tables — `MyTable`

TanStack Table v8 with column resize/pin/visibility, row selection, server-side sort. See
[04-tables-lists.md](./04-tables-lists.md) for full standards.

```tsx
import { MyTable } from '@/components/design-system/table';
<MyTable<RowType> data={tableData} columns={columns} isLoading={isLoading}
         currentPage={page} onSort={handleSort}
         rowSelection={selection} onRowSelectionChange={setSelection} />
```

---

## Dialogs / modals — `MyDialog`

```tsx
import { MyDialog } from '@/components/design-system/dialog';
<MyDialog heading="Edit profile" open={open} onOpenChange={setOpen}
          footer={<MyButton onAsyncClick={save}>Save</MyButton>}>
  {/* body */}
</MyDialog>
```

Centered, sticky header/footer, max-height 85vh, `dialogWidth` defaults `max-w-2xl`. Use
`AlertDialog` for destructive confirmations, `Sheet` for side panels. Don't build modal markup by hand.

---

## Status & feedback

| Component | Use |
|---|---|
| `StatusChip` | record status: `SUCCESS` / `DANGER` / `WARNING` / `INFO` (+ icon). |
| `Badge` (`@/components/ui/badge`) | counts, labels — variants `default/secondary/destructive/outline`. |
| `Chips` / `ChipsWrapper` | filter chips, selectable tags, input tokens. |
| `Alert` | inline contextual messages (page/section level). |
| `toast` (Sonner) | transient feedback (save success, errors). Top-center. |
| `Tooltip` | hint on hover/focus; never put essential info only in a tooltip. |

---

## Per-component spec checklist

Every interactive component you build/extend must define all of these (the canonical components
already do — preserve them):

- **Sizes** (use the component's size prop; don't override height/padding by hand)
- **States**: default, hover, active/pressed, focus (visible ring), disabled, error/invalid, loading
- **Colors**: tokens only ([01-foundations.md](./01-foundations.md))
- **Padding / radius**: from the component; no arbitrary values
- **Empty state** (dropdowns, tables, lists): a clear "nothing here yet" message
- **Keyboard/focus**: focus-visible ring; reachable via Tab; Esc closes overlays

---

## Cards, tabs, sidebar, navigation

- **Cards**: `Card`/`CardHeader`/`CardTitle`/`CardContent`/`CardFooter`. Consistent `p-4`–`p-6`,
  `rounded-lg`, single shadow step. Align card grids with `grid gap-4`.
- **Tabs**: `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent`. Don't fake tabs with buttons.
- **Sidebar/nav**: use the `Sidebar` system (`SidebarProvider`, `useSidebar`). Don't build a parallel
  nav. Keep entry points minimal — see [08-modernization.md](./08-modernization.md) on reducing clutter.
