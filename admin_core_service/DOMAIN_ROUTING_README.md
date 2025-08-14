### Domain Routing (Admin Core Service)

Resolves incoming domain and subdomain to an institute and role so clients can render institute theme, logo, and name before authentication.

#### Table: `institute_domain_routing`
- id (UUID, PK)
- domain (varchar, required)
- subdomain (varchar, required). Wildcard `*` supported
- role (varchar, required). Example: LEARNER, TEACHER, ADMIN
- institute_id (varchar, required)
- created_at, updated_at
- redirect (varchar, optional) – client read to route unauth users to open pages (e.g., catalogue or login)

Migration: `src/main/resources/db/migration/V6__create_institute_domain_routing.sql`

Indexes:
- LOWER(domain)
- (LOWER(domain), subdomain)
- institute_id

#### Matching rules
- Case-insensitive domain match
- subdomain exact match or `*`
- Priority: `*` is treated as highest priority when both an exact subdomain and wildcard exist

If you prefer exact match to win over `*`, adjust the ORDER BY in the repository query.

#### Public Resolve API
Base: `/admin-core-service/public/domain-routing/v1`

- POST `/resolve`
  Body:
  ```json
  { "domain": "example.com", "subdomain": "math" }
  ```
  200 OK:
  ```json
  {
    "instituteId": "uuid",
    "instituteName": "Acme Institute",
    "instituteLogoFileId": "file-123",
    "instituteThemeCode": "DARK_BLUE",
    "role": "LEARNER"
  }
  ```
  404 if no mapping

- GET `/resolve?domain=example.com&subdomain=math`
  Same response/behavior as POST

#### Admin Management API
Base: `/admin-core-service/admin/domain-routing/v1`

- POST `/` – create mapping
  ```json
  { "domain": "example.com", "subdomain": "*", "role": "LEARNER", "instituteId": "uuid", "redirect": "/catalogue" }
  ```
- PUT `/{id}` – update mapping
- GET `/{id}` – get mapping by id
- DELETE `/{id}` – delete mapping
- GET `/by-institute/{instituteId}` – list mappings for an institute

#### Components
- Entity: `features/domain_routing/entity/InstituteDomainRouting.java`
- Repository: `features/domain_routing/repository/InstituteDomainRoutingRepository.java`
- Service (public): `features/domain_routing/service/DomainRoutingService.java`
- Controller (public): `features/domain_routing/controller/DomainRoutingController.java`
- Service (admin): `features/domain_routing/service/DomainRoutingAdminService.java`
- Controller (admin): `features/domain_routing/controller/DomainRoutingAdminController.java`

#### Security
`/admin-core-service/public/domain-routing/v1/**` is permitted (no auth) via `ApplicationSecurityConfig`.
Admin endpoints require authentication.

#### Notes
- Optionally add a unique constraint on `(LOWER(domain), subdomain, role)`
- Optionally constrain `role` to known values


