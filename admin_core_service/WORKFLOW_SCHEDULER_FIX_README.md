# Workflow Scheduler Race Condition & Idempotency Fix

## The Issue
We encountered a situation where scheduled workflows were failing to execute reliably in our multi-pod Kubernetes environment. Specifically:
- **Symptom 1 (Silent Failures):** Sometimes, no pod would execute the workflow. Both pods would log duplicate key errors.
- **Symptom 2 (Execution Sabotage):** In 99% of cases, one pod would seemingly run, but the "losing" pod would overwrite the execution status to `FAILED`.

### Root Cause Analysis

Despite having a unique database index on `idempotency_key`, the issue persisted due to three distinct logical flaws:

1.  **History Collision (The "No Run" Cause - 1% Case)**
    *   **The Bug:** The `idempotencyKeys` were generated using `lastRunAt`.
    *   **The Scenario:**
        *   Run 1 (Today) succeeds. `lastRunAt` becomes "Today".
        *   Run 2 (Tomorrow) starts. Both pods generate the key using `lastRunAt` (which is still "Today").
        *   **Conflict:** This key *already exists* from Run 1.
        *   **Result:** The database rejects the insert for *both* pods. Neither runs.

2.  **Race Condition Sabotage (The "Fake Success" Cause - 99% Case)**
    *   **The Bug:** The code caught the `Duplicate Key` exception as a generic `Exception`.
    *   **The Scenario:**
        *   Pod A wins and inserts the row (Status: PROCESSING).
        *   Pod B tries to insert, gets a "Duplicate Key" error.
        *   **The Sabotage:** Pod B catches this error and executes `markAsFailed()`, overwriting Pod A's active row to `FAILED`.
    *   **Result:** Pod A finishes successfully, but Pod B has already muddied the status or caused confusion.

3.  **Infinite Retry Loop (The "Stuck Schedule" Cause)**
    *   **The Bug:** If a workflow threw a logic exception, the schedule time (`nextRunAt`) was never updated.
    *   **Result:** The scheduler would immediately retry the same broken job infinitely.

## The Solution

We implemented a three-part fix in `WorkflowExecutionJob.java`:

### 1. Future-Based Idempotency Keys
Changed `generateIdempotencyKey` to use `nextRunAt` (the target execution time) instead of `lastRunAt`.
*   **Why:** This ensures every scheduled slot generates a *new* unique key that doesn't conflict with history.

### 2. Graceful Race Handling
Modified the `try-catch` block to explicitly catch `DataIntegrityViolationException` (Duplicate Key).
*   **Why:** When Pod B loses the race, it now logs a warning ("Skipping execution") and exits gracefully, instead of treating it as a failure and sabotaging Pod A.

### 3. Guaranteed Schedule Advancement
Moved `updateScheduleExecutionTime()` to run even if the workflow logic throws an exception.
*   **Why:** This prevents the system from getting stuck in an infinite loop retrying a failing job.

## Summary
The combination of the **Database Unique Constraint** (safety net) and these **Logic Fixes** (correct key generation + graceful failure handling) ensures that workflows now run exactly once per schedule, regardless of how many pods are running.
