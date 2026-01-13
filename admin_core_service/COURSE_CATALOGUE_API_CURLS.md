# Course Catalogue API Curl Requests

Base URL: `http://localhost:8081/admin-core-service/v1/course-catalogue` (Adjust port/host as needed)

## 1. Create Catalogues

**Endpoint:** `POST /create`
**Description:** Creates new course catalogues for an institute.

**Request:**

```bash
curl --location 'http://localhost:8081/admin-core-service/v1/course-catalogue/create?instituteId={{instituteId}}' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer {{token}}' \
--data '{
    "catalogues": [
        {
            "catalogue_json": "{\"key\": \"value\"}",
            "tag_name": "Summer 2024",
            "status": "ACTIVE",
            "source": "INTERNAL",
            "source_id": "source_123",
            "is_default": true
        },
        {
            "catalogue_json": "{\"key\": \"another_value\"}",
            "tag_name": "Winter 2024",
            "status": "DRAFT",
            "source": "EXTERNAL",
            "source_id": "source_456",
            "is_default": false
        }
    ]
}'
```

**Response:**

```json
[
  {
    "id": "catalogue_uuid_1",
    "catalogue_json": "{\"key\": \"value\"}",
    "tag_name": "Summer 2024",
    "status": "ACTIVE",
    "source": "INTERNAL",
    "source_id": "source_123",
    "institute_id": "institute_123",
    "is_default": true
  },
  {
    "id": "catalogue_uuid_2",
    "catalogue_json": "{\"key\": \"another_value\"}",
    "tag_name": "Winter 2024",
    "status": "DRAFT",
    "source": "EXTERNAL",
    "source_id": "source_456",
    "institute_id": "institute_123",
    "is_default": false
  }
]
```

## 2. Update Catalogue

**Endpoint:** `PUT /update`
**Description:** Updates an existing course catalogue.

**Request:**

```bash
curl --location 'http://localhost:8081/admin-core-service/v1/course-catalogue/update?catalogueId={{catalogueId}}' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer {{token}}' \
--data '{
    "catalogue_json": "{\"updated_key\": \"updated_value\"}",
    "tag_name": "Updated Tag Name",
    "status": "ARCHIVED",
    "source": "INTERNAL",
    "source_id": "source_123",
    "is_default": false
}'
```

**Response:**

```json
{
  "id": "catalogue_uuid_1",
  "catalogue_json": "{\"updated_key\": \"updated_value\"}",
  "tag_name": "Updated Tag Name",
  "status": "ARCHIVED",
  "source": "INTERNAL",
  "source_id": "source_123",
  "institute_id": "institute_123",
  "is_default": false
}
```

## 3. Get All Catalogues for Institute

**Endpoint:** `GET /institute/get-all`
**Description:** Retrieves all catalogues associated with an institute.

**Request:**

```bash
curl --location 'http://localhost:8081/admin-core-service/v1/course-catalogue/institute/get-all?instituteId={{instituteId}}' \
--header 'Authorization: Bearer {{token}}'
```

**Response:**

```json
[
  {
    "id": "catalogue_uuid_1",
    "catalogue_json": "{\"key\": \"value\"}",
    "tag_name": "Summer 2024",
    "status": "ACTIVE",
    "source": "INTERNAL",
    "source_id": "source_123",
    "institute_id": "institute_123",
    "is_default": true
  },
  {
    "id": "catalogue_uuid_2",
    "catalogue_json": "{\"key\": \"another_value\"}",
    "tag_name": "Winter 2024",
    "status": "DRAFT",
    "source": "EXTERNAL",
    "source_id": "source_456",
    "institute_id": "institute_123",
    "is_default": false
  }
]
```

## 4. Get Catalogues by Source

**Endpoint:** `GET /institute/source`
**Description:** Retrieves catalogues filtered by source and source ID.

**Request:**

```bash
curl --location 'http://localhost:8081/admin-core-service/v1/course-catalogue/institute/source?instituteId={{instituteId}}&source=INTERNAL&sourceId={{sourceId}}' \
--header 'Authorization: Bearer {{token}}'
```

**Response:**

```json
[
  {
    "id": "catalogue_uuid_1",
    "catalogue_json": "{\"key\": \"value\"}",
    "tag_name": "Summer 2024",
    "status": "ACTIVE",
    "source": "INTERNAL",
    "source_id": "source_123",
    "institute_id": "institute_123",
    "is_default": true
  }
]
```

## 5. Get Default Catalogue

**Endpoint:** `GET /institute/default`
**Description:** Retrieves the default catalogue for an institute.

**Request:**

```bash
curl --location 'http://localhost:8081/admin-core-service/v1/course-catalogue/institute/default?instituteId={{instituteId}}' \
--header 'Authorization: Bearer {{token}}'
```

**Response:**

```json
{
  "id": "catalogue_uuid_1",
  "catalogue_json": "{\"key\": \"value\"}",
  "tag_name": "Summer 2024",
  "status": "ACTIVE",
  "source": "INTERNAL",
  "source_id": "source_123",
  "institute_id": "institute_123",
  "is_default": true
}
```

## 6. Get Catalogue by Tag

**Endpoint:** `GET /institute/get/by-tag`
**Description:** Retrieves a specific catalogue by its tag name.

**Request:**

```bash
curl --location 'http://localhost:8081/admin-core-service/v1/course-catalogue/institute/get/by-tag?instituteId={{instituteId}}&tagName={{tagName}}' \
--header 'Authorization: Bearer {{token}}'
```

**Response:**

```json
{
  "id": "catalogue_uuid_1",
  "catalogue_json": "{\"key\": \"value\"}",
  "tag_name": "Summer 2024",
  "status": "ACTIVE",
  "source": "INTERNAL",
  "source_id": "source_123",
  "institute_id": "institute_123",
  "is_default": true
}
```

---

**Note:** Replace `{{baseUrl}}`, `{{token}}`, `{{instituteId}}`, `{{catalogueId}}`, `{{sourceId}}`, and `{{tagName}}` with actual values.
