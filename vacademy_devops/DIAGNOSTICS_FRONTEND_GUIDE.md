# System Diagnostics Dashboard - Frontend Implementation Guide

## 1. Overview & Architecture

This dashboard provides real-time visibility into the Vacademy Platform's health. It aggregates data from two sources:

1.  **Direct Pings (Client-Side Latency):** The frontend browser directly pings each microservice to measure user-perceived latency.
2.  **Aggregated Health (Server-Side State):** The `community-service` provides a consolidated view of Kubernetes pods, database connections, and backend errors.

---

## 2. API Endpoints Reference

### A. Client-Side Latency Pings

Call these endpoints periodically (e.g., every 5-10 seconds) to measure `Time To First Byte (TTFB)`.

| Service Name      | Base URL (Ingress)                                       | Ping Endpoint  | Database Check Endpoint |
| :---------------- | :------------------------------------------------------- | :------------- | :---------------------- |
| **Auth Service**  | `https://backend-stage.vacademy.io/auth-service`         | `/health/ping` | `/health/db`            |
| **Admin Core**    | `https://backend-stage.vacademy.io/admin-core-service`   | `/health/ping` | `/health/db`            |
| **Media Service** | `https://backend-stage.vacademy.io/media-service`        | `/health/ping` | `/health/db`            |
| **Assessment**    | `https://backend-stage.vacademy.io/assessment-service`   | `/health/ping` | `/health/db`            |
| **Notification**  | `https://backend-stage.vacademy.io/notification-service` | `/health/ping` | `/health/db`            |
| **AI Service**    | `https://backend-stage.vacademy.io/ai-service`           | `/health/ping` | `/health/db`            |

**Ping Response Example:**

```json
{
  "status": "OK",
  "service": "auth-service",
  "timestamp": 1705561234567
}
```

### B. Aggregated Infrastructure Health

Call this endpoint every 30-60 seconds to get the "Heavy" data (Pod definitions, restart logs, etc).

- **Endpoint:** `GET https://backend-stage.vacademy.io/community-service/diagnostics/health`
- **Key Data Points:**
  - `kubernetes_infrastructure.pods`: List of all pods in relevant namespaces.
  - `dependencies`: Redis & PostgreSQL cluster health.
  - `connectivity_matrix`: Backend-view of inter-service connection success.

---

## 3. Recommended React Implementation

### A. Custom Hook for Latency (`useServiceLatency`)

Create a hook to measure latency for a list of services.

```typescript
// useServiceLatency.ts
import { useState, useEffect } from "react";

interface ServiceLatency {
  service: string;
  latencyMs: number | null; // null if measuring
  status: "UP" | "DOWN" | "PENDING";
}

const SERVICES = [
  {
    name: "auth",
    url: "https://backend-stage.vacademy.io/auth-service/health/ping",
  },
  {
    name: "admin",
    url: "https://backend-stage.vacademy.io/admin-core-service/health/ping",
  },
  // ... add others
];

export const useServiceLatency = () => {
  const [results, setResults] = useState<Record<string, ServiceLatency>>({});

  const measure = async (name: string, url: string) => {
    const start = performance.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      const end = performance.now();

      if (res.ok) {
        setResults((prev) => ({
          ...prev,
          [name]: {
            service: name,
            latencyMs: Math.round(end - start),
            status: "UP",
          },
        }));
      } else {
        throw new Error("Non-200");
      }
    } catch (e) {
      setResults((prev) => ({
        ...prev,
        [name]: { service: name, latencyMs: -1, status: "DOWN" },
      }));
    }
  };

  const refreshAll = () => {
    SERVICES.forEach((s) => measure(s.name, s.url));
  };

  useEffect(() => {
    refreshAll();
    const interval = setInterval(refreshAll, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, []);

  return { results, refreshAll };
};
```

### B. Pod Status Data Structure

The backend now returns enriched Pod Info. Define your TypeScript interface:

```typescript
interface PodInfo {
  name: string; // e.g., "auth-service-xyz-123"
  status: string; // "Running", "Pending", "Failed"
  ready: boolean; // true/false
  restarts: number; // Count
  age: string; // "2d14h"
  node: string;
  termination_reason?: string; // "OOMKilled", "Error"
  last_exit_code?: number; // 137, 143
  logs?: string[]; // Array of log lines (last 50)
}
```

---

## 4. Dashboard Layout & UI/UX (Shadcn/UI Recommended)

### Zone 1: The "Pulse" (Top Bar)

- **Visual:** Row of small cards/badges.
- **Content:** Display the _Client-Side Latency_ for each service.
- **Styling:**
  - **Green (< 200ms):** "Excellent"
  - **Yellow (200ms - 800ms):** "Fair"
  - **Red (> 800ms or Error):** "Critical"
- **Interaction:** Clicking a card should trigger a generic "re-ping".

### Zone 2: Database & Backend Matrix (Middle)

- **Component:** Data Grid or Matrix Card.
- **Columns:** Service Name | DB Connection Status | DB Latency | Redis Status.
- **Source:** Pull from the `/health/db` endpoint of each service (or aggregated from community-service).

### Zone 3: Kubernetes Deep Dive (The "Debugger")

- **Component:** Searchable Data Table.
- **Filter:** Add a toggle **"Show Problems Only"** (filters for `restarts > 0` OR `status != Running`).
- **Columns:**
  1.  **Pod Name**
  2.  **Status** (Badge: Green/Red/Gray)
  3.  **Restarts** (Highlight Red if > 5)
  4.  **Last Termination** (Show `reason (exit_code)` e.g., `OOMKilled (137)`)
  5.  **Actions**
- **Actions Column:** If `logs` are present, show a **"View Crash Logs"** button.
  - **Interaction:** Opens a `Dialog` / `Modal` containing the logs in a scrollable, monospace box (e.g., `<pre className="bg-slate-950 text-green-400 p-4 rounded text-xs overflow-auto max-h-[500px]">`).

---

## 5. Critical Troubleshooting Scenarios

Guide the user on what the data _means_:

### Scenario A: "OOMKilled" (Exit Code 137)

- **Indicator:** Pod status is `CrashLoopBackOff` or `Running` with high restart count. `termination_reason` shows `OOMKilled`.
- **Meaning:** The service ran out of memory.
- **Frontend Action:** Highlight this row in **bold red**. This is a configuration issue in `values.yaml`.

### Scenario B: "Connection Refused" / "Context Deadline Exceeded"

- **Indicator:** Client latency is "DOWN", but Pod status is "Running".
- **Meaning:** The app is running but frozen/deadlocked or overloaded.
- **Frontend Action:** Check the **Database Latency** component. If DB is slow, the app is waiting on DB. If DB is fast, the app logic is stuck (check CPU throttling).

### Scenario C: Redis Failure

- **Indicator:** All services report "DOWN" or High Latency simultaneously.
- **Check:** Community Service -> Dependencies -> Redis.
- **Meaning:** If Redis is down, session management fails for everyone.

---

## 6. Implementation Checklist

- [ ] Install Shadcn components: `Card`, `Badge`, `Table`, `Dialog`, `ScrollArea`, `Tabs`.
- [ ] Create `useServiceLatency` hook.
- [ ] Create `useInfrastructureHealth` hook (polling `community-service`).
- [ ] layout: `Grid` (3 columns).
- [ ] **Important:** Handle CORS. If frontend is on `localhost`, ensure Backend Ingress allows CORS or proxy requests via Vite.
