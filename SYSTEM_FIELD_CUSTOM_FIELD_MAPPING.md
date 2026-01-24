# System Field ↔ Custom Field Mapping

## Overview

This feature allows institutes to **link system fields** (database columns like `Student.fullName`) with **custom fields** (dynamic fields created by the institute). When data changes in one, it automatically syncs to the other.

### Use Cases

1. **Form to Database Sync**: A custom field "Student Name" on a registration form automatically updates `Student.fullName` in the database
2. **Database to Form Sync**: When admin updates student's name in the system, the custom field value updates too
3. **Data Consistency**: Keep custom field values in sync with structured entity data

---

## API Endpoints

Base URL: `/admin-core-service/common/field-mapping`

### 1. Get Supported Entity Types

Returns list of entities that support field mapping.

```http
GET /entity-types
```

**Response:**
```json
["STUDENT"]
```

---

### 2. Get Available System Fields

Returns all system fields for an entity type that can be mapped.

```http
GET /available-fields?instituteId={instituteId}&entityType={entityType}
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| instituteId | string | Yes | Institute ID |
| entityType | string | Yes | Entity type (e.g., `STUDENT`) |

**Response:**
```json
[
  {
    "entityType": "STUDENT",
    "fieldName": "full_name",
    "displayName": "Full Name",
    "fieldType": "TEXT",
    "isMapped": true,
    "mappedCustomFieldId": "cf-123-uuid"
  },
  {
    "entityType": "STUDENT",
    "fieldName": "email",
    "displayName": "Email",
    "fieldType": "TEXT",
    "isMapped": false,
    "mappedCustomFieldId": null
  },
  {
    "entityType": "STUDENT",
    "fieldName": "mobile_number",
    "displayName": "Mobile Number",
    "fieldType": "TEXT",
    "isMapped": false,
    "mappedCustomFieldId": null
  },
  {
    "entityType": "STUDENT",
    "fieldName": "date_of_birth",
    "displayName": "Date of Birth",
    "fieldType": "DATE",
    "isMapped": false,
    "mappedCustomFieldId": null
  }
]
```

**Available Student Fields:**
| Field Name | Display Name | Type |
|------------|--------------|------|
| `full_name` | Full Name | TEXT |
| `email` | Email | TEXT |
| `mobile_number` | Mobile Number | TEXT |
| `username` | Username | TEXT |
| `address_line` | Address | TEXT |
| `city` | City | TEXT |
| `region` | Region/State | TEXT |
| `pin_code` | PIN Code | TEXT |
| `date_of_birth` | Date of Birth | DATE |
| `gender` | Gender | TEXT |
| `fathers_name` | Father's Name | TEXT |
| `mothers_name` | Mother's Name | TEXT |
| `parents_mobile_number` | Parent's Mobile | TEXT |
| `parents_email` | Parent's Email | TEXT |
| `linked_institute_name` | Linked Institute | TEXT |

---

### 3. Get Existing Mappings

Returns all active mappings for an institute and entity type.

```http
GET /?instituteId={instituteId}&entityType={entityType}
```

**Response:**
```json
[
  {
    "id": "mapping-uuid-123",
    "instituteId": "inst-uuid",
    "entityType": "STUDENT",
    "systemFieldName": "full_name",
    "customFieldId": "cf-uuid-456",
    "customFieldName": "Student Name",
    "syncDirection": "BIDIRECTIONAL",
    "converterClass": null,
    "status": "ACTIVE"
  }
]
```

---

### 4. Create Mapping

Creates a new mapping between a system field and custom field.

```http
POST /
Content-Type: application/json
```

**Request Body:**
```json
{
  "instituteId": "inst-uuid",
  "entityType": "STUDENT",
  "systemFieldName": "full_name",
  "customFieldId": "cf-uuid-456",
  "syncDirection": "BIDIRECTIONAL"
}
```

**Sync Direction Options:**
| Value | Description |
|-------|-------------|
| `BIDIRECTIONAL` | Changes sync both ways (default) |
| `TO_SYSTEM` | Custom field → System field only |
| `TO_CUSTOM` | System field → Custom field only |
| `NONE` | No automatic sync (manual only) |

**Response:**
```json
{
  "id": "mapping-uuid-123",
  "instituteId": "inst-uuid",
  "entityType": "STUDENT",
  "systemFieldName": "full_name",
  "customFieldId": "cf-uuid-456",
  "customFieldName": "Student Name",
  "syncDirection": "BIDIRECTIONAL",
  "converterClass": null,
  "status": "ACTIVE"
}
```

---

### 5. Update Mapping

Updates sync direction or status of an existing mapping.

```http
PUT /{mappingId}
Content-Type: application/json
```

**Request Body:**
```json
{
  "syncDirection": "TO_SYSTEM",
  "status": "ACTIVE"
}
```

---

### 6. Delete Mapping

Soft deletes a mapping.

```http
DELETE /{mappingId}
```

**Response:**
```json
"Mapping deleted successfully"
```

---

### 7. Manual Sync: System → Custom

Manually triggers sync from system fields to custom fields for a specific entity.

```http
POST /sync/system-to-custom?instituteId={instituteId}&entityType={entityType}&entityId={entityId}
```

**Use Case:** Initial population of custom fields from existing student data.

---

### 8. Manual Sync: Custom → System

Manually triggers sync from custom fields to system fields for a specific entity.

```http
POST /sync/custom-to-system?instituteId={instituteId}&entityType={entityType}&entityId={entityId}
```

**Use Case:** Populate student record from form submission data.

---

## Frontend UI Guide

### Mapping Configuration Screen

```
┌─────────────────────────────────────────────────────────────────┐
│  Field Mapping Configuration                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Entity Type: [STUDENT ▼]                                        │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ System Field      │ Custom Field       │ Sync Direction   │  │
│  ├───────────────────┼────────────────────┼──────────────────┤  │
│  │ Full Name         │ [Student Name ▼]   │ [Bidirectional▼] │  │
│  │ ✓ Mapped          │                    │ [Delete]         │  │
│  ├───────────────────┼────────────────────┼──────────────────┤  │
│  │ Email             │ [Select Field ▼]   │ [Bidirectional▼] │  │
│  │ ○ Not Mapped      │                    │ [+ Add]          │  │
│  ├───────────────────┼────────────────────┼──────────────────┤  │
│  │ Mobile Number     │ [Phone ▼]          │ [To System ▼]    │  │
│  │ ✓ Mapped          │                    │ [Delete]         │  │
│  └───────────────────┴────────────────────┴──────────────────┘  │
│                                                                  │
│  [Save Changes]                                                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Implementation Steps

