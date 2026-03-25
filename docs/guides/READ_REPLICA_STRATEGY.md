# Read Replica Strategy & Implementation Guide

This document outlines the strategy for utilizing Read Replicas across the Vacademy Platform services to scale database reads and improve performance.

## Architecture Overview

We have implemented a **Router-based Database Architecture** using Spring's `AbstractRoutingDataSource`.

1.  **Main Application**: Connects to a `RoutingDataSource` proxy.
2.  **Routing Logic**:
    - **Default**: Routes query to **Master DB** (Write/Read).
    - **Read-Only Context**: Routes query to **Read Replica DB** (Read Only).

## How to Route Queries

The routing is controlled entirely by the **`@Transactional`** annotation.

### 1. Default Behavior (Master DB)

If you do nothing, or use `@Transactional`, the query goes to the **Master DB**.
Use this for:

- All **Writes** (INSERT, UPDATE, DELETE).
- **Critical Reads** (e.g., reading a record immediately after writing it to ensure consistency).

### 2. Route to Read Replica

To route a specific service method or query to the Read Replica, simply annotate the method (or class) with:

```java
@Transactional(readOnly = true)
public List<User> getAllUsers() {
    return userRepository.findAll();
}
```

## Planning Stage 2: Migration Strategy

For **Stage 2**, we recommend a gradual migration of heavy read operations. We should not blindly move all reads to the replica due to potential **Replication Lag** (usually milliseconds, but can be higher).

### Categories of Queries to Migrate

| Query Type                  | Typical Use Case                                   | Recommended Target | Why?                                                                     |
| :-------------------------- | :------------------------------------------------- | :----------------- | :----------------------------------------------------------------------- |
| **Heavy Reporting**         | Admin Dashboards, Analytics, Monthly Reports       | **Read Replica**   | Prevents long-running queries from locking the Master DB.                |
| **Public Feeds/Lists**      | "All Courses", "Community Posts", "Search Results" | **Read Replica**   | High volume traffic; slight data staleness (milliseconds) is acceptable. |
| **User Profile / Settings** | User viewing their own settings                    | **Master DB**      | Users expect immediate consistency (Read-your-own-writes).               |
| **Auth / Session**          | Token validation, Login checks                     | **Master DB**      | Security-critical; must be strictly up-to-date.                          |

### Suggested Candidates for Migration (Immediate Wins)

Based on the `admin_core_service`, the following areas are prime candidates for using `@Transactional(readOnly = true)`:

1.  **Health/Diagnostics**: The new endpoints we added already verifying connectivity.
2.  **Dashboard Data**: Aggregated stats shown on the admin homepage.
3.  **Export/Reports**: Any functionality that generates PDFs/CSVs.
4.  **Bulk Listings**: APIs like `GET /users`, `GET /institutes` (paginated lists).

## Configuration Details

Each service has two configured DataSources:

- `masterDataSource`: Defined by `spring.datasource.url`
- `slaveDataSource`: Defined by `spring.datasource.read.url` (Defaults to Master URL if secret is missing).

### Health Checks

You can verify connectivity to both databases via the admin health endpoints:

- Master: `GET /admin-core-service/health/db`
- Replica: `GET /admin-core-service/health/db/read-replica`
