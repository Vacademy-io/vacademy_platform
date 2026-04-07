# Short Link System

## Overview

The Short Link system is a URL shortening service built into `media_service`. It creates compact, shareable URLs that redirect to any destination URL. Each short link is optionally tied to a source entity (e.g., a package session, a course, a page) for deduplication and lifecycle management.

**Example:**
```
https://u.vacademy.io/s/K7MNPQ3A  →  https://readonrent.in/collections/169f282f-88d4?packageSessionId=2ee245f2...
```

## Architecture

```
                                  ┌────────────────────────┐
  Frontend / Other Service        │     media_service      │
         │                        │                        │
         │  POST /media-service/  │  ┌──────────────────┐  │
         │  public/v1/short-link/ │  │ ShortLinkService  │  │
         │  get-or-create         │  │                   │  │
         ├───────────────────────►│  │  getOrCreate()    │  │
         │                        │  │  create()         │  │
         │  Returns:              │  │  update()         │  │
         │  { absoluteUrl,        │  │  delete()         │  │
         │    shortName }         │  └────────┬──────────┘  │
         │                        │           │             │
         │                        │  ┌────────▼──────────┐  │
         │                        │  │  short_links      │  │
         │                        │  │  (PostgreSQL)     │  │
         │                        │  └───────────────────┘  │
         │                        │                         │
         │                        │  ┌───────────────────┐  │
  User clicks short URL          │  │ PublicShortLink    │  │
  GET /s/{code}  ────────────────►│  │ Controller         │  │
         │                        │  │ (302 redirect)    │  │
         │◄───── redirect ────────│  └───────────────────┘  │
                                  └─────────────────────────┘
```

## Database

### `short_links` table

| Column            | Type         | Description                                      |
|-------------------|--------------|--------------------------------------------------|
| `id`              | VARCHAR(255) | Primary key (UUID)                               |
| `short_name`      | VARCHAR(255) | The short code, unique. e.g. `K7MNPQ3A`         |
| `destination_url` | TEXT         | Full URL to redirect to                          |
| `status`          | VARCHAR(50)  | `ACTIVE` or `DELETED`                            |
| `source`          | VARCHAR(255) | Entity type this link belongs to (nullable)      |
| `source_id`       | VARCHAR(255) | Entity ID within that source (nullable)          |
| `last_queried_at` | TIMESTAMP    | Last time this link was accessed (click tracking)|
| `created_at`      | TIMESTAMP    | Auto-set on creation                             |
| `updated_at`      | TIMESTAMP    | Auto-set on update                               |

**Indexes:** `short_name` (unique), `destination_url`

### `backend_base_url` table (custom domains)

| Column         | Type         | Description                                    |
|----------------|--------------|------------------------------------------------|
| `id`           | VARCHAR(255) | Primary key (UUID)                             |
| `institute_id` | VARCHAR(255) | Institute this domain belongs to (unique)      |
| `base_url`     | VARCHAR(500) | Custom domain, e.g. `readonrent.in`            |
| `created_at`   | TIMESTAMP    | Auto-set                                       |
| `updated_at`   | TIMESTAMP    | Auto-set                                       |

When an institute has a row here, short links for that institute use `https://u.{base_url}/s/{code}` instead of the default `https://u.vacademy.io/s/{code}`.

## API Endpoints

### Public (no auth required)

#### Redirect
```
GET /s/{shortCode}
```
Performs a 302 redirect to the destination URL. Updates `last_queried_at`.

**Errors:** 404 if code not found, 400 if link is not ACTIVE.

#### Get Link Info
```
GET /s/{shortCode}/info
```
Returns the destination URL as JSON without redirecting.

**Response:**
```json
{
  "shortCode": "K7MNPQ3A",
  "destinationUrl": "https://readonrent.in/collections/..."
}
```

#### Get or Create (via gateway)
```
POST /media-service/public/v1/short-link/get-or-create
Content-Type: application/json

{
  "source": "PACKAGE_SESSION",
  "sourceId": "2ee245f2-4df9-4de3-bed8-9315d69447ff",
  "destinationUrl": "https://readonrent.in/collections/169f282f...",
  "instituteId": "c70f40a5-e4d3-4b6c-a498-e612d0d4b133",
  "shortCode": null
}
```

**Behavior:**
- If a short link with the given `source` + `sourceId` already exists, returns it (idempotent).
- If not, generates a new short code and creates the link.
- `shortCode` field is optional. When using the slug strategy, it serves as a hint (e.g., book title). Ignored by the random strategies.

**Response:**
```json
{
  "shortName": "K7MNPQ3A",
  "absoluteUrl": "https://u.vacademy.io/s/K7MNPQ3A"
}
```

### Internal (HMAC auth, service-to-service)

All under `/media-service/internal/v1/short-link`.

#### Create
```
POST /media-service/internal/v1/short-link/create
Body: { shortCode, destinationUrl, source, sourceId, instituteId }
```
Creates a short link with an explicitly provided `shortCode`. Throws if the code already exists.

#### Update Destination
```
PUT /media-service/internal/v1/short-link/update?source=X&sourceId=Y&newDestinationUrl=Z
```
Updates the destination URL for an existing link identified by `source` + `sourceId`.

#### Delete (soft)
```
DELETE /media-service/internal/v1/short-link/delete?source=X&sourceId=Y
```
Sets status to `DELETED`. The short code is not reused.

