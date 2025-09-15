# Template Implementation for Email and WhatsApp Notifications

This document describes the implementation of the template system for email and WhatsApp notifications in the admin_core_service institute module.

## Overview

The template system allows institutes to create, manage, and use multiple templates for different types of notifications (email, WhatsApp, SMS, etc.). Templates can be customized with variables and settings specific to each institute and vendor.

## Database Schema

### Templates Table

The `templates` table stores all notification templates with the following structure:

| Field | Type | Description |
|-------|------|-------------|
| `id` | VARCHAR(36) | Primary key (UUID) |
| `type` | VARCHAR(50) | Template type (EMAIL, WHATSAPP, SMS, etc.) |
| `vendor_id` | VARCHAR(36) | Vendor ID for vendor-specific templates |
| `institute_id` | VARCHAR(36) | Institute ID this template belongs to |
| `name` | VARCHAR(255) | Template name (unique per institute) |
| `subject` | VARCHAR(500) | Email subject line or notification title |
| `content` | TEXT | Template content/body |
| `content_type` | VARCHAR(50) | Content type (HTML, TEXT, JSON, etc.) |
| `setting_json` | TEXT | Additional settings in JSON format |
| `can_delete` | BOOLEAN | Whether this template can be deleted |
| `created_at` | TIMESTAMP | Creation timestamp |
| `updated_at` | TIMESTAMP | Last update timestamp |
| `created_by` | VARCHAR(36) | User ID who created this template |
| `updated_by` | VARCHAR(36) | User ID who last updated this template |

### Indexes

- `idx_templates_institute_id` - For filtering by institute
- `idx_templates_type` - For filtering by template type
- `idx_templates_vendor_id` - For filtering by vendor
- `idx_templates_institute_type` - Composite index for institute + type queries
- `idx_templates_institute_type_vendor` - Composite index for institute + type + vendor queries
- `idx_templates_name` - For name-based searches
- `idx_templates_created_at` - For sorting by creation date
- `idx_templates_can_delete` - For filtering by deletion capability
- `idx_templates_institute_name_unique` - Unique constraint on institute + name

## API Endpoints

### Base URL
```
/admin-core-service/institute/template/v1
```

### Endpoints

#### 1. Create Template
- **POST** `/create`
- **Body**: `TemplateRequest`
- **Response**: `TemplateResponse`
- **Description**: Creates a new template for an institute

#### 2. Update Template
- **PUT** `/update`
- **Body**: `TemplateUpdateRequest`
- **Response**: `TemplateResponse`
- **Description**: Updates an existing template

#### 3. Get Template by ID
- **GET** `/{id}`
- **Response**: `TemplateResponse`
- **Description**: Retrieves a specific template by its ID

#### 4. Get Templates by Institute
- **GET** `/institute/{instituteId}`
- **Response**: `List<TemplateResponse>`
- **Description**: Retrieves all templates for a specific institute

#### 5. Get Templates by Institute and Type
- **GET** `/institute/{instituteId}/type/{type}`
- **Response**: `List<TemplateResponse>`
- **Description**: Retrieves templates filtered by institute and type

#### 6. Get Templates by Institute, Type, and Vendor
- **GET** `/institute/{instituteId}/type/{type}/vendor/{vendorId}`
- **Response**: `List<TemplateResponse>`
- **Description**: Retrieves templates filtered by institute, type, and vendor

#### 7. Search Templates
- **POST** `/search`
- **Body**: `TemplateSearchRequest`
- **Response**: `List<TemplateResponse>`
- **Description**: Advanced search with multiple filters

#### 8. Delete Template
- **DELETE** `/{id}`
- **Response**: `Map<String, String>`
- **Description**: Deletes a template (only if can_delete is true)

#### 9. Get Template Count by Institute and Type
- **GET** `/count/institute/{instituteId}/type/{type}`
- **Response**: `Map<String, Long>`
- **Description**: Returns count of templates for institute and type

#### 10. Get Template Count by Institute
- **GET** `/count/institute/{instituteId}`
- **Response**: `Map<String, Long>`
- **Description**: Returns total count of templates for institute

#### 11. Check Template Existence
- **GET** `/exists/institute/{instituteId}/name/{name}`
- **Response**: `Map<String, Boolean>`
- **Description**: Checks if a template name exists for an institute

## DTOs

### TemplateRequest
```java
{
    "type": "EMAIL",
    "vendorId": "vendor-123",
    "instituteId": "institute-456",
    "name": "Welcome Email Template",
    "subject": "Welcome to {{institute_name}}!",
    "content": "<h1>Welcome {{student_name}}!</h1>",
    "contentType": "HTML",
    "settingJson": "{\"from_email\": \"noreply@{{institute_domain}}\"}",
    "canDelete": true
}
```

