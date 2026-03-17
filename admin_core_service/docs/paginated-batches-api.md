# Paginated Batches API

## Overview

The Paginated Batches API provides a scalable way to fetch package sessions (batches) for an institute. Instead of loading all batches at once, this API returns data in pages, significantly improving performance for institutes with many packages.

## Endpoints

### 1. Paginated Batches (Main Endpoint)

```
GET /admin-core-service/institute/v1/paginated-batches/{instituteId}
```

#### Query Parameters

| Parameter           | Type    | Required | Default      | Description                                                            |
| ------------------- | ------- | -------- | ------------ | ---------------------------------------------------------------------- |
| `page`              | integer | No       | `0`          | Page number (0-indexed)                                                |
| `size`              | integer | No       | `20`         | Number of items per page (recommended max: 50)                         |
| `sessionId`         | string  | No       | `null`       | Filter by session ID                                                   |
| `levelId`           | string  | No       | `null`       | Filter by level ID                                                     |
| `packageId`         | string  | No       | `null`       | Filter by package/course ID                                            |
| `search`            | string  | No       | `null`       | Search query (matches package name, level name, session name)          |
| `packageSessionIds` | array   | No       | `null`       | Filter by specific batch IDs                                           |
| `sortBy`            | string  | No       | `created_at` | Sort field: `package_name`, `level_name`, `session_name`, `created_at` |
| `sortDirection`     | string  | No       | `DESC`       | Sort direction: `ASC` or `DESC`                                        |
| `statuses`          | array   | No       | `["ACTIVE"]` | Filter by status(es)                                                   |

#### Request Examples

##### Basic Request (First Page)

```bash
curl -X GET "https://api.vacademy.io/admin-core-service/institute/v1/paginated-batches/inst-123"
```

##### With Pagination

```bash
curl -X GET "https://api.vacademy.io/admin-core-service/institute/v1/paginated-batches/inst-123?page=2&size=10"
```

##### With Search (Autocomplete)

```bash
curl -X GET "https://api.vacademy.io/admin-core-service/institute/v1/paginated-batches/inst-123?search=Physics&size=10"
```

##### With Package Filter

```bash
curl -X GET "https://api.vacademy.io/admin-core-service/institute/v1/paginated-batches/inst-123?packageId=pkg-456"
```

##### With Filters

```bash
curl -X GET "https://api.vacademy.io/admin-core-service/institute/v1/paginated-batches/inst-123?sessionId=sess-456&levelId=lvl-789"
```

##### With Sorting

```bash
curl -X GET "https://api.vacademy.io/admin-core-service/institute/v1/paginated-batches/inst-123?sortBy=package_name&sortDirection=ASC"
```

##### With Multiple Statuses

```bash
curl -X GET "https://api.vacademy.io/admin-core-service/institute/v1/paginated-batches/inst-123?statuses=ACTIVE&statuses=HIDDEN"
```

##### With Specific Batch IDs

```bash
curl -X GET "https://api.vacademy.io/admin-core-service/institute/v1/paginated-batches/inst-123?packageSessionIds=ps-1&packageSessionIds=ps-2&packageSessionIds=ps-3"
```

#### Response

```json
{
  "content": [
    {
      "id": "ps-123",
      "level": {
        "id": "lvl-001",
        "level_name": "Class 10"
      },
      "session": {
        "id": "sess-001",
        "session_name": "2024-25"
      },
      "start_time": "2024-04-01T00:00:00.000Z",
      "status": "ACTIVE",
      "package_dto": {
        "id": "pkg-001",
        "package_name": "Physics Foundation"
      },
      "group": {
        "id": "grp-001",
        "group_name": "Batch A"
      },
      "read_time_in_minutes": 45.5,
      "is_org_associated": true
    }
  ],
  "page_number": 0,
  "page_size": 20,
  "total_elements": 150,
  "total_pages": 8,
  "first": true,
  "last": false,
  "has_next": true,
  "has_previous": false
}
```

---

### 2. Batch Lookup by IDs

Fetch specific batches by their IDs for ID resolution (displaying selected filter badges, showing batch names in tables).

```
POST /admin-core-service/institute/v1/batches-by-ids/{instituteId}
```