1. **Load Entity Types**
   ```javascript
   const entityTypes = await fetch('/field-mapping/entity-types');
   // Populate dropdown
   ```

2. **Load Available Fields** (when entity type selected)
   ```javascript
   const fields = await fetch(`/field-mapping/available-fields?instituteId=${id}&entityType=STUDENT`);
   // Display table with mapping status
   ```

3. **Load Custom Fields** (for dropdown)
   ```javascript
   const customFields = await fetch(`/common/custom-fields?instituteId=${id}`);
   // Populate custom field dropdowns
   ```

4. **Create Mapping** (when user selects custom field)
   ```javascript
   await fetch('/field-mapping', {
     method: 'POST',
     body: JSON.stringify({
       instituteId,
       entityType: 'STUDENT',
       systemFieldName: 'full_name',
       customFieldId: selectedCustomFieldId,
       syncDirection: 'BIDIRECTIONAL'
     })
   });
   ```

---

## Data Flow Diagram

```
                    ┌─────────────────────┐
                    │   Admin Creates     │
                    │      Mapping        │
                    └──────────┬──────────┘
                               │
                               ▼
              ┌────────────────────────────────┐
              │  system_field_custom_field_    │
              │         mapping table          │
              │  ┌──────────────────────────┐  │
              │  │ STUDENT.full_name ↔      │  │
              │  │ CustomField "Name"       │  │
              │  │ Direction: BIDIRECTIONAL │  │
              │  └──────────────────────────┘  │
              └────────────────────────────────┘
                               │
           ┌───────────────────┴───────────────────┐
           │                                       │
           ▼                                       ▼
┌─────────────────────┐                 ┌─────────────────────┐
│  Custom Field       │                 │  System Field       │
│  Value Updated      │                 │  Updated            │
│  (form submission)  │                 │  (admin edit)       │
└──────────┬──────────┘                 └──────────┬──────────┘
           │                                       │
           ▼                                       ▼
┌─────────────────────┐                 ┌─────────────────────┐
│  FieldSyncService   │                 │  FieldSyncService   │
│  syncCustomField    │                 │  syncSystemField    │
│  ToSystemField()    │                 │  ToCustomField()    │
└──────────┬──────────┘                 └──────────┬──────────┘
           │                                       │
           ▼                                       ▼
┌─────────────────────┐                 ┌─────────────────────┐
│  Student.fullName   │                 │  custom_field_values│
│  updated in DB      │                 │  updated in DB      │
└─────────────────────┘                 └─────────────────────┘
```

---

## Error Handling

| Error | HTTP Status | Message |
|-------|-------------|---------|
| Missing institute ID | 400 | "Institute ID is required" |
| Missing entity type | 400 | "Entity type is required" |
| Missing system field | 400 | "System field name is required" |
| Missing custom field | 400 | "Custom field ID is required" |
| Duplicate mapping | 400 | "This mapping already exists" |
| Custom field not found | 400 | "Custom field not found: {id}" |
| Mapping not found | 400 | "Mapping not found: {id}" |

---

## Notes

- **Sync is automatic** once a mapping is created (no additional API calls needed)
- **Loop prevention** is built-in - updating a synced field won't cause infinite loops
- **Old institutes are not affected** - mappings must be explicitly created
- **Soft delete** - deleted mappings can be restored if needed