### TemplateResponse
```java
{
    "id": "template-123",
    "type": "EMAIL",
    "vendorId": "vendor-123",
    "instituteId": "institute-456",
    "name": "Welcome Email Template",
    "subject": "Welcome to {{institute_name}}!",
    "content": "<h1>Welcome {{student_name}}!</h1>",
    "contentType": "HTML",
    "settingJson": "{\"from_email\": \"noreply@{{institute_domain}}\"}",
    "canDelete": true,
    "createdAt": "2024-12-01T10:00:00",
    "updatedAt": "2024-12-01T10:00:00",
    "createdBy": "user-789",
    "updatedBy": "user-789"
}
```

### TemplateSearchRequest
```java
{
    "instituteId": "institute-456",
    "type": "EMAIL",
    "vendorId": "vendor-123",
    "searchText": "welcome",
    "canDelete": true,
    "contentType": "HTML",
    "page": 0,
    "size": 20,
    "sortBy": "createdAt",
    "sortDirection": "DESC"
}
```

## Usage Examples

### 1. Creating an Email Template
```bash
curl -X POST "http://localhost:8080/admin-core-service/institute/template/v1/create" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "type": "EMAIL",
    "instituteId": "institute-123",
    "name": "Welcome Email",
    "subject": "Welcome to {{institute_name}}!",
    "content": "<h1>Welcome {{student_name}}!</h1><p>Welcome to {{institute_name}}.</p>",
    "contentType": "HTML",
    "settingJson": "{\"from_email\": \"noreply@{{institute_domain}}\"}"
  }'
```

### 2. Creating a WhatsApp Template
```bash
curl -X POST "http://localhost:8080/admin-core-service/institute/template/v1/create" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "type": "WHATSAPP",
    "instituteId": "institute-123",
    "name": "Class Reminder",
    "subject": "Class Reminder - {{class_name}}",
    "content": "Hi {{student_name}}! Your class {{class_name}} is at {{class_time}} on {{class_date}}.",
    "contentType": "TEXT",
    "settingJson": "{\"template_id\": \"class_reminder_001\", \"language\": \"en\"}"
  }'
```

### 3. Searching Templates
```bash
curl -X POST "http://localhost:8080/admin-core-service/institute/template/v1/search" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "instituteId": "institute-123",
    "type": "EMAIL",
    "searchText": "welcome"
  }'
```

## Template Variables

Templates support variable substitution using the `{{variable_name}}` syntax. Common variables include:

- `{{student_name}}` - Student's name
- `{{institute_name}}` - Institute name
- `{{institute_domain}}` - Institute domain
- `{{course_name}}` - Course name
- `{{class_name}}` - Class name
- `{{class_time}}` - Class time
- `{{class_date}}` - Class date
- `{{assignment_name}}` - Assignment name
- `{{due_date}}` - Due date
- `{{amount}}` - Payment amount

## Features

### 1. Multi-Tenant Support
- Templates are scoped to institutes
- Each institute can have its own set of templates
- Template names must be unique within an institute

### 2. Vendor Support
- Templates can be associated with specific vendors
- Useful for vendor-specific notification requirements

### 3. Flexible Content Types
- Support for HTML, TEXT, JSON, and other content types
- Content can include variable placeholders

### 4. Rich Settings
- Additional settings stored as JSON
- Can include subject lines, sender information, etc.

### 5. Deletion Control
- Templates can be marked as non-deletable
- Useful for system templates or critical templates

### 6. Search and Filtering
- Advanced search capabilities
- Filter by type, vendor, content type, etc.
- Text search in name and content

### 7. Audit Trail
- Track who created and last updated each template
- Timestamps for creation and updates

## Migration

To set up the templates table, run the migration script:

```sql
-- Run the migration script
source vacademy_platform/admin_core_service/templates_migration.sql
```

Or use the Flyway migration:

```sql
-- The migration is automatically applied if using Flyway
-- File: V20241201_001__Create_Templates_Table.sql
```

## Security Considerations

1. **Authentication**: All endpoints require valid user authentication
2. **Authorization**: Users can only access templates for institutes they have access to
3. **Input Validation**: All inputs are validated using Jakarta validation annotations
4. **SQL Injection**: Uses JPA repositories to prevent SQL injection
5. **XSS Prevention**: Content should be sanitized when displaying templates

## Error Handling

The service includes comprehensive error handling:

- **Validation Errors**: Returns 400 Bad Request for invalid input
- **Not Found**: Returns 404 for non-existent templates
- **Duplicate Names**: Returns 400 for duplicate template names
- **Deletion Errors**: Returns 400 for templates that cannot be deleted
- **Server Errors**: Returns 500 for unexpected errors

## Logging

All operations are logged with appropriate log levels:

- **INFO**: Normal operations (create, update, delete, search)
- **ERROR**: Error conditions and exceptions
- **DEBUG**: Detailed debugging information (if enabled)

## Future Enhancements

1. **Template Versioning**: Track template versions and changes
2. **Template Categories**: Group templates by categories
3. **Template Inheritance**: Base templates with overrides
4. **Template Testing**: Test templates with sample data
5. **Template Analytics**: Usage statistics and metrics
6. **Template Import/Export**: Bulk operations for templates
7. **Template Validation**: Validate template syntax and variables
8. **Template Preview**: Preview templates before saving
