# Custom Fields — End‑to‑End System Documentation

> Scope: complete walkthrough of how custom fields are modeled, persisted, exposed, and consumed across the Vacademy platform — from the `admin_core_service` database tables, through the admin dashboard configuration UI, into every feature flow that uses them (Invite, Audience, Live Class, Assessment), and finally how the learner dashboard renders and submits them.

---

## Table of Contents

1. [Conceptual Overview](#1-conceptual-overview)
2. [Backend — Database Schema](#2-backend--database-schema)
3. [Backend — JPA Entities](#3-backend--jpa-entities)
4. [Backend — Repositories](#4-backend--repositories)
5. [Backend — Services & Managers](#5-backend--services--managers)
6. [Backend — REST Controllers](#6-backend--rest-controllers)
7. [Backend — Default Field Initialization on Institute Creation](#7-backend--default-field-initialization-on-institute-creation)
8. [Backend — Field Key Generation Strategy](#8-backend--field-key-generation-strategy)
9. [Backend — Visibility & Settings Model](#9-backend--visibility--settings-model)
10. [Frontend Admin — Settings Page (Custom Fields)](#10-frontend-admin--settings-page-custom-fields)
11. [Frontend Admin — Invite Flow](#11-frontend-admin--invite-flow)
12. [Frontend Admin — Audience / Campaign Flow](#12-frontend-admin--audience--campaign-flow)
13. [Frontend Admin — Live Class Flow](#13-frontend-admin--live-class-flow)
14. [Frontend Admin — Assessment Flow](#14-frontend-admin--assessment-flow)
15. [Frontend Admin — Shared Utilities, Caching & Types](#15-frontend-admin--shared-utilities-caching--types)
16. [Frontend Learner — Fetching, Rendering & Submitting](#16-frontend-learner--fetching-rendering--submitting)
17. [Reference: API Endpoints](#17-reference-api-endpoints)
18. [Reference: End‑to‑End Lifecycle Example](#18-reference-end-to-end-lifecycle-example)

---

## 1. Conceptual Overview

Custom fields are dynamic, institute‑configurable form fields that can be attached to multiple **contexts** (a.k.a. "types"): the institute as a whole, an enroll invite, a live session, an audience campaign, an assessment registration form, etc. They allow admins to extend the data they collect from learners without code changes.

The system uses a **3‑table model** (plus a 4th synchronization table):

| Table | Role |
|-------|------|
| `custom_fields` | Master definition of a field (name, key, type, config, defaults). Shared, deduped by `field_key`. |
| `institute_custom_fields` | Mapping/junction that attaches a `custom_fields` row to a particular **institute** + **type** + **type_id** (e.g. session id, enroll invite id). Also stores ordering and grouping. |
| `custom_field_values` | The actual answer/value for a field, keyed by `source_type` + `source_id` (e.g. user/student id) and optionally `type` + `type_id` (e.g. session id). |
| `system_field_custom_field_mapping` | Optional bi‑directional sync map between hardcoded "system" entity columns (`Student.full_name`, `User.mobile_number`, …) and a custom field. |

On top of the relational model, the institute also stores a **`CUSTOM_FIELD_SETTING`** JSON blob inside its settings (`institute.setting`). This blob is what powers the admin "Custom Field Settings" tab — it carries the complete UI‑level layout (groups, locations, compulsory flags, fixed‑field renames). The relational tables are the source of truth for the **field definitions and their answers**; the JSON blob is the source of truth for **how the admin chose to compose them in the UI** (visibility per location, ordering, groups).

The same backend custom field is rendered by both the admin dashboard (when collecting / showing answers) and the learner dashboard (when filling them in). Visibility is location‑driven: each context is a "location" (Invite List, Live Session Registration, Campaign, Learner Profile, Assessment Registration, …) and the institute setting determines which fields show up where.

---

## 2. Backend — Database Schema

All tables live in the `admin_core_service` Postgres schema. Initial schema in [V1__Initial_schema.sql](vacademy_platform/admin_core_service/src/main/resources/db/migration/V1__Initial_schema.sql); the `system_field_custom_field_mapping` table is added in [V94__system_field_custom_field_mapping.sql](vacademy_platform/admin_core_service/src/main/resources/db/migration/V94__system_field_custom_field_mapping.sql).

### 2.1 `custom_fields` — Master field definitions

[V1__Initial_schema.sql:163-179](vacademy_platform/admin_core_service/src/main/resources/db/migration/V1__Initial_schema.sql#L163-L179)

```sql
CREATE TABLE public.custom_fields (
    id            varchar(36)  NOT NULL,
    field_key     varchar(100) NOT NULL,
    field_name    varchar(255) NOT NULL,
    field_type    varchar(50)  NOT NULL,
    default_value text         NULL,
    config        text         NULL,
    form_order    int4         DEFAULT 0   NULL,
    is_mandatory  bool         DEFAULT false NULL,
    is_filter     bool         DEFAULT false NULL,
    is_sortable   bool         DEFAULT false NULL,
    created_at    timestamp    DEFAULT CURRENT_TIMESTAMP NULL,
    updated_at    timestamp    DEFAULT now() NULL,
    CONSTRAINT custom_fields_pkey PRIMARY KEY (id)
);
CREATE INDEX idx_custom_fields_key  ON public.custom_fields (field_key);
CREATE INDEX idx_custom_fields_type ON public.custom_fields (field_type);
```

Subsequent migrations add `status` and `is_hidden`:

- [V43__Set_default_custom_field_status_active.sql](vacademy_platform/admin_core_service/src/main/resources/db/migration/V43__Set_default_custom_field_status_active.sql)
- [V44__set_default_status_custom_fields.sql](vacademy_platform/admin_core_service/src/main/resources/db/migration/V44__set_default_status_custom_fields.sql)

| Column | Purpose |
|--------|---------|
| `id` | UUID, generated by `@UuidGenerator` on insert. |
| `field_key` | Machine identifier in `snake_case_inst_<instituteId>` format. Used for de‑duplication and lookups. **Unique per `(field_key, status='ACTIVE')`** in practice (enforced by `findByFieldKeyWithLock`). |
| `field_name` | Human label shown in UIs. |
| `field_type` | Renderer hint. Common values: `text`, `number`, `dropdown`. The frontend also infers `EMAIL`/`PHONE` from the key (see §16.3). |
| `default_value` | Optional pre‑filled value. |
| `config` | JSON blob for type‑specific config. For dropdowns: `[{"id":1,"value":"opt1","label":"opt1"},…]`. The learner parser also tolerates a comma‑separated string for backward compatibility. |
| `form_order` | Default display order across all places the field appears. Per‑location ordering is overridden by `institute_custom_fields.individual_order`. |
| `is_mandatory` / `is_filter` / `is_sortable` | Behavior flags. `is_filter`/`is_sortable` are used by the learner list (column generation, filter chips). |
| `status` | `ACTIVE` / `DELETED`. Soft delete only. |
| `is_hidden` | Hides the field from all forms while keeping data accessible. |

### 2.2 `institute_custom_fields` — Institute ↔ Field mapping

[V1__Initial_schema.sql:1221-1239](vacademy_platform/admin_core_service/src/main/resources/db/migration/V1__Initial_schema.sql#L1221-L1239)

```sql
CREATE TABLE public.institute_custom_fields (
    id                   varchar(255) NOT NULL,
    institute_id         varchar(36)  NOT NULL,
    custom_field_id      varchar(36)  NOT NULL,
    "type"               varchar(50)  NOT NULL,
    type_id              varchar(36)  NULL,
    created_at           timestamp    DEFAULT CURRENT_TIMESTAMP NULL,
    updated_at           timestamp    DEFAULT CURRENT_TIMESTAMP NULL,
    status               varchar(50)  DEFAULT 'ACTIVE'::varchar NULL,
    group_name           varchar(255) NULL,
    individual_order     int4         NULL,
    group_internal_order int4         NULL,
    CONSTRAINT institute_custom_fields_pkey PRIMARY KEY (id)
);
ALTER TABLE public.institute_custom_fields
  ADD CONSTRAINT fk_custom_field_id
  FOREIGN KEY (custom_field_id) REFERENCES public.custom_fields(id) ON DELETE CASCADE;
```

Each row attaches one master `custom_fields` row to a specific *context* inside an institute:

| Column | Purpose |
|--------|---------|
| `institute_id` | Owning institute. |
| `custom_field_id` | FK → `custom_fields.id`. |
| `type` | Context type. Values come from `CustomFieldTypeEnum`: `DEFAULT_CUSTOM_FIELD` (institute‑wide default), `ENROLL_INVITE`, `SESSION`, `AUDIENCE_FORM`, `ASSESSMENT`, etc. |
| `type_id` | The id of the specific entity (enroll invite id, live session id, …). `NULL` for institute‑level (`DEFAULT_CUSTOM_FIELD`). |
| `group_name` / `group_internal_order` | If the field belongs to a group, the group name and its order inside the group. |
| `individual_order` | Per‑context display order. Overrides `custom_fields.form_order`. |
| `status` | `ACTIVE` / `DELETED` (soft delete). |

### 2.3 `custom_field_values` — Submitted answers

[V1__Initial_schema.sql:1108-1118](vacademy_platform/admin_core_service/src/main/resources/db/migration/V1__Initial_schema.sql#L1108-L1118)

```sql
CREATE TABLE public.custom_field_values (
    id              varchar(255) NOT NULL,
    custom_field_id varchar(255) NOT NULL,
    source_type     varchar(255) NOT NULL,
    source_id       varchar(255) NOT NULL,
    "type"          varchar(255) NULL,
    type_id         varchar(255) NULL,
    value           text         NULL,
    CONSTRAINT custom_field_values_pkey PRIMARY KEY (id),
    CONSTRAINT custom_field_values_custom_field_id_fkey
      FOREIGN KEY (custom_field_id) REFERENCES public.custom_fields(id) ON DELETE CASCADE
);
```

Timestamps are added in [V40__Add_timestamps_to_custom_field_values.sql](vacademy_platform/admin_core_service/src/main/resources/db/migration/V40__Add_timestamps_to_custom_field_values.sql).

| Column | Purpose |
|--------|---------|
| `custom_field_id` | Which field the answer belongs to. |
| `source_type` / `source_id` | **Who** owns this value — typically `USER` / userId, `STUDENT` / studentId, `GUEST` / guestId. |
| `type` / `type_id` | **In which context** the answer was given — e.g. `SESSION` / sessionId, `ENROLL_INVITE` / inviteId. Optional. |
| `value` | The raw answer (TEXT). All field types serialize to string. |

This shape lets the same field collect different values per context for the same user (e.g. a "preferred batch" field can have one value at enroll time and another for an event registration).

### 2.4 `system_field_custom_field_mapping` — Bi‑directional sync map

[V94__system_field_custom_field_mapping.sql](vacademy_platform/admin_core_service/src/main/resources/db/migration/V94__system_field_custom_field_mapping.sql)

```sql
CREATE TABLE IF NOT EXISTS system_field_custom_field_mapping (
    id                VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
    institute_id      VARCHAR(36)  NOT NULL,
    entity_type       VARCHAR(50)  NOT NULL,   -- STUDENT, USER, ENQUIRY, …
    system_field_name VARCHAR(100) NOT NULL,   -- full_name, mobile_number, …
    custom_field_id   VARCHAR(36)  NOT NULL,
    sync_direction    VARCHAR(20)  NOT NULL DEFAULT 'BIDIRECTIONAL',
    converter_class   VARCHAR(255),            -- Optional Java converter
    status            VARCHAR(20)  DEFAULT 'ACTIVE',
    created_at        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_system_field_mapping
      UNIQUE (institute_id, entity_type, system_field_name, custom_field_id)
);
CREATE INDEX idx_sfcfm_custom_field_id ON system_field_custom_field_mapping(custom_field_id);
CREATE INDEX idx_sfcfm_institute_entity ON system_field_custom_field_mapping(institute_id, entity_type);
CREATE INDEX idx_sfcfm_system_field     ON system_field_custom_field_mapping(institute_id, entity_type, system_field_name);
CREATE INDEX idx_sfcfm_status           ON system_field_custom_field_mapping(status);
-- + trigger trigger_update_sfcfm_updated_at to maintain updated_at
```

This table powers `FieldMappingController` (see §6.2). It lets an institute say *"my custom field 'Phone' is the same thing as `User.mobile_number`"* and the platform will keep them in sync in the configured direction (`BIDIRECTIONAL`, `TO_SYSTEM`, `TO_CUSTOM`, or `NONE`).

### 2.5 `learner_invitation_custom_field` (legacy)

[V1__Initial_schema.sql:1274-1289](vacademy_platform/admin_core_service/src/main/resources/db/migration/V1__Initial_schema.sql#L1274-L1289) and [V1__Initial_schema.sql:2182-2192](vacademy_platform/admin_core_service/src/main/resources/db/migration/V1__Initial_schema.sql#L2182-L2192)

There's an older, **per‑invitation** custom‑field model used by `learner_invitation` (the older invitation feature). It has its own pair of tables:

```sql
CREATE TABLE public.learner_invitation_custom_field ( … );          -- Definitions per invitation
CREATE TABLE public.learner_invitation_custom_field_response ( … ); -- Answers per response
```

This is **not** the same system as `custom_fields`/`institute_custom_fields`. The new enrollment flow (`enroll_invite`) uses the unified `custom_fields` system. Both still exist for backwards compatibility.

---

## 3. Backend — JPA Entities

### 3.1 `CustomFields`

[CustomFields.java](vacademy_platform/admin_core_service/src/main/java/vacademy/io/admin_core_service/features/common/entity/CustomFields.java)

```java
@Entity
@Table(name = "custom_fields")
public class CustomFields {
    @Id @UuidGenerator
    private String id;

    @Column(nullable = false, unique = true, length = 100) private String fieldKey;
    @Column(nullable = false, length = 255)               private String fieldName;
    @Column(nullable = false, length = 50)                private String fieldType;

    @Column(columnDefinition = "TEXT") private String defaultValue;
    @Column(columnDefinition = "TEXT") private String config;

    private Integer formOrder    = 0;
    private Boolean isMandatory  = false;
    private Boolean isFilter     = false;
    private Boolean isSortable   = false;
    private String  status;          // ACTIVE / DELETED
    private Boolean isHidden     = false;

    @PrePersist
    private void setDefaultStatus() {
        if (status == null) this.status = StatusEnum.ACTIVE.name();
    }
}
```

A copy constructor `CustomFields(CustomFieldDTO)` is provided so DTOs can be lifted into entities while skipping null fields.

### 3.2 `InstituteCustomField`

[InstituteCustomField.java](vacademy_platform/admin_core_service/src/main/java/vacademy/io/admin_core_service/features/common/entity/InstituteCustomField.java)

```java
@Entity
@Table(name = "institute_custom_fields")
public class InstituteCustomField {
    @Id @UuidGenerator           private String  id;
    @Column(nullable = false)    private String  instituteId;
    @Column(nullable = false)    private String  customFieldId;   // FK → custom_fields.id
    @Column(nullable = false)    private String  type;            // SESSION, ENROLL_INVITE, …
                                 private String  typeId;          // session id, invite id, …
                                 private String  groupName;
                                 private Integer groupInternalOrder;
                                 private Integer individualOrder;
                                 private String  status = "ACTIVE";
}
```

The mapping is intentionally done by id rather than `@ManyToOne` so a single row can be cheaply queried in batch joins.

### 3.3 `CustomFieldValues`

[CustomFieldValues.java](vacademy_platform/admin_core_service/src/main/java/vacademy/io/admin_core_service/features/common/entity/CustomFieldValues.java)

```java
@Entity
@Table(name = "custom_field_values")
public class CustomFieldValues {
    @Id @UuidGenerator               private String id;
    @Column(nullable = false)        private String customFieldId;
    @Column(nullable = false)        private String sourceType;     // USER, STUDENT, GUEST, …
    @Column(nullable = false)        private String sourceId;
                                     private String type;           // SESSION, ENROLL_INVITE, …
                                     private String typeId;
    @Column(columnDefinition="TEXT") private String value;
}
```

### 3.4 `SystemFieldCustomFieldMapping`

[SystemFieldCustomFieldMapping.java](vacademy_platform/admin_core_service/src/main/java/vacademy/io/admin_core_service/features/common/entity/SystemFieldCustomFieldMapping.java)

```java
@Entity
@Table(name = "system_field_custom_field_mapping")
public class SystemFieldCustomFieldMapping {
    @Id @UuidGenerator        private String  id;
    @Column(nullable = false) private String  instituteId;
    @Column(nullable = false) private String  entityType;        // STUDENT, USER, …
    @Column(nullable = false) private String  systemFieldName;   // full_name, mobile_number, …
    @Column(nullable = false) private String  customFieldId;
    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
                              private SyncDirectionEnum syncDirection;
                              private String  converterClass;
                              private String  status = "ACTIVE";
}
```

`SyncDirectionEnum` values: `BIDIRECTIONAL`, `TO_SYSTEM`, `TO_CUSTOM`, `NONE`.

---

## 4. Backend — Repositories

### 4.1 `CustomFieldRepository`

[CustomFieldRepository.java](vacademy_platform/admin_core_service/src/main/java/vacademy/io/admin_core_service/features/common/repository/CustomFieldRepository.java)

Notable members:

| Method | Notes |
|--------|-------|
| `findByFieldKey(String)` / `findTopByFieldKeyAndStatusOrderByCreatedAtDesc` | Lookup by snake_case key, optionally restricted to ACTIVE status. |
| `findByFieldKeyAndInstituteId(String, String)` | Native query joining `institute_custom_fields` to ensure the field is mapped to the given institute. |
| `findByFieldKeyWithLock(String, String)` | `@Lock(PESSIMISTIC_WRITE)` row lock — used during create to prevent two concurrent inserts of the same key. |
| `findDropdownCustomFieldsByInstituteId(...)` | Native query using `DISTINCT ON (LOWER(field_name))` to return one field per name (case‑insensitive), keeping the most recent. Used by the table‑setup endpoint to populate filter dropdowns. |
| `getSessionCustomFieldsBySessionId(String)` | Native query joining `live_session ⨝ institute_custom_fields ⨝ custom_fields` to deliver session metadata + field list in one round‑trip. Backs the public live‑session registration endpoint. Returns a `FlatFieldProjection` interface (declared inside the repository). |

### 4.2 `InstituteCustomFieldRepository`

[InstituteCustomFieldRepository.java](vacademy_platform/admin_core_service/src/main/java/vacademy/io/admin_core_service/features/common/repository/InstituteCustomFieldRepository.java)

| Method | Notes |
|--------|-------|
| `findInstituteCustomFieldsWithDetails(instituteId, type, typeId)` | Returns `[InstituteCustomField, CustomFields]` tuples, ordered by `cf.formOrder`. |
| `findActiveInstituteCustomFieldsWithNullTypeId(instituteId, status)` | Institute‑level fields (no specific context). |
| `findUniqueActiveCustomFieldsByInstituteId(instituteId, status)` | Deduplicates by `field_key`, keeps the smallest `id` per group — used to drive "all unique fields for the institute" listings. |
| `findByInstituteIdAndFieldName(instituteId, fieldName)` | Lookup by display name (used by enrollment flows). |
| `findTopByInstituteIdAndCustomFieldIdAndTypeAndTypeIdAndStatusOrderByCreatedAtDesc(...)` | The "find existing mapping" used by upsert. |
| `findByInstituteIdAndTypeAndTypeIdAndStatusIn(...)` | List mappings filtered by status. |
| `findCustomFieldUsageAggregation(instituteId)` | `GROUP BY` query that counts how many `ENROLL_INVITE` / `AUDIENCE_FORM` mappings exist per field. Backs the "Custom Fields with usage" admin screen. |
| `updateStatusByInstituteIdAndTypeAndCustomFieldId(...)` | `@Modifying` soft‑delete update. |
| `deleteByCustomFieldId(String)` | Hard delete (used by clean‑up paths). |
| `existsByInstituteIdAndCustomFieldIdAndStatus(...)` | Existence check. |

### 4.3 `CustomFieldValuesRepository`

Standard `JpaRepository<CustomFieldValues, String>` plus a few finders by `(sourceType, sourceId)` and `(customFieldId, sourceId)` to fetch a learner's saved answers.

### 4.4 `SystemFieldCustomFieldMappingRepository`

Used by `FieldMappingManager` to list/create/update mappings filtered by `instituteId`, `entityType`, `status`.

---

## 5. Backend — Services & Managers

### 5.1 `InstituteCustomFiledService` — the workhorse

[InstituteCustomFiledService.java](vacademy_platform/admin_core_service/src/main/java/vacademy/io/admin_core_service/features/common/service/InstituteCustomFiledService.java)

This is the central service that every other feature uses to read or write custom fields and their mappings. Key responsibilities:

#### 5.1.1 Upsert (`addOrUpdateCustomField`) — lines 43–119

```java
@Transactional
public void addOrUpdateCustomField(List<InstituteCustomFieldDTO> cfDTOs) {
    for (InstituteCustomFieldDTO dto : cfDTOs) {
        CustomFieldDTO cfDto = dto.getCustomField();

        CustomFields cf;
        if (StringUtils.hasText(cfDto.getId())) {
            cf = customFieldRepository.findById(cfDto.getId())
                    .orElseThrow(() -> new VacademyException("Custom Field Not Found"));
        } else {
            String fieldKey = keyGenerator.generateFieldKey(cfDto.getFieldName(), dto.getInstituteId());
            cf = findOrCreateCustomFieldWithLock(fieldKey, cfDto);
        }

        // Find existing mapping (active first, then deleted to reactivate)
        Optional<InstituteCustomField> optionalInstCF = instituteCustomFieldRepository
            .findTopByInstituteIdAndCustomFieldIdAndTypeAndTypeIdAndStatusOrderByCreatedAtDesc(
                dto.getInstituteId(), cf.getId(), dto.getType(), dto.getTypeId(),
                StatusEnum.ACTIVE.name());
        // … (fallback to DELETED for reactivation)

        InstituteCustomField instCF;
        if (optionalInstCF.isPresent()) {
            instCF = optionalInstCF.get();
            if (StatusEnum.DELETED.name().equals(instCF.getStatus()))
                instCF.setStatus(StatusEnum.ACTIVE.name());            // reactivate
            // update group/order if provided
        } else {
            instCF = new InstituteCustomField(dto);
            instCF.setCustomFieldId(cf.getId());
        }
        instCFList.add(instCF);
    }
    instituteCustomFieldRepository.saveAll(instCFList);
}
```

Key behaviors:

- **Find‑or‑create with row lock** (`findOrCreateCustomFieldWithLock`) prevents two concurrent admin saves from creating duplicate `custom_fields` rows for the same key.
- **Reactivation** — if the same `(instituteId, customFieldId, type, typeId)` exists in `DELETED`, it is flipped back to `ACTIVE` instead of inserting a new row. This keeps history clean and avoids duplicate mappings after toggle on/off.
- **Mutable mapping fields** — only `groupName`, `groupInternalOrder`, `individualOrder` are updated on existing mappings; the underlying `custom_fields` row is *never* mutated through this code path.

#### 5.1.2 Default field bootstrap (`createDefaultCustomFieldsForInstitute`) — lines 246–294

```java
public List<InstituteCustomField> createDefaultCustomFieldsForInstitute(Institute institute) {
    CustomFields nameCustomFields  = CustomFields.builder().fieldKey("full_name")
        .fieldName("Full Name").fieldType("text").config("{}")
        .isFilter(true).isSortable(true).build();
    CustomFields emailCustomFields = CustomFields.builder().fieldKey("email")
        .fieldName("Email").fieldType("text").config("{}")
        .isFilter(true).isSortable(true).build();
    CustomFields phoneCustomFields = CustomFields.builder().fieldKey("phone_number")
        .fieldName("Phone Number").fieldType("number").config("{}")
        .isFilter(true).isSortable(true).build();

    List<CustomFields> savedCustomFields =
        customFieldRepository.saveAll(List.of(nameCustomFields, emailCustomFields, phoneCustomFields));

    List<InstituteCustomField> defaults = savedCustomFields.stream()
        .map(cf -> InstituteCustomField.builder()
            .customFieldId(cf.getId())
            .instituteId(institute.getId())
            .status("ACTIVE")
            .type(CustomFieldTypeEnum.DEFAULT_CUSTOM_FIELD.name())
            .build())
        .toList();

    return instituteCustomFieldRepository.saveAll(defaults);
}
```

This is invoked during institute provisioning (see §7).

#### 5.1.3 Other notable methods

| Method | Purpose |
|--------|---------|
| `findCustomFieldsAsJson(instituteId, type, typeId)` | Returns the active list of `InstituteCustomFieldDTO`s for a particular context. Used for "fetch fields for this session" / "fetch fields for this enroll invite". |
| `findUniqueActiveCustomFieldsByInstituteId(instituteId)` | Drives the institute‑wide field listing (`InstituteCustomFieldSetupDTO`). |
| `softDeleteInstituteCustomField` / `softDeleteInstituteCustomFieldsBulk` | Soft delete a mapping (status → `DELETED`). |
| `copyDefaultCustomFieldsToEnrollInvite(instituteId, enrollInviteId)` | When a new enroll invite is created, this method copies the institute's `DEFAULT_CUSTOM_FIELD` mappings into `ENROLL_INVITE` mappings — so the new invite immediately has Name/Email/Phone. |
| `createOrFindCustomFieldByKey(request, instituteId)` | Public API to create a new master field (used when admin defines a new field from settings). |
| `getActiveDropdownCustomFields(instituteId)` | Returns deduped active dropdown fields. Used to populate filter widgets and the table‑setup endpoint that the admin learner table consumes. |
| `getCustomFieldsUsage(instituteId)` | Aggregates usage counts by `ENROLL_INVITE` / `AUDIENCE_FORM` per field. Powers the "Custom Fields list with usage" view in settings. |
| `updateOrCreateCustomFieldsValues(List<CustomFieldValues>)` | Bulk save of submitted answers — used by enrollment, session join, etc. |

### 5.2 `FieldMappingManager`, `FieldSyncService`, `SystemFieldMetadataService`

These three live under `features/common/` and back the `system_field_custom_field_mapping` feature:

- **`SystemFieldMetadataService`** — knows the catalog of system fields each `entityType` (STUDENT, USER, ENQUIRY) exposes. Returns `SystemFieldInfoDTO` lists annotated with whether each field is currently mapped.
- **`FieldMappingManager`** — CRUD for `SystemFieldCustomFieldMapping`s (list, create, update, soft‑delete). Validates that the referenced `custom_field_id` exists.
- **`FieldSyncService`** — when called, walks every active mapping for `(institute, entity, entityId)` and either copies the system column value into a new `custom_field_values` row or vice‑versa, depending on `sync_direction`. Optionally invokes a `converterClass` for type adaptation (e.g. `Date` → `String`).

### 5.3 `CustomFieldFilterService` (institute_learner)

[features/institute_learner/service/CustomFieldFilterService.java](vacademy_platform/admin_core_service/src/main/java/vacademy/io/admin_core_service/features/institute_learner/service/CustomFieldFilterService.java)

Used when the admin learner list applies filters/sorts that include custom field columns. It reads the active dropdown fields for the institute, builds JOIN/WHERE fragments dynamically, and feeds them into the learner search query.

### 5.4 `InstituteSettingService.createDefaultCustomFieldSetting`

[InstituteSettingService.java:167-201](vacademy_platform/admin_core_service/src/main/java/vacademy/io/admin_core_service/features/institute/service/setting/InstituteSettingService.java#L167-L201)

This is what writes the **`CUSTOM_FIELD_SETTING` JSON blob** into `institute.setting`. It is called from `createDefaultSettingsForInstitute(institute)` during institute creation, after `createDefaultCustomFieldsForInstitute` has populated the relational tables.

```java
@Transactional
public void createDefaultCustomFieldSetting(Institute institute) {
    List<InstituteCustomField> defaultCustomFields =
        instituteCustomFiledService.createDefaultCustomFieldsForInstitute(institute);

    CustomFieldSettingRequest request = new CustomFieldSettingRequest();
    List<CustomFieldDto> customFieldsAndGroups = createFieldsAndGroupsForInstitute(defaultCustomFields);

    request.setFixedCustomFields(customFieldsAndGroups.stream().map(CustomFieldDto::getCustomFieldId).toList());
    request.setAllCustomFields( customFieldsAndGroups.stream().map(CustomFieldDto::getCustomFieldId).toList());
    request.setCustomFieldLocations(ConstantsSettingDefaultValue.getDefaultCustomFieldLocations());
    request.setCustomFieldsAndGroups(customFieldsAndGroups);
    request.setFixedFieldRenameDtos(ConstantsSettingDefaultValue.getFixedColumnsRenameDto());
    request.setCustomGroup(new HashMap<>());

    // Mark Name/Email/Phone as compulsory
    List<String> compulsory = new ArrayList<>();
    List<String> names      = new ArrayList<>();
    customFieldsAndGroups.forEach(f -> { names.add(f.getFieldName()); compulsory.add(f.getCustomFieldId()); });
    request.setCompulsoryCustomFields(compulsory);
    request.setCustomFieldsName(names);

    String json = settingStrategyFactory.buildNewSettingAndGetSettingJsonString(
        institute, request, SettingKeyEnums.CUSTOM_FIELD_SETTING.name());
    institute.setSetting(json);
    instituteRepository.save(institute);
}
```

`createFieldsAndGroupsForInstitute` builds `CustomFieldDto` records with `canBeDeleted=false`, `canBeEdited=false`, `canBeRenamed=false` for the three default fields, ensuring the admin UI shows them as locked.

---

## 6. Backend — REST Controllers

### 6.1 `InstituteCustomFieldSettingController`

[InstituteCustomFieldSettingController.java](vacademy_platform/admin_core_service/src/main/java/vacademy/io/admin_core_service/features/institute/controller/InstituteCustomFieldSettingController.java)

Base path: `/admin-core-service/institute/v1/custom-field`

| Verb | Path | Body / Params | Description |
|------|------|---------------|-------------|
| `POST` | `/create-or-update` | `?instituteId&isPresent`, body `CustomFieldSettingRequest` | Persists the entire custom‑field settings JSON blob (locations, groups, ordering, compulsory list, fixed‑field renames). The `isPresent` query string is used by the manager to decide between *create* (first time) and *update* (already initialised). |
| `GET` | `/list-with-usage` | `?instituteId` | Returns `List<CustomFieldUsageDTO>` — every active field for the institute plus counts of how many `ENROLL_INVITE` / `AUDIENCE_FORM` mappings reference it, plus an `isDefault` flag. Powers the admin "Custom Fields" settings page table. |

The actual logic is delegated to `InstituteSettingManager.updateCustomFieldSetting(...)` and `InstituteSettingManager.getCustomFieldsWithUsage(...)`.

### 6.2 `FieldMappingController`

[FieldMappingController.java](vacademy_platform/admin_core_service/src/main/java/vacademy/io/admin_core_service/features/common/controller/FieldMappingController.java)

Base path: `/admin-core-service/common/field-mapping`

| Verb | Path | Description |
|------|------|-------------|
| `GET` | `?instituteId&entityType` | List system↔custom mappings. Returns `List<SystemFieldCustomFieldMappingDTO>`. |
| `GET` | `/available-fields?instituteId&entityType` | Catalog of all system fields for the entity type, annotated with `isMapped`. |
| `GET` | `/entity-types` | Supported entity types (`STUDENT`, `USER`, `ENQUIRY`, …). |
| `POST` | `` (root) | Create a new mapping. Body: `SystemFieldCustomFieldMappingDTO`. |
| `PUT` | `/{mappingId}` | Update an existing mapping. |
| `DELETE` | `/{mappingId}` | Soft delete (status → `INACTIVE`). |
| `POST` | `/sync/system-to-custom?instituteId&entityType&entityId` | Force‑run system → custom sync for one entity. |
| `POST` | `/sync/custom-to-system?instituteId&entityType&entityId` | Force‑run custom → system sync for one entity. |

### 6.3 Public custom‑field endpoints used by the learner app

These are not on a single controller — they live in the controllers of the features that need them. The most important:

| Verb | Path | Source | Purpose |
|------|------|--------|---------|
| `GET` | `/admin-core-service/open/common/custom-fields/setup` | (open / public) | Returns the institute‑wide field setup the learner needs to render generic registration forms. |
| `GET` | `/admin-core-service/live-session/get-registration-data` | `live_session/Step2Service` & friends | Returns session metadata + the live‑session‑level custom fields (uses `CustomFieldRepository.getSessionCustomFieldsBySessionId`). |
| `POST` | `/admin-core-service/live-session/register-guest-user` | `SessionGuestRegistrationRepository` flow | Persists guest registration including `custom_fields` array. |
| `POST` | `/admin-core-service/open/learner/enroll-invite` (and the `enroll-invite` endpoints under it) | `EnrollInviteService` / `EnrollmentFormService` | Returns the invite + its custom fields and accepts submissions including `custom_field_values`. |
| `POST` | `/admin-core-service/open/learner/collect-public-user-data` | `CentralizedRecipientResolutionService` etc. | Used for events / live sessions / enquiry to collect a public user's profile + per‑context custom field values. |
| `GET` | `/admin-core-service/open/v1/audience/campaign` | `AudienceController` | Returns audience campaign with `institute_custom_fields` for the public response form. |
| `GET` | `/assessment-service/open-registrations/v1/assessment-page` | `assessment_service` (separate service) | Returns the assessment plus its `assessment_custom_fields`. |
| `POST` | `/assessment-service/open-registrations/v1/register` (`REGISTER_PARTICIPANT_URL`) | `assessment_service` | Submits the participant registration with `custom_field_request_list`. |

---

## 7. Backend — Default Field Initialization on Institute Creation

When a new institute is created, two coordinated operations populate custom fields:

1. **Relational defaults** via `InstituteCustomFiledService.createDefaultCustomFieldsForInstitute(institute)` (§5.1.2). It inserts three master `custom_fields` rows (Full Name, Email, Phone Number) and three `institute_custom_fields` rows pointing at the institute with `type = DEFAULT_CUSTOM_FIELD` and `typeId = NULL`.

2. **Settings JSON blob** via `InstituteSettingService.createDefaultCustomFieldSetting(institute)` (§5.4) — creates the `CUSTOM_FIELD_SETTING` entry inside `institute.setting` with:
   - `customFieldsAndGroups`: the three defaults, all `canBeDeleted=false / canBeEdited=false / canBeRenamed=false`.
   - `compulsoryCustomFields`: all three IDs (Name/Email/Phone are required).
   - `customFieldLocations`: `ConstantsSettingDefaultValue.getDefaultCustomFieldLocations()` — the canonical list of UI locations (Learner's List, Learner Enrollment, Invite List, Live Session Registration, Assessment Registration, Campaign, Enquiry, Learner Profile, Enroll Request List).
   - `fixedFieldRenameDtos`: `ConstantsSettingDefaultValue.getFixedColumnsRenameDto()` — the catalog of system fields the admin can rename (gender, address, city, parent name, …) without converting them to free‑form custom fields.

The orchestration is in [`InstituteSettingService.createDefaultSettingsForInstitute`](vacademy_platform/admin_core_service/src/main/java/vacademy/io/admin_core_service/features/institute/service/setting/InstituteSettingService.java#L119-L143) which is invoked from the institute creation flow (in `InstituteInitManager` and the institute manager when bootstrapping a brand new institute).

In addition, when a **new enroll invite** is created, `copyDefaultCustomFieldsToEnrollInvite(instituteId, enrollInviteId)` (`InstituteCustomFiledService` lines 393‑430) is called to clone the `DEFAULT_CUSTOM_FIELD` mappings into `ENROLL_INVITE` mappings tied to that invite. This is what guarantees a fresh invite already has Name/Email/Phone before the admin touches anything.

---

## 8. Backend — Field Key Generation Strategy

[CustomFieldKeyGenerator.java](vacademy_platform/admin_core_service/src/main/java/vacademy/io/admin_core_service/features/common/util/CustomFieldKeyGenerator.java)

```java
public String generateFieldKey(String fieldName, String instituteId) {
    String key = fieldName.toLowerCase(Locale.ENGLISH);
    key = SPECIAL_CHARS_PATTERN.matcher(key).replaceAll("_"); // [^a-zA-Z0-9_] → _
    key = MULTIPLE_UNDERSCORES_PATTERN.matcher(key).replaceAll("_");
    key = key.replaceAll("^_+|_+$", "");
    if (key.isEmpty() || Character.isDigit(key.charAt(0))) key = "field_" + key;
    if (key.length() < 2) key = key + "_field";
    return key + "_inst_" + instituteId;
}
```

Important consequences:

- The key always ends with `_inst_<instituteId>`, so `find by key` is implicitly institute‑scoped even when no JOIN is used.
- `generateUniqueFieldKey(name, instituteId, existingKeys)` appends `_1`, `_2`, … if collisions exist.
- Two different institutes will *never* collide on `field_key`, so a single global `unique` index on `custom_fields.field_key` is safe.

---

## 9. Backend — Visibility & Settings Model

The `CUSTOM_FIELD_SETTING` JSON blob (built from [`CustomFieldSettingRequest`](vacademy_platform/admin_core_service/src/main/java/vacademy/io/admin_core_service/features/institute/dto/settings/custom_field/CustomFieldSettingRequest.java)) is the single document that drives **where** a field shows up. It has:

```java
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CustomFieldSettingRequest {
    List<String>                groupNames;
    List<String>                customFieldsName;
    List<String>                compulsoryCustomFields;
    Map<String, CustomFieldDto> customGroup;
    List<CustomFieldDto>        customFieldsAndGroups;
    List<String>                fixedCustomFields;
    List<String>                allCustomFields;
    List<String>                customFieldLocations;
    List<FixedFieldRenameDto>   fixedFieldRenameDtos;
}
```

with [`CustomFieldDto`](vacademy_platform/admin_core_service/src/main/java/vacademy/io/admin_core_service/features/institute/dto/settings/custom_field/CustomFieldDto.java):

```java
public class CustomFieldDto {
    String id;
    String customFieldId;
    String instituteId;
    String groupName;
    String fieldName;
    String fieldType;
    Integer individualOrder;
    Integer groupInternalOrder;
    Boolean canBeDeleted;
    Boolean canBeEdited;
    Boolean canBeRenamed;
    List<String> locations;   // ← THIS controls visibility per location
    String status;
    String config;
}
```

The `locations` array on each field is the source of truth. The admin UI maps the location strings to `FieldVisibility` checkboxes (see §10.5). When a learner‑facing form needs to render fields it asks: *"give me all fields where `locations.contains('Live Session Registration Form')`"*.

Compulsory state is held by the top‑level `compulsoryCustomFields` ID list; **not** by `is_mandatory` on the master row. This lets the same field be optional in one context and required in another (within the same institute) — although today the admin UI exposes a single toggle per field for simplicity.

`fixedFieldRenameDtos` (the [`FixedFieldRenameDto`](vacademy_platform/admin_core_service/src/main/java/vacademy/io/admin_core_service/features/institute/dto/settings/custom_field/FixedFieldRenameDto.java)) lets the admin rename or hide the catalog of "system" fields (gender, address, …) without creating a new custom field row. Each entry has `key`, `defaultValue`, `customValue`, `order`, `visibility`.

---

## 10. Frontend Admin — Settings Page (Custom Fields)

Route: **Settings → Custom Fields** (tab key `SettingsTabs.CustomFields`, registered in [src/routes/settings/-utils/utils.ts](frontend-admin-dashboard/src/routes/settings/-utils/utils.ts)).

### 10.1 Component

[src/components/settings/CustomFieldsSettings.tsx](frontend-admin-dashboard/src/components/settings/CustomFieldsSettings.tsx) — the entire settings UI.

### 10.2 API service

[src/services/custom-field-settings.ts](frontend-admin-dashboard/src/services/custom-field-settings.ts) (~1750 lines).

Key URLs from [src/constants/urls.ts](frontend-admin-dashboard/src/constants/urls.ts):

```ts
GET_INSITITUTE_SETTINGS          = '/admin-core-service/institute/v1/insititute-settings';                 // GET (loads the JSON blob)
UPDATE_CUSTOM_FIELD_SETTINGS     = '/admin-core-service/institute/v1/custom-field/create-or-update';      // POST
GET_CUSTOM_FIELD_LIST_WITH_USAGE = '/admin-core-service/institute/v1/custom-field/list-with-usage';       // GET
GET_CUSTOM_FIELD_SETUP           = '/admin-core-service/common/custom-fields/setup';                       // GET (used by audience flow)
```

### 10.3 Lifecycle

1. **Load** — `getCustomFieldSettings(forceRefresh?)` first checks `localStorage['custom-field-settings-cache']` (24h TTL). If invalid/missing, it `GET`s `GET_INSITITUTE_SETTINGS`, runs `mapApiResponseToUI()` to convert the API JSON into the UI shape (`CustomFieldSettingsData`), and writes the cache.
2. **Edit** — the component holds five buckets of fields in React state: `systemFields`, `fixedFields`, `instituteFields`, `customFields`, `fieldGroups`. Drag‑and‑drop is implemented with `@dnd-kit`. Each field has a row of 9 visibility checkboxes (one per location) plus required/optional, name, type, options, delete.
3. **Save** — `saveCustomFieldSettings(uiData)` runs `mapUIToApiRequest(uiData)` and `POST`s `UPDATE_CUSTOM_FIELD_SETTINGS?instituteId=&isPresent=…`. On success, the cache is replaced with the new value.

### 10.4 The 9 visibility locations

[CustomFieldsSettings.tsx:91-100](frontend-admin-dashboard/src/components/settings/CustomFieldsSettings.tsx#L91-L100) and the maps at [custom-field-settings.ts:234-256](frontend-admin-dashboard/src/services/custom-field-settings.ts#L234-L256):

| UI label | UI key in `FieldVisibility` |
|----------|-----------------------------|
| Learner's List | `learnersList` |
| Learner's Enrollment | `learnerEnrollment` |
| Enroll Request List | `enrollRequestList` |
| Invite List | `inviteList` |
| Assessment Registration Form | `assessmentRegistration` |
| Live Session Registration Form | `liveSessionRegistration` |
| Learner Profile | `learnerProfile` |
| Campaign | `campaign` |
| Enquiry | `enquiry` |

The `LOCATION_TO_VISIBILITY_MAP` and `VISIBILITY_TO_LOCATION_MAP` constants translate the UI keys to/from the backend `locations: string[]` array on each `CustomFieldDto`.

### 10.5 Field "buckets"

The UI distinguishes four buckets, but the **classification is done entirely on the frontend** at render time — it is not driven by a backend column or flag. The relevant logic is in [`mapApiResponseToUI`](../../Vacademy_Frontend/frontend-admin-dashboard/src/services/custom-field-settings.ts) (lines 596‑610) and the constant at line 259:

```ts
const SYSTEM_FIELD_NAMES = ['name', 'email', 'username', 'password', 'batch', 'phone'];

fields.forEach((apiField) => {
    const isSystemField = SYSTEM_FIELD_NAMES.includes(apiField.fieldName.toLowerCase());
    const isFixedField  = fixedCustomFields.includes(apiField.customFieldId);

    if (isSystemField || isFixedField) {
        fixedFields.push(mapApiFieldToFixedField(apiField));    // gets the "System Field" badge
    } else {
        customFields.push(mapApiFieldToCustomField(apiField));  // normal custom field
    }
});
```

| Bucket | Source | Classification rule | Editability |
|--------|--------|---------------------|-------------|
| `systemFields` | `fixedFieldRenameDtos` from the API (the renameable label list seeded from backend [`ConstantsSettingDefaultValue.getFixedColumnsRenameDto`](../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/institute/constants/ConstantsSettingDefaultValue.java)). 17 hardcoded entries: `username, email, fullName, addressLine, region, city, pinCode, mobileNumber, dateOfBerth, gender, fatherName, motherName, parentMobileName, parentEmail, linkedInstituteName, parentToMotherMobileNumber, parentsToMotherEmail`. | Rendered in a separate "System Fields" section of the page. | Rename only. Visibility toggle. |
| `fixedFields` | **Real rows from `currentCustomFieldsAndGroups`** (i.e. real `custom_fields` table rows joined via `institute_custom_fields`) **whose `field_name.toLowerCase()` is in `SYSTEM_FIELD_NAMES`**, OR whose UUID is listed in the institute's `fixedCustomFields[]` array. The "System Field" badge is shown by the row renderer. | Frontend name‑match heuristic — there is no backend flag. | Visibility + required toggle only. |
| `instituteFields` / `customFields` | All other rows from `currentCustomFieldsAndGroups`. | Default bucket — anything that didn't match the heuristic. | Full edit (rename, retype, options, visibility, required, delete, reorder). |
| `fieldGroups` | Built by walking `currentCustomFieldsAndGroups` and grouping by `groupName`. | Same source rows as fixed/custom — grouping is orthogonal. | Drag/drop reorder fields within and across groups. |

> **Important consequences of the name‑match heuristic:**
>
> 1. The default fields seeded by [`createDefaultCustomFieldsForInstitute`](../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/common/service/InstituteCustomFiledService.java#L246-L294) are named `Full Name`, `Email`, `Phone Number`. Of these, **only `Email` matches the `SYSTEM_FIELD_NAMES` list exactly**. `Full Name` and `Phone Number` slip through the heuristic and end up in `customFields`, **not** `fixedFields` — so they appear without the "System Field" badge and are fully editable, contradicting the seeder's intent (`canBeDeleted=false`, `canBeEdited=false`, `canBeRenamed=false` set on the row).
> 2. If an admin renames any user-created custom field to one of `name / email / username / password / batch / phone`, the field **immediately becomes uneditable / undeletable in the UI** at next reload, because the heuristic flips it into the `fixedFields` bucket.
> 3. Conversely, an institute that has legacy `custom_fields` rows with names like `name` / `username` / `password` / `batch` (from older seeder code or migrations) will see them all rendered as "System Field" with the badge, even though they are normal custom field rows.
> 4. There is no SQL `UNIQUE` constraint on `custom_fields.field_key` in [V1__Initial_schema.sql:163-179](../admin_core_service/src/main/resources/db/migration/V1__Initial_schema.sql#L163-L179) — only the entity‑level `@Column(unique=true)` annotation, which is **not enforced** when Flyway manages the schema. As a result, duplicate `field_name = 'email'` rows can and do accumulate, and the table can show two or three "Email" rows side by side.

### 10.6 Supported field types in the admin UI

```ts
type FieldType = 'text' | 'dropdown' | 'number';
```

For dropdowns, options are stored in the UI as `string[]` and serialized for the API via `optionsToConfigJson()`:

```ts
export const optionsToConfigJson = (options?: string[]) =>
    JSON.stringify((options ?? []).map((value, idx) => ({ id: idx + 1, value, label: value })));
```

### 10.7 Caching

`localStorage['custom-field-settings-cache']` holds `{ data: CustomFieldSettingsData, timestamp: number, instituteId: string }`. Expiry is **24 h**. On save, the cache is rewritten with the latest payload. There is also a `forceRefresh` parameter on `getCustomFieldSettings` for explicit invalidation.

> **Why a cache?** The admin dashboard reads custom field definitions in dozens of places (invite form, audience form, learner table columns, etc). Each call would otherwise hit `GET_INSITITUTE_SETTINGS`. The cache means: load once, read everywhere through the synchronous helper `getCustomFieldSettingsFromCache()`.

---

## 11. Frontend Admin — Invite Flow

### 11.1 Components

- [src/routes/manage-students/invite/-components/create-invite/CreateInviteDialog.tsx](frontend-admin-dashboard/src/routes/manage-students/invite/-components/create-invite/CreateInviteDialog.tsx) — root dialog.
- [src/routes/manage-students/invite/-components/create-invite/CustomFieldsSection.tsx](frontend-admin-dashboard/src/routes/manage-students/invite/-components/create-invite/CustomFieldsSection.tsx) — list of fields with reorder, required toggle, delete.
- [src/routes/manage-students/invite/-components/create-invite/AddCustomFieldDialog.tsx](frontend-admin-dashboard/src/routes/manage-students/invite/-components/create-invite/AddCustomFieldDialog.tsx) — modal that adds a new text/dropdown field with option editor and uniqueness check.

### 11.2 Form schema

[InviteFormSchema.tsx:59-94](frontend-admin-dashboard/src/routes/manage-students/invite/-schema/InviteFormSchema.tsx#L59-L94)

```ts
const customFieldSchema = z.object({
    id: z.number(),
    type: z.string(),
    name: z.string(),
    oldKey: z.boolean(),               // true → system field, cannot be deleted
    isRequired: z.boolean(),
    options: z.array(z.object({ id: z.number(), value: z.string(), disabled: z.boolean() })).optional(),
    _id: z.string().optional(),
    status: z.enum(['ACTIVE', 'DELETED']),
});
export type CustomField = z.infer<typeof customFieldSchema>;
```

Default mandatory fields seeded in the form: **Full Name**, **Email**, **Phone Number** (all `oldKey: true`, `isRequired: true`).

### 11.3 Loading custom fields from settings

[src/routes/manage-students/invite/-utils/getInviteListCustomFields.ts](frontend-admin-dashboard/src/routes/manage-students/invite/-utils/getInviteListCustomFields.ts)

```ts
export const getInviteListCustomFields = (): InviteFormCustomField[] => {
    const customFields = getFieldsForLocation('Invite List'); // reads cache
    // … shape transform
};
```

So the invite dialog *reads from the same cached `CUSTOM_FIELD_SETTING` blob* as the rest of the admin app. Anything the admin toggled visible at "Invite List" appears in the invite dialog by default.

### 11.4 Submission

[src/routes/manage-students/invite/-utils/formDataToRequestData.ts](frontend-admin-dashboard/src/routes/manage-students/invite/-utils/formDataToRequestData.ts) maps the React Hook Form values into the body of the create‑invite endpoint. Custom fields are sent under `custom_fields` (or `custom_field_values` depending on the endpoint variant). System fields (`oldKey:true`) are excluded — the backend already knows about them.

---

## 12. Frontend Admin — Audience / Campaign Flow

### 12.1 Components

- [src/routes/audience-manager/list/-components/create-campaign-dialog/CreateCampaignForm.tsx](frontend-admin-dashboard/src/routes/audience-manager/list/-components/create-campaign-dialog/CreateCampaignForm.tsx) — the campaign create/edit form.
- [src/routes/audience-manager/list/-components/create-campaign-dialog/CampaignCustomFieldsCard.tsx](frontend-admin-dashboard/src/routes/audience-manager/list/-components/create-campaign-dialog/CampaignCustomFieldsCard.tsx) — the custom field section inside the form, with sortable list, add/delete, required toggle.
- Hook: [src/routes/audience-manager/list/-hooks/useCustomFieldSetup.ts](frontend-admin-dashboard/src/routes/audience-manager/list/-hooks/useCustomFieldSetup.ts).
- Service: [src/routes/audience-manager/list/-services/get-custom-field-setup.ts](frontend-admin-dashboard/src/routes/audience-manager/list/-services/get-custom-field-setup.ts).

### 12.2 Two data sources

The audience flow reads custom fields from **two complementary sources** depending on the screen state:

1. **Cache‑backed defaults** via `getCampaignCustomFields()` (`getFieldsForLocation('Campaign')`) — instant UI population from the local settings blob.
2. **Live backend setup** via `useCustomFieldSetup(instituteId)` which `GET`s `/admin-core-service/common/custom-fields/setup?instituteId=…` (`GET_CUSTOM_FIELD_SETUP`). This returns `CustomFieldSetupItem[]` reflecting the **live** state of `institute_custom_fields` JOINed with `custom_fields`. React Query is configured with `staleTime: 5 * 60 * 1000`.

`CampaignFormCustomField` (defined in `getCampaignCustomFields.ts`) is the canonical UI shape used inside the form; helpers convert raw API rows into it.

### 12.3 Submission

The campaign create endpoint accepts `custom_field_ids`/`custom_field_values` (depending on whether the campaign is templating fields or capturing answers). Backend handler is in `features/audience/service/AudienceService.java` (and `DistinctUserAudienceService.java` for the filter‑variant audience type).

---

## 13. Frontend Admin — Live Class Flow

### 13.1 Components

- [src/routes/study-library/live-session/schedule/-components/scheduleStep2.tsx](frontend-admin-dashboard/src/routes/study-library/live-session/schedule/-components/scheduleStep2.tsx) — Step 2 of the schedule wizard, where guest registration custom fields are configured.
- Schema: [src/routes/study-library/live-session/schedule/-schema/schema.ts](frontend-admin-dashboard/src/routes/study-library/live-session/schedule/-schema/schema.ts).

```ts
export const addCustomFiledSchema = z.object({
    fieldType: z.string(),
    fieldName: z.string(),
    options:   z.array(z.object({ optionField: z.string() })),
});
```

### 13.2 Flow

1. The wizard pre‑populates from `getFieldsForLocation('Live Session Registration Form')`.
2. The admin can add session‑specific custom fields via a small dialog (text or dropdown). State is local to the wizard until step submission.
3. On wizard submit, Step 2's payload (mapped in [LiveSessionStep2RequestDTO.java](vacademy_platform/admin_core_service/src/main/java/vacademy/io/admin_core_service/features/live_session/dto/LiveSessionStep2RequestDTO.java)) includes a custom‑fields array which the backend persists by calling `InstituteCustomFiledService.addOrUpdateCustomField(...)` with `type=SESSION` and `typeId=<sessionId>`. This is handled in [`Step2Service.java`](vacademy_platform/admin_core_service/src/main/java/vacademy/io/admin_core_service/features/live_session/service/Step2Service.java).
4. When a guest registers later via the public registration endpoint, [`CustomFieldRepository.getSessionCustomFieldsBySessionId`](vacademy_platform/admin_core_service/src/main/java/vacademy/io/admin_core_service/features/common/repository/CustomFieldRepository.java#L58-L89) returns the union of session metadata + the custom fields in one query, used by the learner app (§16.6).

---

## 14. Frontend Admin — Assessment Flow

### 14.1 Components

- [src/routes/assessment/create-assessment/$assessmentId/$examtype/-components/StepComponents/Step3AddingParticipants.tsx](frontend-admin-dashboard/src/routes/assessment/create-assessment/$assessmentId/$examtype/-components/StepComponents/Step3AddingParticipants.tsx)
- Helpers: [helper.ts](frontend-admin-dashboard/src/routes/assessment/create-assessment/$assessmentId/$examtype/-utils/helper.ts) (`getCustomFieldsWhileEditStep3`, `transformAllBatchData`, `syncStep3DataWithStore`).

### 14.2 Default fields

Open‑registration assessments seed three mandatory text fields (Full Name, Email, Phone Number) just like Invite. Admin can add additional text/dropdown/number fields, mark required, reorder.

### 14.3 Persistence

The assessment lives in `assessment_service` (a separate microservice), and its custom fields use a slightly different internal table (`assessment_custom_fields`) — but the admin UI shape (`CustomFieldStep3` in [src/types/assessments/assessment-data-type.ts](frontend-admin-dashboard/src/types/assessments/assessment-data-type.ts)) mirrors the unified one for consistency. The conversion happens in helpers `transformAllBatchData` and `syncStep3DataWithStore`, and the data flows into the assessment create/update endpoints under `/assessment-service/`.

### 14.4 Why two stores?

Assessment custom fields are intentionally stored inside `assessment_service` because the assessment service is the system of record for an attempt and has stricter audit/exam requirements. The admin dashboard treats them visually the same; the only difference is the *base URL* of the submit call.

---

## 15. Frontend Admin — Shared Utilities, Caching & Types

### 15.1 `src/lib/custom-fields/utils.ts`

[src/lib/custom-fields/utils.ts](frontend-admin-dashboard/src/lib/custom-fields/utils.ts) — the location‑aware helpers used everywhere:

```ts
export type FieldForLocation = {
  id: string;
  name: string;
  type?: 'text' | 'dropdown' | 'number';
  options?: string[];
  required: boolean;
  order: number;
  groupName?: string;
  groupInternalOrder?: number;
  canBeDeleted: boolean;
  canBeEdited: boolean;
  canBeRenamed: boolean;
};

getFieldsForLocation(location)        // unified read across system / fixed / institute / custom / groups, sorted
getAvailableLocations()
getFieldCountsByLocation()
isFieldVisibleInLocation(id, location)
getRequiredFieldsForLocation(location)
```

### 15.2 Per‑feature transforms

| File | Output type | Purpose |
|------|-------------|---------|
| [getInviteListCustomFields.ts](frontend-admin-dashboard/src/routes/manage-students/invite/-utils/getInviteListCustomFields.ts) | `InviteFormCustomField` | Adapts to invite dialog props. |
| [getCampaignCustomFields.ts](frontend-admin-dashboard/src/routes/audience-manager/list/-utils/getCampaignCustomFields.ts) | `CampaignFormCustomField` | Adapts to audience form props. Also exposes `getAllCustomFieldsMap()` for resolving field id → name everywhere. |
| [src/components/design-system/utils/constants/custom-field-columns.tsx](frontend-admin-dashboard/src/components/design-system/utils/constants/custom-field-columns.tsx) | `ColumnDef<StudentTable>[]` | Generates table columns for the learner list out of fields visible at "Learner's List". |

### 15.3 Enroll submission helper

[src/services/student-list-section/enroll-manually.ts](frontend-admin-dashboard/src/services/student-list-section/enroll-manually.ts) — when the admin enrolls a student manually, this filters the form's `custom_fields` map down to *real* custom fields (excluding system) by reading `getCustomFieldSettingsFromCache().customFields` and shipping `[{ custom_field_id, value }, …]` inside `learner_package_session_enroll.custom_field_values`.

### 15.4 System‑to‑custom mapping UI

[src/services/system-custom-field-mapping.ts](frontend-admin-dashboard/src/services/system-custom-field-mapping.ts) — CRUD wrappers for `/admin-core-service/common/field-mapping` endpoints, used by [src/components/settings/SystemToCustomFieldMapping.tsx](frontend-admin-dashboard/src/components/settings/SystemToCustomFieldMapping.tsx).

---

## 16. Frontend Learner — Fetching, Rendering & Submitting

The learner app (`frontend-learner-dashboard-app`) consumes custom fields from several public, no‑auth endpoints — different ones depending on which flow the learner is in.

### 16.1 Endpoints used by the learner

[src/constants/urls.ts](frontend-learner-dashboard-app/src/constants/urls.ts)

| Constant | URL | Used by |
|----------|-----|---------|
| `GET_CUSTOM_FIELDS` | `/admin-core-service/open/common/custom-fields/setup` | Generic institute fields lookup (checkout, enrollment). |
| `LIVE_SESSION_GET_REGISTRATION_DATA` | `/admin-core-service/live-session/get-registration-data` | Live‑class guest registration page. |
| `GET_OPEN_REGISTRATION_DETAILS` | `/assessment-service/open-registrations/v1/assessment-page` | Assessment registration. |
| `GET_AUDIENCE_CAMPAIGN` | `/admin-core-service/open/v1/audience/campaign` | Public audience campaign response form. |
| `ENROLL_OPEN_STUDENT_URL` | `/admin-core-service/open/learner/enroll-invite` | Public enrollment invite flow (also returns institute custom fields). |

Submission endpoints:

| Constant | Method | Purpose |
|----------|--------|---------|
| `LIVE_SESSION_REGISTER_GUEST_USER` | `POST` | Live class guest registration. |
| `COLLECT_PUBLIC_USER_DATA` | `POST` | Generic public‑user data collector (used in parallel with the above). |
| `ENROLLMENT_FORM_SUBMIT` | `POST` | Public enrollment form submission. |
| `REGISTER_PARTICIPANT_URL` | `POST` | Assessment open registration. |

### 16.2 Service modules

| Module | Responsibility |
|--------|----------------|
| [src/routes/register/live-class/-hooks/useGetRegistrationFormData.ts](frontend-learner-dashboard-app/src/routes/register/live-class/-hooks/useGetRegistrationFormData.ts) | `useSessionCustomFields(sessionId)` React Query hook backing the live‑class form. |
| [src/components/common/enroll-by-invite/-services/custom-fields-setup.ts](frontend-learner-dashboard-app/src/components/common/enroll-by-invite/-services/custom-fields-setup.ts) | Generic institute fields lookup for enrollment. |
| [src/components/common/enroll-by-invite/-services/enroll-invite-services.ts](frontend-learner-dashboard-app/src/components/common/enroll-by-invite/-services/enroll-invite-services.ts) | Enroll invite fetch + submit (`submitEnrollmentForm`, `handleEnrollLearnerForPayment`). React Query keys: `['GET_ENROLL_INVITE_DETAILS', instituteId, inviteCode]` with 1h stale time. |
| [src/routes/$tagName/-services/custom-fields-service.ts](frontend-learner-dashboard-app/src/routes/$tagName/-services/custom-fields-service.ts) | `getInstituteCustomFields` helper used by checkout/Capacitor flows. React Query key: `['GET_INSTITUTE_CUSTOM_FIELDS', instituteId]`, `staleTime: 60 * 60 * 1000`. |
| [src/routes/register/-services/open-registration-services.ts](frontend-learner-dashboard-app/src/routes/register/-services/open-registration-services.ts) | Assessment registration fetch + submit (`handleRegisterOpenParticipant`). |

### 16.3 Renderer (`FieldRenderType`) and validation

[src/components/common/enroll-by-invite/-utils/custom-field-helpers.ts](frontend-learner-dashboard-app/src/components/common/enroll-by-invite/-utils/custom-field-helpers.ts)

```ts
export enum FieldRenderType { PHONE='PHONE', EMAIL='EMAIL', TEXT='TEXT', DROPDOWN='DROPDOWN' }

export const getFieldRenderType = (fieldKey, fieldType) => {
    if (fieldType === 'dropdown') return FieldRenderType.DROPDOWN;
    if (['phone','mobile','contact','telephone','cell'].some(k => fieldKey.toLowerCase().includes(k)))
        return FieldRenderType.PHONE;
    if (['email','e-mail','mail'].some(k => fieldKey.toLowerCase().includes(k)))
        return FieldRenderType.EMAIL;
    return FieldRenderType.TEXT;
};
```

So even though the backend only stores `text|number|dropdown`, the learner app *infers* PHONE/EMAIL from the **field key** to render `react-phone-input-2` or HTML5 email validation.

`parseDropdownOptions(config)` is intentionally tolerant — it accepts:

- A JSON array `[{id,value,label}]` (the canonical format produced by the admin UI).
- A JSON object with `coommaSepartedOptions` / `commaSeparatedOptions` / `options` keys (legacy).
- A plain comma‑separated string (for very old data).

Validation uses `validateFieldValue(value, renderType)` for inline checks plus a dynamically generated Zod schema (`generateZodSchema` in [registrationFormSchema.ts](frontend-learner-dashboard-app/src/routes/register/live-class/-types/registrationFormSchema.ts), `getDynamicSchema` in [src/routes/register/-utils/helper.ts](frontend-learner-dashboard-app/src/routes/register/-utils/helper.ts)) for form‑level validation.

Field ordering uses `sortCustomFields(fields)` which sorts by `individual_order ?? group_internal_order ?? 999`.

### 16.4 Public enrollment flow

Entry: [src/components/common/enroll-by-invite/enroll-form.tsx](frontend-learner-dashboard-app/src/components/common/enroll-by-invite/enroll-form.tsx)

1. Fetch invite via `handleGetEnrollInviteData(...)`. The response may already include `institute_custom_fields`. If not, fall back to `handleGetInstituteCustomFields(...)`.
2. Convert to `ConvertedCustomField[]` using `convertInviteCustomFields` / `convertInstituteCustomFields`.
3. Build a Zod schema with `getDynamicSchema(fields)`.
4. Build default values. Each field is represented as `{ id, name, value:'', is_mandatory, type, render_type, config, comma_separated_options? }`.
5. Apply prefill from `localStorage['enrollment_prefill_data']` (used when the learner upgrades from an existing plan):
   - Exact key match.
   - Smart match for `__smart_email`, `__smart_phone`, `__smart_name` → first field whose name contains "email"/"phone"/"name".
   - `hasPrefillAppliedRef` guards against React Strict Mode double application.
6. The actual rendering is in [registration-step.tsx](frontend-learner-dashboard-app/src/components/common/enroll-by-invite/-components/registration-step.tsx) — it renders dropdowns, phone, email, and text inputs based on `FieldRenderType`. It also handles country/state cascading and email OTP verification.
7. Submission: `submitEnrollmentForm(...)` for free plans, `handleEnrollLearnerForPayment(...)` for paid plans. Both build the body:

```ts
{
    user_details: { full_name, email, mobile_number, ... },
    learner_extra_details: { ... },
    custom_field_values: Object.entries(registrationData)
        .filter(([key]) => !systemKeys.includes(key))
        .map(([, field]) => ({ custom_field_id: field.id, value: field.value })),
}
```

### 16.5 Live class guest registration

Entry: [src/routes/register/live-class/-components/LiveClassRegistrationPage.tsx](frontend-learner-dashboard-app/src/routes/register/live-class/-components/LiveClassRegistrationPage.tsx)

1. `useSessionCustomFields(sessionId)` fetches both session metadata and the custom fields in one call (backed by `CustomFieldRepository.getSessionCustomFieldsBySessionId` on the backend).
2. The form is rendered by [RegistrationForm.tsx](frontend-learner-dashboard-app/src/routes/register/live-class/-components/RegistrationForm.tsx). For each field:
   - `dropdown` → `<SelectField>` populated from `JSON.parse(field.config)`.
   - `mobile_number` key → `<PhoneInput>` (react-phone-input-2).
   - `email` key → either select (from previously verified emails) or `<input type=email>`.
   - everything else → `<MyInput>`.
3. On submit, two DTOs are produced and POSTed:

```ts
// transformToGuestRegistrationDTO → LIVE_SESSION_REGISTER_GUEST_USER
{
    session_id: sessionId,
    email: formValues.email,
    custom_fields: [{ customFieldId, value }, …]
}

// transformToCollectPublicUserDataDTO → COLLECT_PUBLIC_USER_DATA
{
    user_dto: { full_name, email, mobile_number, address_line, region, city, pin_code, date_of_birth },
    package_session_id: null,
    type: 'PUBLIC_LIVE_SESSION',
    type_id: sessionId,
    source: 'LEAD',
    custom_field_values: [
        { custom_field_id, type:'SESSION', type_id:sessionId, source_type:null, source_id:null, value }
    ]
}
```

Backend writes the answers into `custom_field_values` with `source_type=GUEST` and `source_id=<guestId>`, plus `type=SESSION` / `type_id=<sessionId>`.

### 16.6 Assessment open registration

Entry: [src/routes/register/-component/AssessmentRegistrationForm.tsx](frontend-learner-dashboard-app/src/routes/register/-component/AssessmentRegistrationForm.tsx)

1. `useSuspenseQuery(getOpenTestRegistrationDetails(code))` fetches `assessment_custom_fields[]`.
2. Generates Zod schema via `getDynamicSchema(formFields)`. Each field becomes a sub‑object `{ id, name, value, is_mandatory, type, comma_separated_options? }`.
3. On submit, calls `handleRegisterOpenParticipant(...)`:

```ts
{
    institute_id, assessment_id, participant_dto,
    custom_field_request_list: assessment_custom_fields.map(f => ({
        id: f.id,
        assessment_custom_field_id: f.id,
        assessment_custom_field_key: f.field_key,
        answer: formValue[f.field_key]?.value,
    }))
}
```

Posts to `REGISTER_PARTICIPANT_URL` (assessment_service).

### 16.7 Audience campaign response

Entry: [src/routes/enquiry-response/-components/enquiry-response-form.tsx](frontend-learner-dashboard-app/src/routes/enquiry-response/-components/enquiry-response-form.tsx)

1. Fetches campaign via `handleGetPublicInstituteDetails({ instituteId })`.
2. Adapts `institute_custom_fields` (the same `InstituteCustomFieldDTO` shape from the backend) into `AssessmentCustomFieldOpenRegistration[]` with `convertAudienceCustomFields()`, sorted by `individual_order ?? form_order`.
3. Reuses `getDynamicSchema()` and the same renderer to display the form.
4. Submits via `submitEnquiryWithLead(...)` with `custom_fields: [{ custom_field_id, value }]`.

### 16.8 Profile prefill

When the learner is logged in (Capacitor + token present), [CheckoutForm.tsx](frontend-learner-dashboard-app/src/routes/$tagName/-components/components/CheckoutForm.tsx) reads `Preferences.get('StudentDetails')` (Capacitor `Preferences` API) and pre‑populates name/email/phone/address. The web flow uses `localStorage['enrollment_prefill_data']` (set by the upgrade flow elsewhere). There is no dedicated "fetch the learner's prior custom field answers" endpoint — current values are not echoed back into a form on re‑open. Authenticated profile lookups go through `GET_USER_BASIC_DETAILS` and `STUDENT_DETAIL`.

---

## 17. Reference: API Endpoints

### Admin (admin_core_service)

| Verb | Path | Body / Params | Description |
|------|------|---------------|-------------|
| `GET`  | `/admin-core-service/institute/v1/insititute-settings` | `?instituteId` | Returns the entire institute settings document including the `CUSTOM_FIELD_SETTING` blob. |
| `POST` | `/admin-core-service/institute/v1/custom-field/create-or-update` | `?instituteId&isPresent` + `CustomFieldSettingRequest` | Creates / updates the institute‑wide custom field settings (locations, groups, ordering, compulsory list, fixed‑field renames). |
| `GET`  | `/admin-core-service/institute/v1/custom-field/list-with-usage` | `?instituteId` | Returns `List<CustomFieldUsageDTO>` (each field with `enrollInviteCount`, `audienceCount`, `isDefault`). |
| `GET`  | `/admin-core-service/common/custom-fields/setup` | `?instituteId` | Returns the live institute fields by JOINing `institute_custom_fields ⨝ custom_fields`. |
| `GET`  | `/admin-core-service/common/field-mapping?instituteId&entityType` | – | List system↔custom mappings. |
| `GET`  | `/admin-core-service/common/field-mapping/available-fields` | `?instituteId&entityType` | List system fields with `isMapped`. |
| `GET`  | `/admin-core-service/common/field-mapping/entity-types` | – | Catalog of entity types. |
| `POST` | `/admin-core-service/common/field-mapping` | `SystemFieldCustomFieldMappingDTO` | Create a mapping. |
| `PUT`  | `/admin-core-service/common/field-mapping/{mappingId}` | `SystemFieldCustomFieldMappingDTO` | Update a mapping. |
| `DELETE` | `/admin-core-service/common/field-mapping/{mappingId}` | – | Soft delete. |
| `POST` | `/admin-core-service/common/field-mapping/sync/system-to-custom` | `?instituteId&entityType&entityId` | Force a sync run. |
| `POST` | `/admin-core-service/common/field-mapping/sync/custom-to-system` | `?instituteId&entityType&entityId` | Force a sync run. |

### Public / learner (open endpoints)

| Verb | Path | Description |
|------|------|-------------|
| `GET`  | `/admin-core-service/open/common/custom-fields/setup?instituteId=…` | Returns institute custom fields (no auth). Used by checkout / generic enrollment. |
| `GET`  | `/admin-core-service/live-session/get-registration-data?sessionId=…` | Returns session metadata + custom fields in one call. |
| `POST` | `/admin-core-service/live-session/register-guest-user` | Persists the guest registration with `custom_fields`. |
| `POST` | `/admin-core-service/open/learner/collect-public-user-data` | Generic public‑user collector with `custom_field_values`. |
| `GET`  | `/admin-core-service/open/learner/enroll-invite` | Returns the invite + its custom fields. |
| `POST` | `/admin-core-service/open/learner/enroll-invite/submit` (and payment variants) | Submits enrollment with `custom_field_values`. |
| `GET`  | `/admin-core-service/open/v1/audience/campaign?instituteId=…&campaignId=…` | Returns the campaign + `institute_custom_fields`. |
| `POST` | `/admin-core-service/open/v1/audience/submit-enquiry` | Submit audience response with custom fields. |
| `GET`  | `/assessment-service/open-registrations/v1/assessment-page?code=…` | Assessment registration metadata + `assessment_custom_fields`. |
| `POST` | `/assessment-service/open-registrations/v1/register?userId=…` | Submit participant + `custom_field_request_list`. |

> Exact paths under the `enroll-invite` and audience controllers should be verified against [`features/enroll_invite/controller`](vacademy_platform/admin_core_service/src/main/java/vacademy/io/admin_core_service/features/enroll_invite/) and [`features/audience/controller`](vacademy_platform/admin_core_service/src/main/java/vacademy/io/admin_core_service/features/audience/) — they have several variants (admin/public, with/without payment).

---

## 18. Reference: End‑to‑End Lifecycle Example

**Scenario:** the admin wants to ask "University ID" on every Invite form, and a learner submits it.

1. **Settings change** — Admin opens **Settings → Custom Fields**. Clicks "Add Custom Field", enters name `University ID`, type `text`, ticks the **Invite List** checkbox, clicks Save.
2. **Frontend request** — `saveCustomFieldSettings(uiData)` runs `mapUIToApiRequest(uiData)` and POSTs `UPDATE_CUSTOM_FIELD_SETTINGS?instituteId=<id>&isPresent=true` with the full new `CustomFieldSettingRequest`. The local cache is updated on success.
3. **Backend** — `InstituteCustomFieldSettingController.updateCustomFieldSetting(...)` → `InstituteSettingManager.updateCustomFieldSetting(...)`. The manager:
   - Walks `customFieldsAndGroups`. For each entry without a `customFieldId`, it calls `InstituteCustomFiledService.createOrFindCustomFieldByKey(...)` (which uses the pessimistic lock to insert into `custom_fields`).
   - Persists/updates rows in `institute_custom_fields` (`type = DEFAULT_CUSTOM_FIELD`, `typeId = NULL` for institute‑wide fields).
   - Rebuilds the `CUSTOM_FIELD_SETTING` JSON and writes it to `institute.setting`.
4. **Invite create** — Admin clicks **Create Invite**. `CustomFieldsSection` calls `getInviteListCustomFields()` which reads `getFieldsForLocation('Invite List')` from the cache; "University ID" appears already populated. Admin saves the invite.
5. **Backend invite create** — When the enroll invite is created, `EnrollInviteService` (calling `InstituteCustomFiledService.copyDefaultCustomFieldsToEnrollInvite`) inserts `institute_custom_fields` rows with `type=ENROLL_INVITE`, `typeId=<inviteId>` for the cloned default fields. The invite‑specific field list (which is what the public form will display) is now in place.
6. **Learner opens invite** — Learner navigates to the invite URL. The learner app calls `handleGetEnrollInviteData({ instituteId, inviteCode })`. Backend returns the invite payload including `institute_custom_fields[]` (with `customField` nested).
7. **Form rendering** — `enroll-form.tsx` builds the dynamic Zod schema, picks the right renderer (`getFieldRenderType('university_id_inst_<id>', 'text')` → `TEXT`), shows a text input.
8. **Submission** — Learner fills in `MIT-2024-001`, submits. `submitEnrollmentForm(...)` posts to `ENROLLMENT_FORM_SUBMIT` with:

   ```json
   {
       "user_details": { "full_name": "...", "email": "...", "mobile_number": "..." },
       "custom_field_values": [
           { "custom_field_id": "<UNIVERSITY_ID_FIELD_UUID>", "value": "MIT-2024-001" }
       ]
   }
   ```

9. **Backend persistence** — `EnrollmentFormService` creates the user (if needed), then iterates `custom_field_values` and writes one `custom_field_values` row per entry with `source_type=USER`, `source_id=<userId>`, `type=ENROLL_INVITE`, `type_id=<inviteId>`.
10. **Admin sees the answer** — The admin learner table column generator in [custom-field-columns.tsx](frontend-admin-dashboard/src/components/design-system/utils/constants/custom-field-columns.tsx) reads "Learner's List"‑visible fields from the cache; if "University ID" is also visible there, the cell renderer fetches the value from the joined learner row that the backend serves with custom field values inlined.

---

## Appendix A — File Index

**Backend (admin_core_service):**

- Migrations
  - [V1__Initial_schema.sql](vacademy_platform/admin_core_service/src/main/resources/db/migration/V1__Initial_schema.sql) — `custom_fields`, `custom_field_values`, `institute_custom_fields`, `learner_invitation_custom_field*`
  - [V29__Alter_institute_custom_field_set_status_active.sql](vacademy_platform/admin_core_service/src/main/resources/db/migration/V29__Alter_institute_custom_field_set_status_active.sql)
  - [V40__Add_timestamps_to_custom_field_values.sql](vacademy_platform/admin_core_service/src/main/resources/db/migration/V40__Add_timestamps_to_custom_field_values.sql)
  - [V43__Set_default_custom_field_status_active.sql](vacademy_platform/admin_core_service/src/main/resources/db/migration/V43__Set_default_custom_field_status_active.sql)
  - [V44__set_default_status_custom_fields.sql](vacademy_platform/admin_core_service/src/main/resources/db/migration/V44__set_default_status_custom_fields.sql)
  - [V94__system_field_custom_field_mapping.sql](vacademy_platform/admin_core_service/src/main/resources/db/migration/V94__system_field_custom_field_mapping.sql)
- Entities
  - [CustomFields.java](vacademy_platform/admin_core_service/src/main/java/vacademy/io/admin_core_service/features/common/entity/CustomFields.java)
  - [InstituteCustomField.java](vacademy_platform/admin_core_service/src/main/java/vacademy/io/admin_core_service/features/common/entity/InstituteCustomField.java)
  - [CustomFieldValues.java](vacademy_platform/admin_core_service/src/main/java/vacademy/io/admin_core_service/features/common/entity/CustomFieldValues.java)
  - [SystemFieldCustomFieldMapping.java](vacademy_platform/admin_core_service/src/main/java/vacademy/io/admin_core_service/features/common/entity/SystemFieldCustomFieldMapping.java)
- Repositories
  - [CustomFieldRepository.java](vacademy_platform/admin_core_service/src/main/java/vacademy/io/admin_core_service/features/common/repository/CustomFieldRepository.java)
  - [InstituteCustomFieldRepository.java](vacademy_platform/admin_core_service/src/main/java/vacademy/io/admin_core_service/features/common/repository/InstituteCustomFieldRepository.java)
  - [CustomFieldValuesRepository.java](vacademy_platform/admin_core_service/src/main/java/vacademy/io/admin_core_service/features/common/repository/CustomFieldValuesRepository.java)
  - [SystemFieldCustomFieldMappingRepository.java](vacademy_platform/admin_core_service/src/main/java/vacademy/io/admin_core_service/features/common/repository/SystemFieldCustomFieldMappingRepository.java)
- Services / Managers
  - [InstituteCustomFiledService.java](vacademy_platform/admin_core_service/src/main/java/vacademy/io/admin_core_service/features/common/service/InstituteCustomFiledService.java)
  - [FieldSyncService.java](vacademy_platform/admin_core_service/src/main/java/vacademy/io/admin_core_service/features/common/service/FieldSyncService.java)
  - [SystemFieldMetadataService.java](vacademy_platform/admin_core_service/src/main/java/vacademy/io/admin_core_service/features/common/service/SystemFieldMetadataService.java)
  - [FieldMappingManager.java](vacademy_platform/admin_core_service/src/main/java/vacademy/io/admin_core_service/features/common/manager/FieldMappingManager.java)
  - [CustomFieldFilterService.java](vacademy_platform/admin_core_service/src/main/java/vacademy/io/admin_core_service/features/institute_learner/service/CustomFieldFilterService.java)
  - [InstituteSettingService.java](vacademy_platform/admin_core_service/src/main/java/vacademy/io/admin_core_service/features/institute/service/setting/InstituteSettingService.java) — `createDefaultCustomFieldSetting`
  - [InstituteSettingManager.java](vacademy_platform/admin_core_service/src/main/java/vacademy/io/admin_core_service/features/institute/manager/InstituteSettingManager.java)
- Controllers
  - [InstituteCustomFieldSettingController.java](vacademy_platform/admin_core_service/src/main/java/vacademy/io/admin_core_service/features/institute/controller/InstituteCustomFieldSettingController.java)
  - [FieldMappingController.java](vacademy_platform/admin_core_service/src/main/java/vacademy/io/admin_core_service/features/common/controller/FieldMappingController.java)
- DTOs
  - [CustomFieldSettingRequest.java](vacademy_platform/admin_core_service/src/main/java/vacademy/io/admin_core_service/features/institute/dto/settings/custom_field/CustomFieldSettingRequest.java)
  - [CustomFieldDto.java](vacademy_platform/admin_core_service/src/main/java/vacademy/io/admin_core_service/features/institute/dto/settings/custom_field/CustomFieldDto.java)
  - [CustomFieldUsageDTO.java](vacademy_platform/admin_core_service/src/main/java/vacademy/io/admin_core_service/features/institute/dto/settings/custom_field/CustomFieldUsageDTO.java)
  - [FixedFieldRenameDto.java](vacademy_platform/admin_core_service/src/main/java/vacademy/io/admin_core_service/features/institute/dto/settings/custom_field/FixedFieldRenameDto.java)
  - [SystemFieldCustomFieldMappingDTO.java](vacademy_platform/admin_core_service/src/main/java/vacademy/io/admin_core_service/features/common/dto/SystemFieldCustomFieldMappingDTO.java)
- Util
  - [CustomFieldKeyGenerator.java](vacademy_platform/admin_core_service/src/main/java/vacademy/io/admin_core_service/features/common/util/CustomFieldKeyGenerator.java)

**Frontend Admin (`Vacademy_Frontend/frontend-admin-dashboard`):**

- [src/components/settings/CustomFieldsSettings.tsx](../Vacademy_Frontend/frontend-admin-dashboard/src/components/settings/CustomFieldsSettings.tsx)
- [src/components/settings/SystemToCustomFieldMapping.tsx](../Vacademy_Frontend/frontend-admin-dashboard/src/components/settings/SystemToCustomFieldMapping.tsx)
- [src/services/custom-field-settings.ts](../Vacademy_Frontend/frontend-admin-dashboard/src/services/custom-field-settings.ts)
- [src/services/system-custom-field-mapping.ts](../Vacademy_Frontend/frontend-admin-dashboard/src/services/system-custom-field-mapping.ts)
- [src/services/student-list-section/enroll-manually.ts](../Vacademy_Frontend/frontend-admin-dashboard/src/services/student-list-section/enroll-manually.ts)
- [src/lib/custom-fields/utils.ts](../Vacademy_Frontend/frontend-admin-dashboard/src/lib/custom-fields/utils.ts)
- [src/routes/manage-students/invite/-components/create-invite/CreateInviteDialog.tsx](../Vacademy_Frontend/frontend-admin-dashboard/src/routes/manage-students/invite/-components/create-invite/CreateInviteDialog.tsx)
- [src/routes/manage-students/invite/-components/create-invite/CustomFieldsSection.tsx](../Vacademy_Frontend/frontend-admin-dashboard/src/routes/manage-students/invite/-components/create-invite/CustomFieldsSection.tsx)
- [src/routes/manage-students/invite/-components/create-invite/AddCustomFieldDialog.tsx](../Vacademy_Frontend/frontend-admin-dashboard/src/routes/manage-students/invite/-components/create-invite/AddCustomFieldDialog.tsx)
- [src/routes/manage-students/invite/-utils/getInviteListCustomFields.ts](../Vacademy_Frontend/frontend-admin-dashboard/src/routes/manage-students/invite/-utils/getInviteListCustomFields.ts)
- [src/routes/manage-students/invite/-schema/InviteFormSchema.tsx](../Vacademy_Frontend/frontend-admin-dashboard/src/routes/manage-students/invite/-schema/InviteFormSchema.tsx)
- [src/routes/audience-manager/list/-components/create-campaign-dialog/CreateCampaignForm.tsx](../Vacademy_Frontend/frontend-admin-dashboard/src/routes/audience-manager/list/-components/create-campaign-dialog/CreateCampaignForm.tsx)
- [src/routes/audience-manager/list/-components/create-campaign-dialog/CampaignCustomFieldsCard.tsx](../Vacademy_Frontend/frontend-admin-dashboard/src/routes/audience-manager/list/-components/create-campaign-dialog/CampaignCustomFieldsCard.tsx)
- [src/routes/audience-manager/list/-hooks/useCustomFieldSetup.ts](../Vacademy_Frontend/frontend-admin-dashboard/src/routes/audience-manager/list/-hooks/useCustomFieldSetup.ts)
- [src/routes/audience-manager/list/-services/get-custom-field-setup.ts](../Vacademy_Frontend/frontend-admin-dashboard/src/routes/audience-manager/list/-services/get-custom-field-setup.ts)
- [src/routes/audience-manager/list/-utils/getCampaignCustomFields.ts](../Vacademy_Frontend/frontend-admin-dashboard/src/routes/audience-manager/list/-utils/getCampaignCustomFields.ts)
- [src/routes/study-library/live-session/schedule/-components/scheduleStep2.tsx](../Vacademy_Frontend/frontend-admin-dashboard/src/routes/study-library/live-session/schedule/-components/scheduleStep2.tsx)
- [src/routes/assessment/create-assessment/$assessmentId/$examtype/-components/StepComponents/Step3AddingParticipants.tsx](../Vacademy_Frontend/frontend-admin-dashboard/src/routes/assessment/create-assessment/$assessmentId/$examtype/-components/StepComponents/Step3AddingParticipants.tsx)
- [src/components/design-system/utils/constants/custom-field-columns.tsx](../Vacademy_Frontend/frontend-admin-dashboard/src/components/design-system/utils/constants/custom-field-columns.tsx)

**Frontend Learner (`Vacademy_Frontend/frontend-learner-dashboard-app`):**

- [src/components/common/enroll-by-invite/enroll-form.tsx](../Vacademy_Frontend/frontend-learner-dashboard-app/src/components/common/enroll-by-invite/enroll-form.tsx)
- [src/components/common/enroll-by-invite/-components/registration-step.tsx](../Vacademy_Frontend/frontend-learner-dashboard-app/src/components/common/enroll-by-invite/-components/registration-step.tsx)
- [src/components/common/enroll-by-invite/-utils/custom-field-helpers.ts](../Vacademy_Frontend/frontend-learner-dashboard-app/src/components/common/enroll-by-invite/-utils/custom-field-helpers.ts)
- [src/components/common/enroll-by-invite/-services/enroll-invite-services.ts](../Vacademy_Frontend/frontend-learner-dashboard-app/src/components/common/enroll-by-invite/-services/enroll-invite-services.ts)
- [src/components/common/enroll-by-invite/-services/custom-fields-setup.ts](../Vacademy_Frontend/frontend-learner-dashboard-app/src/components/common/enroll-by-invite/-services/custom-fields-setup.ts)
- [src/routes/register/live-class/-hooks/useGetRegistrationFormData.ts](../Vacademy_Frontend/frontend-learner-dashboard-app/src/routes/register/live-class/-hooks/useGetRegistrationFormData.ts)
- [src/routes/register/live-class/-components/LiveClassRegistrationPage.tsx](../Vacademy_Frontend/frontend-learner-dashboard-app/src/routes/register/live-class/-components/LiveClassRegistrationPage.tsx)
- [src/routes/register/live-class/-components/RegistrationForm.tsx](../Vacademy_Frontend/frontend-learner-dashboard-app/src/routes/register/live-class/-components/RegistrationForm.tsx)
- [src/routes/register/live-class/-utils/helper.ts](../Vacademy_Frontend/frontend-learner-dashboard-app/src/routes/register/live-class/-utils/helper.ts)
- [src/routes/register/live-class/-types/registrationFormSchema.ts](../Vacademy_Frontend/frontend-learner-dashboard-app/src/routes/register/live-class/-types/registrationFormSchema.ts)
- [src/routes/register/live-class/-types/type.ts](../Vacademy_Frontend/frontend-learner-dashboard-app/src/routes/register/live-class/-types/type.ts)
- [src/routes/register/-component/AssessmentRegistrationForm.tsx](../Vacademy_Frontend/frontend-learner-dashboard-app/src/routes/register/-component/AssessmentRegistrationForm.tsx)
- [src/routes/register/-services/open-registration-services.ts](../Vacademy_Frontend/frontend-learner-dashboard-app/src/routes/register/-services/open-registration-services.ts)
- [src/routes/register/-utils/helper.ts](../Vacademy_Frontend/frontend-learner-dashboard-app/src/routes/register/-utils/helper.ts)
- [src/routes/$tagName/-services/custom-fields-service.ts](../Vacademy_Frontend/frontend-learner-dashboard-app/src/routes/$tagName/-services/custom-fields-service.ts)
- [src/routes/$tagName/-components/components/CheckoutForm.tsx](../Vacademy_Frontend/frontend-learner-dashboard-app/src/routes/$tagName/-components/components/CheckoutForm.tsx)
- [src/routes/enquiry-response/-components/enquiry-response-form.tsx](../Vacademy_Frontend/frontend-learner-dashboard-app/src/routes/enquiry-response/-components/enquiry-response-form.tsx)