#### Get Base URL
```
GET /media-service/internal/v1/short-link/base-url?instituteId=X
```
Returns the resolved base URL (e.g., `https://u.readonrent.in`) as plain text.

## Short Code Generation

Short codes are generated by `ShortCodeGenerator`, which has a single entry point and multiple pluggable strategies.

### Switching strategy

Edit `ShortCodeGenerator.generateShortCode()` and change the method call:

```java
public static String generateShortCode(String hint) {
    return randomBase32(DEFAULT_LENGTH);   // ← current
    // return bookNameSlug(hint);          // human-readable
    // return randomBase62(DEFAULT_LENGTH); // more compact
}
```

### Available strategies

| Strategy       | Example        | Charset                    | Combinations (8 chars) | Notes                                        |
|----------------|----------------|----------------------------|------------------------|----------------------------------------------|
| `randomBase32` | `K7MNPQ3A`     | A-Z, 2-7                  | 32^8 = ~1.1 trillion   | Default. No ambiguous chars (0/O, 1/I/l).    |
| `randomBase62` | `xK9mPq2f`     | a-z, A-Z, 0-9             | 62^8 = ~218 trillion   | Case-sensitive. More compact.                |
| `bookNameSlug` | `compiler-design` | a-z, 0-9, hyphens       | N/A                    | Human-readable. Max 50 chars. Needs collision handling. |

### Collision handling

`getOrCreateShortLink` retries up to 5 times if a generated code already exists. If all 5 collide (near-impossible with random strategies), it falls back to a UUID-based code.

## Custom Domains

Each institute can have a branded short link domain stored in the `backend_base_url` table.

**Domain resolution logic:**
1. If `instituteId` is provided and has a row in `backend_base_url`:
   - If `base_url` starts with `http` → use as-is (e.g., `https://u.mysite.com`)
   - Otherwise → prepend `https://u.` (e.g., `readonrent.in` → `https://u.readonrent.in`)
2. If no custom domain → use default `https://u.vacademy.io`

**DNS requirement:** The subdomain `u.{domain}` must have a DNS record pointing to the media_service deployment for redirects to work.

## Source / Source ID Convention

The `source` and `sourceId` fields together form a composite key that ties a short link to a specific entity in the system. This enables:
- **Deduplication** — `getOrCreate` checks by `source` + `sourceId` before creating
- **Lifecycle management** — update or delete links by source entity
- **Lookup** — find a link without knowing its short code

| Use Case           | source              | sourceId                  |
|--------------------|---------------------|---------------------------|
| Book (ReadOnRent)  | `PACKAGE_SESSION`   | Package session UUID      |
| Course page        | `COURSE`            | Course/package UUID       |
| Assessment         | `ASSESSMENT`        | Assessment UUID           |
| Custom / ad-hoc    | Any string          | Any string                |

These are conventions, not enforced enums. Any `source`/`sourceId` pair works.

## Capabilities

- Shorten any URL with a unique code
- Idempotent get-or-create by source entity (safe to call repeatedly)
- Per-institute custom branded domains
- Soft delete (links can be deactivated without losing the record)
- Click tracking via `last_queried_at` timestamp
- Pluggable short code strategies (swap with one line change)
- Public and internal API access (separate controllers, separate auth)

## Limitations

- **No analytics beyond last access** — only `last_queried_at` is tracked. No click counts, referrer, geo, or device info.
- **No expiry** — short links are permanent until manually deleted. There is no TTL or auto-expiry mechanism.
- **One link per source entity** — `findBySourceAndSourceId` returns a single `Optional`. A source entity cannot have multiple short links.
- **No bulk operations** — create, update, and delete are single-entity operations. No batch API.
- **No QR code generation** — the system generates URLs only. QR code rendering is a frontend/client concern.
- **Redirect domain requires DNS setup** — custom domains need `u.{domain}` DNS configured and pointed to media_service.
- **No link preview / OG tags** — the redirect is a plain 302. No intermediate page with Open Graph metadata for rich previews on social media.

## Configuration

| Property                  | Default                  | Description                         |
|---------------------------|--------------------------|-------------------------------------|
| `short.link.base.url`    | `https://u.vacademy.io`  | Default short link base URL         |

Override via environment variable or `application.properties`.

## File Reference

| File | Purpose |
|------|---------|
| `entity/ShortLink.java` | JPA entity for `short_links` table |
| `entity/InstituteShortLinkDomain.java` | JPA entity for `backend_base_url` table |
| `repository/ShortLinkRepository.java` | Data access — `findByShortName`, `findBySourceAndSourceId` |
| `repository/InstituteShortLinkDomainRepository.java` | Data access — `findByInstituteId` |
| `service/ShortLinkService.java` | Core business logic — create, getOrCreate, update, delete, redirect |
| `service/ShortCodeGenerator.java` | Pluggable short code generation strategies |
| `controller/PublicShortLinkController.java` | Redirect + info endpoints at `/s/` (short-link domain) |
| `controller/PublicShortLinkGatewayController.java` | Get-or-create at `/media-service/public/` (via nginx gateway) |
| `controller/InternalShortLinkController.java` | CRUD at `/media-service/internal/` (service-to-service) |
| `dto/CreateShortLinkRequest.java` | Request body DTO |
| `db/migration/V2__url_shortener_schema.sql` | `short_links` table migration |
| `db/migration/V3__institute_short_link_domains.sql` | `backend_base_url` table migration |
