# Testing Guide for Workflow Diagram API

## Quick Test

### 1. Start the Application

```bash
cd admin_core_service
mvn spring-boot:run
```

### 2. Test the API

Replace `YOUR_BEARER_TOKEN` with your actual authentication token:

```bash
curl --location 'http://localhost:8080/admin-core-service/v1/automations/wf_ld_sync_on_enrollment/diagram' \
--header 'accept: application/json, text/plain, */*' \
--header 'authorization: Bearer YOUR_BEARER_TOKEN'
```

### 3. Expected Response Structure

The API should return a response similar to:

```json
{
  "nodes": [
    {
      "id": "nt_ld_sync_init",
      "title": "Workflow Trigger",
      "description": "The workflow starts here, preparing the initial data.",
      "type": "TRIGGER",
      "details": {
        "Learndash Config": {...},
        "Admin Emails": [...],
        "Vacademy To Learndash Course Map": {...}
      }
    },
    {
      "id": "nt_ld_sync_extract_user_id",
      "title": "Transform Data",
      "description": "Transforms data by computing: Learndash User Id",
      "type": "TRANSFORM",
      "details": {
        "Transformations": {
          "Learndash User Id": "..."
        }
      }
    },
    {
      "id": "nt_ld_sync_create_user_http",
      "title": "Create User",
      "type": "HTTP_REQUEST",
      "description": "Performs an HTTP POST request to external API",
      "details": {
        "Method": "POST",
        "URL": "...",
        "Request Type": "EXTERNAL"
      }
    },
    {
      "id": "nt_ld_sync_find_user_http",
      "title": "Find User",
      "type": "HTTP_REQUEST",
      "description": "Performs an HTTP GET request to external API",
      "details": {
        "Method": "GET",
        "URL": "..."
      }
    }
  ],
  "edges": [
    {
      "id": "nt_ld_sync_init->nt_ld_sync_prepare_list_0",
      "sourceNodeId": "nt_ld_sync_init",
      "targetNodeId": "nt_ld_sync_prepare_list",
      "label": "Next"
    }
  ]
}
```

## Validation Checklist

✅ **Node Types are Correct**

-   `nt_ld_sync_init` → `TRIGGER`
-   `nt_ld_sync_extract_user_id` → `TRANSFORM`
-   `nt_ld_sync_create_user_http` → `HTTP_REQUEST`
-   `nt_ld_sync_find_user_http` → `HTTP_REQUEST`
-   `nt_ld_sync_get_course_details_http` → `HTTP_REQUEST`
-   `nt_ld_sync_enroll_courses_iterator_http` → `ACTION`

✅ **No Duplicate Nodes**

-   Each node should appear only once
-   All node IDs should be unique

✅ **All Nodes Have Valid Types**

-   No nodes with type `UNKNOWN` (unless genuinely unrecognized)
-   Each node has a proper title and description

✅ **Edges Reference Valid Nodes**

-   All `sourceNodeId` and `targetNodeId` should match existing node IDs
-   Edges should have descriptive labels

## Common Issues & Solutions

### Issue 1: Nodes Show as "UNKNOWN"

**Cause**: The node configuration doesn't match any parser

**Solution**: Check the node's JSON configuration in the database. Ensure it has the expected structure.

### Issue 2: Multiple Nodes with Same ID

**Cause**: The workflow references the same template multiple times

**Solution**: This should now be fixed - each node mapping gets a unique ID

### Issue 3: Wrong Node Type

**Cause**: Parser priority or detection logic is incorrect

**Solution**: Check the `@Order` annotations and `canParse()` logic

## Testing Different Workflows

Test with other workflow IDs to ensure the parser works correctly:

```bash
# Test with different workflow
curl --location 'http://localhost:8080/admin-core-service/v1/automations/YOUR_WORKFLOW_ID/diagram' \
--header 'authorization: Bearer YOUR_TOKEN'
```

## Performance Testing

For large workflows with 50+ nodes:

```bash
time curl --location 'http://localhost:8080/admin-core-service/v1/automations/large_workflow_id/diagram' \
--header 'authorization: Bearer YOUR_TOKEN'
```

Expected response time: < 2 seconds

## Debugging

If issues occur, check the logs:

```bash
tail -f logs/application.log | grep "AutomationParser"
```

Key log lines to look for:

-   `AutomationParserService.parse()` - Shows parsing progress
-   `StepParserRegistry.getParser()` - Shows which parser was selected
-   Parser class names - Shows which parser handled each node