#### Request Body

```json
{
  "ids": ["ps-123", "ps-456", "ps-789"]
}
```

#### Response

```json
{
  "content": [
    {
      "id": "ps-123",
      "level": { "id": "lvl-001", "level_name": "Class 10" },
      "session": { "id": "sess-001", "session_name": "2024-25" },
      "package_dto": { "id": "pkg-001", "package_name": "Physics Foundation" },
      "read_time_in_minutes": 45.5
    },
    {
      "id": "ps-456",
      "level": { "id": "lvl-002", "level_name": "Class 11" },
      "session": { "id": "sess-001", "session_name": "2024-25" },
      "package_dto": { "id": "pkg-002", "package_name": "Chemistry Basics" },
      "read_time_in_minutes": 30.0
    }
  ]
}
```

#### Usage Example

```typescript
// Resolve batch IDs to display names in filter badges
const response = await fetch(`/api/batches-by-ids/${instituteId}`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ ids: selectedBatchIds }),
});
const data = await response.json();
// data.content contains the full batch details
```

---

### 3. Batches Summary (Aggregates)

Get summary/aggregates for building filter dropdown options efficiently.

```
GET /admin-core-service/institute/v1/batches-summary/{instituteId}
```

#### Query Parameters

| Parameter  | Type  | Required | Default      | Description          |
| ---------- | ----- | -------- | ------------ | -------------------- |
| `statuses` | array | No       | `["ACTIVE"]` | Filter by status(es) |

#### Response

```json
{
  "total_batches": 150,
  "has_org_associated": true,
  "packages": [
    { "id": "pkg-001", "name": "Physics Foundation" },
    { "id": "pkg-002", "name": "Chemistry Basics" }
  ],
  "levels": [
    { "id": "lvl-001", "name": "Class 10" },
    { "id": "lvl-002", "name": "Class 11" }
  ],
  "sessions": [
    { "id": "sess-001", "name": "2024-25" },
    { "id": "sess-002", "name": "2025-26" }
  ]
}
```

#### Usage Example

```typescript
// Build filter dropdowns
const response = await fetch(`/api/batches-summary/${instituteId}`);
const summary = await response.json();

// Populate package dropdown
const packageOptions = summary.packages.map((pkg) => ({
  value: pkg.id,
  label: pkg.name,
}));

// Check if org-associated batches exist
if (summary.has_org_associated) {
  showOrgFilter();
}
```

---

## Response Fields

### Paginated Response

| Field            | Type    | Description                                             |
| ---------------- | ------- | ------------------------------------------------------- |
| `content`        | array   | Array of PackageSessionDTO objects for the current page |
| `page_number`    | integer | Current page number (0-indexed)                         |
| `page_size`      | integer | Number of items per page                                |
| `total_elements` | long    | Total number of items across all pages                  |
| `total_pages`    | integer | Total number of pages                                   |
| `first`          | boolean | Whether this is the first page                          |
| `last`           | boolean | Whether this is the last page                           |
| `has_next`       | boolean | Whether there is a next page                            |
| `has_previous`   | boolean | Whether there is a previous page                        |

### Summary Response

| Field                | Type    | Description                           |
| -------------------- | ------- | ------------------------------------- |
| `total_batches`      | long    | Total number of batches               |
| `has_org_associated` | boolean | Whether any batch has org association |
| `packages`           | array   | List of unique packages (id, name)    |
| `levels`             | array   | List of unique levels (id, name)      |
| `sessions`           | array   | List of unique sessions (id, name)    |

---

## Error Responses

#### 400 Bad Request - Invalid Institute ID

```json
{
  "error": "Invalid Institute Id",
  "status": 400
}
```

---

## Usage Patterns

### Search/Autocomplete

```typescript
// Debounced search for package selector
const debouncedSearch = useDebounce(searchTerm, 300);

useEffect(() => {
  if (debouncedSearch) {
    fetch(
      `/api/paginated-batches/${instituteId}?search=${debouncedSearch}&size=10`,
    )
      .then((res) => res.json())
      .then((data) => setSuggestions(data.content));
  }
}, [debouncedSearch]);
```

### Lazy Loading / Infinite Scroll

