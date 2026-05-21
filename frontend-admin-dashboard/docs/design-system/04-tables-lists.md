# 04 — Table & List Experience

Tables are where "cluttered, hard to read, too many actions" complaints concentrate. Standardize on
**`MyTable`** (`@/components/design-system/table`, TanStack Table v8) + **`MyPagination`**.

## Use `MyTable`

```tsx
import { MyTable } from '@/components/design-system/table';
import { MyPagination } from '@/components/design-system/pagination';

<MyTable<StudentRow>
  data={tableData}            // { content, total_pages, page_no, page_size, total_elements, last }
  columns={columns}          // ColumnDef<StudentRow>[]
  isLoading={isLoading}
  currentPage={page}
  onSort={(columnId, dir) => refetch(...)}   // server-side sort
  rowSelection={selection}
  onRowSelectionChange={setSelection}
/>
<MyPagination currentPage={page} totalPages={data.total_pages} onPageChange={setPage} />
```

`MyTable` already supports column resize, pin, visibility, row selection, sorting and compact mode.
**Don't** hand-roll `<table>` markup for data grids.

## Structure & readability

- **Columns**: show only what users scan for. Push detail into a row click / side panel
  (`Sheet`) — don't cram everything into columns.
- **Alignment**: text left; numbers/currency right; status/actions can be center/right. Be consistent
  across the table.
- **Row height / spacing**: use the component defaults (and compact mode where dense). Don't override
  with arbitrary padding.
- **Header**: concise labels, `text-caption`/`text-body` weight 500. Sortable headers indicate state.
- **Truncation**: long text truncates with tooltip, doesn't wrap unpredictably.

## Actions

- **Max ~2 inline actions** per row (e.g. Edit, plus a `…` overflow `DropdownMenu` for the rest).
  Rows with 5 inline icon buttons are banned.
- Destructive row actions → confirm via `AlertDialog`.
- **Bulk actions**: when `rowSelection` is active, show a single action bar (count + actions) above
  the table; don't scatter bulk controls.

## Filters, search, sort, pagination

- **Search**: one clear search input above the table; debounce; show "no results" empty state.
- **Filters**: use `Chips`/`FilterChips` or `MyDropdown`; reflect active filters visibly; provide
  "clear all".
- **Sort**: server-side via `onSort`. Indicate the sorted column + direction.
- **Pagination**: always `MyPagination`. Don't load thousands of rows unpaginated.

## Required states

| State | Treatment |
|---|---|
| Loading | `isLoading` → skeleton rows (don't show an empty table flash) |
| Empty | friendly empty state: what it is + primary action ("No students yet" + "Add student") |
| Error | inline error + retry |
| Populated | consistent rows, aligned columns, ≤2 inline actions |

## Anti-patterns

- ❌ Custom `<table>` with hardcoded widths and inline styles.
- ❌ Every column left-aligned including numbers.
- ❌ 5+ action icons per row.
- ❌ No empty/loading state (blank flicker).
- ❌ Client-side sorting/pagination on large server datasets.
