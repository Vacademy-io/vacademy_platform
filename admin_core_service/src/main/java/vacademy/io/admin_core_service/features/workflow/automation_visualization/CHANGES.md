# Workflow Diagram API Fixes

## Summary of Changes

This document outlines the fixes applied to the workflow diagram visualization API to correctly display node types and ensure unique nodes are returned.

## Issues Fixed

### 1. **Missing Node Type Parsers**

**Problem**: HTTP_REQUEST and TRANSFORM nodes were being displayed as "UNKNOWN" or incorrectly classified as "TRIGGER" nodes.

**Solution**: Created two new parsers:

-   `HttpRequestStepParser.java` - Identifies and parses HTTP_REQUEST nodes
-   `TransformStepParser.java` - Identifies and parses TRANSFORM nodes

### 2. **Parser Priority Issues**

**Problem**: Multiple parsers could match the same node (e.g., TRIGGER and TRANSFORM both have `outputDataPoints`), causing incorrect classification.

**Solution**:

-   Added `@Order` annotations to all parsers to establish a clear priority
-   Priority order (lower number = higher priority):
    1. TransformStepParser (Order 1)
    2. HttpRequestStepParser (Order 2)
    3. DataProcessorStepParser (Order 3)
    4. QueryStepParser (Order 4)
    5. ActionStepParser (Order 5)
    6. TriggerStepParser (Order 10) - Last resort for configuration nodes

### 3. **Improved Parser Detection Logic**

#### TransformStepParser

-   Detects nodes with `outputDataPoints` that have `compute` expressions
-   Distinguished from TRIGGER nodes by having routing or fewer output points
-   Example: `nt_ld_sync_extract_user_id`

#### HttpRequestStepParser

-   Detects nodes with a `config` object containing `url` or `method` fields
-   Provides descriptive titles based on the URL pattern
-   Examples: `nt_ld_sync_find_user_http`, `nt_ld_sync_create_user_http`

#### TriggerStepParser (Updated)

-   Now only matches nodes with:
    -   More than 2 output data points AND no routing, OR
    -   Output fields with `value` instead of `compute` (configuration-style)
-   Example: `nt_ld_sync_init`

### 4. **Duplicate Nodes Issue**

**Problem**: When the same template was used multiple times in a workflow, only one instance appeared in the diagram.

**Solution**:

-   Changed the controller to use `WorkflowNodeMapping::getId` instead of `WorkflowNodeMapping::getNodeTemplateId` as the key
-   This ensures each node mapping instance is treated as a unique node
-   Added deduplication logic in `AutomationParserService` using LinkedHashMap to ensure unique nodes by ID

### 5. **Node Deduplication**

**Problem**: Multiple references to the same node could create duplicates in the output.

**Solution**:

-   Modified `AutomationParserService.parse()` to use a `LinkedHashMap<String, Node>` instead of a `List<Node>`
-   Ensures that each node ID only appears once in the final output

## Node Type Classification

The API now correctly identifies and returns the following node types:

| Node Type    | Identifier                                    | Description                        |
| ------------ | --------------------------------------------- | ---------------------------------- |
| TRIGGER      | `outputDataPoints` with `value` fields        | Configuration/initialization nodes |
| TRANSFORM    | `outputDataPoints` with `compute` expressions | Data transformation nodes          |
| HTTP_REQUEST | `config` with `url`/`method`                  | External/Internal API calls        |
| ACTION       | `dataProcessor` or `forEach` with operations  | Data processing iterations         |
| QUERY        | `prebuiltKey`                                 | Database query nodes               |
| EMAIL        | `forEach` with `SEND_EMAIL` operation         | Email sending nodes                |
| DECISION     | `forEach` with `SWITCH` operation             | Conditional branching              |

## Example Workflow Response

For the workflow `wf_ld_sync_on_enrollment`, the API now correctly returns:

```json
{
  "nodes": [
    {
      "id": "nt_ld_sync_init",
      "title": "Workflow Trigger",
      "type": "TRIGGER",
      "description": "The workflow starts here, preparing the initial data.",
      "details": { "Learndash Config": {...}, "Admin Emails": [...] }
    },
    {
      "id": "nt_ld_sync_extract_user_id",
      "title": "Transform Data",
      "type": "TRANSFORM",
      "description": "Transforms data by computing: Learndash User Id",
      "details": { "Transformations": {...} }
    },
    {
      "id": "nt_ld_sync_create_user_http",
      "title": "Create User",
      "type": "HTTP_REQUEST",
      "description": "Performs an HTTP POST request to external API",
      "details": { "Method": "POST", "URL": "..." }
    },
    {
      "id": "nt_ld_sync_find_user_http",
      "title": "Find User",
      "type": "HTTP_REQUEST",
      "description": "Performs an HTTP GET request to external API",
      "details": { "Method": "GET", "URL": "..." }
    }
  ],
  "edges": [...]
}
```

## Testing

To test the fixes:

1. **Start the application**

    ```bash
    mvn spring-boot:run
    ```

2. **Call the diagram API**

    ```bash
    curl --location 'http://localhost:8080/admin-core-service/v1/automations/wf_ld_sync_on_enrollment/diagram' \
    --header 'Authorization: Bearer YOUR_TOKEN'
    ```

3. **Verify the response**
    - Each node should have a unique ID
    - Node types should be correct (TRIGGER, TRANSFORM, HTTP_REQUEST, etc.)
    - No duplicate nodes should appear
    - All edges should reference valid node IDs

## Files Modified

1. **New Files Created**:

    - `HttpRequestStepParser.java` - HTTP request node parser
    - `TransformStepParser.java` - Transform node parser

2. **Modified Files**:
    - `AutomationVisualizationController.java` - Fixed duplicate node issue
    - `AutomationParserService.java` - Added deduplication logic
    - `TriggerStepParser.java` - Improved detection logic
    - `DataProcessorStepParser.java` - Added @Order annotation
    - `QueryStepParser.java` - Added @Order annotation
    - `ActionStepParser.java` - Added @Order annotation

## Compatibility

-   These changes are **backward compatible**
-   Existing workflows will continue to work
-   No database schema changes required
-   No breaking changes to the API response format

## Notes for Client Demo

-   The API now correctly distinguishes between configuration (TRIGGER), transformation (TRANSFORM), and integration (HTTP_REQUEST) nodes
-   All nodes are guaranteed to be unique by their ID
-   The workflow visualization will accurately represent the execution flow
-   Node descriptions and details provide clear context about each step