```typescript
// Initial load
const firstPage = await fetch(
  `/api/paginated-batches/${instituteId}?page=0&size=20`,
);
const data = await firstPage.json();

// Load more when user scrolls
if (data.has_next) {
  const nextPage = await fetch(
    `/api/paginated-batches/${instituteId}?page=${data.page_number + 1}&size=20`,
  );
}
```

### Traditional Pagination

```typescript
// Navigate to specific page
const page = 5;
const response = await fetch(
  `/api/paginated-batches/${instituteId}?page=${page}&size=20`,
);
const data = await response.json();

console.log(`Showing page ${data.page_number + 1} of ${data.total_pages}`);
```

### Filtering by Package/Session/Level

```typescript
// Get batches for a specific package
const response = await fetch(
  `/api/paginated-batches/${instituteId}?packageId=${packageId}&sessionId=${sessionId}&levelId=${levelId}`,
);
```

### Building Filter Dropdowns

```typescript
// Get summary for filter options
const summary = await fetch(`/api/batches-summary/${instituteId}`).then((r) =>
  r.json(),
);

// Build multi-select filter options
const filterOptions = {
  packages: summary.packages,
  levels: summary.levels,
  sessions: summary.sessions,
};
```

### Resolving Selected Filter IDs

```typescript
// When user selects batches, resolve their names for display
const selectedIds = ["ps-1", "ps-2", "ps-3"];
const response = await fetch(`/api/batches-by-ids/${instituteId}`, {
  method: "POST",
  body: JSON.stringify({ ids: selectedIds }),
});
const { content } = await response.json();

// Display as filter badges
content.forEach((batch) => {
  addFilterBadge(batch.package_dto.package_name, batch.level.level_name);
});
```

---

## Performance Comparison

| Metric                | Old API (All at once) | New Paginated API |
| --------------------- | --------------------- | ----------------- |
| Response Time         | Grows with data       | Constant (~200ms) |
| Payload Size          | Unbounded             | Fixed (20 items)  |
| Memory Usage          | High for large data   | Low, predictable  |
| Read Time Calculation | All sessions          | Only current page |
| Search Support        | ❌ No                 | ✅ Yes            |
| Sorting Support       | ❌ No                 | ✅ Yes            |
| Filtering             | ❌ Limited            | ✅ Full           |

---

## Migration Guide

### Before (Old API)

```javascript
// Fetches ALL batches at once
const response = await fetch(`/institute/v1/details/${instituteId}`);
const data = await response.json();
const batches = data.batches_for_sessions; // Could be 1000+ items
```

### After (New Paginated API)

```javascript
// Fetch page by page
const response = await fetch(
  `/institute/v1/paginated-batches/${instituteId}?page=0`,
);
const data = await response.json();
const batches = data.content; // Only 20 items per page

// Check if more pages exist
if (data.has_next) {
  // Fetch more as needed
}
```

---

## Best Practices

1. **Use appropriate page size**: Default of 20 works well for most UIs. Increase to 50 for data grids.

2. **Use search for autocomplete**: When implementing typeahead, use the `search` parameter with debouncing.

3. **Cache summary data**: The `/batches-summary` endpoint can be cached to build filter dropdowns without repeated calls.

4. **Use filters**: When users select a specific session or level, use filters to reduce the dataset.

5. **Implement debouncing**: When implementing search/filter, debounce API calls (300ms recommended).

6. **Show loading states**: Display loading indicators when fetching next pages.

7. **Use batch lookup for ID resolution**: Instead of storing full batch objects, store IDs and resolve them using `/batches-by-ids`.

---

## Related APIs

| API                                      | Purpose                                                             |
| ---------------------------------------- | ------------------------------------------------------------------- |
| `/institute/v1/details/{id}`             | Full institute details (use `includeBatches=false` for performance) |
| `/institute/v1/details-non-batches/{id}` | Institute details without batches                                   |
| `/institute/v1/setup/{id}`               | Institute setup with all batches (legacy)                           |

---

## Changelog

- **2026-01-22**: Added search, packageId filter, sorting, batches-by-ids endpoint, batches-summary endpoint
- **2026-01-22**: Initial release of paginated batches API
