# Infrastructure Diagnostics API Guide

This document details the critical system health monitoring APIs available in `community-service`. These endpoints provide real-time visibility into the Kubernetes cluster, application services, databases, and network connectivity.

**Base URL:** `https://backend-stage.vacademy.io/community-service/diagnostics`

---

## 1. Full Infrastructure Health

**Endpoint:** `GET /health`

Returns a massive, comprehensive snapshot of the entire system. Use this for the initial load of a dashboard.

### Response `200 OK`

```json
{
  "timestamp": "2026-01-15T10:00:00Z",
  "overall_status": "HEALTHY",
  "kubernetes_infrastructure": {
    "ingress_nginx": {
      "status": "UP",
      "ready_replicas": 1,
      "total_replicas": 1,
      "restart_count": 0,
      "pods": [
        {
          "name": "ingress-nginx-controller-abc",
          "status": "Running",
          "ready": true,
          "restarts": 0,
          "age": "2d",
          "node": "lke-node-1"
        }
      ]
    },
    "cert_manager": {
      "status": "UP",
      "ready_replicas": 1,
      "total_replicas": 1,
      "restart_count": 0,
      "pods": [...]
    },
    "calico_network": { "status": "UP", ... },
    "load_balancer": {
      "status": "ACTIVE",
      "external_ip": "172.232.85.240",
      "ports": ["80/TCP", "443/TCP"]
    }
  },
  "application_services": [
    {
      "name": "auth-service",
      "status": "UP",
      "response_time_ms": 45,
      "health_endpoint": "http://auth-service:8071/auth-service/actuator/health"
    },
    {
      "name": "admin-core-service",
      "status": "UP",
      "response_time_ms": 62
    },
    { "name": "media-service", "status": "UP", "response_time_ms": 12 },
    { "name": "assessment-service", "status": "UP", "response_time_ms": 30 },
    { "name": "notification-service", "status": "UP", "response_time_ms": 25 }
  ],
  "dependencies": {
    "redis": {
      "status": "UP",
      "connected": true,
      "response_time_ms": 2,
      "host": "redis",
      "port": 6379
    },
    "postgresql": {
      "status": "UP",
      "connected": true,
      "response_time_ms": 15,
      "database_name": "vacademy_db"
    }
  },
  "connectivity_matrix": [
    {
      "source": "auth-service",
      "target": "admin-core-service",
      "status": "OK",
      "response_time_ms": 23
    },
    {
      "source": "admin-core-service",
      "target": "auth-service",
      "status": "OK",
      "response_time_ms": 18
    }
  ],
  "recent_events": [
    {
      "type": "Warning",
      "reason": "Unhealthy",
      "message": "Liveness probe failed",
      "object": "pod/old-pod-xyz",
      "namespace": "default",
      "timestamp": "2026-01-15T09:55:00Z"
    }
  ]
}
```

---

## 2. Quick Health Check

**Endpoint:** `GET /health/quick`

Lightweight endpoint designed for polling (every 10-30s). Returns just status and latencies.

### Response `200 OK`

```json
{
  "timestamp": "2026-01-15T10:00:30Z",
  "overall_status": "HEALTHY",
  "services": {
    "auth-service": { "status": "UP", "response_time_ms": 45 },
    "admin-core-service": { "status": "UP", "response_time_ms": 62 },
    "media-service": { "status": "UP", "response_time_ms": 38 },
    "assessment-service": { "status": "UP", "response_time_ms": 41 },
    "notification-service": { "status": "UP", "response_time_ms": 35 },
    "community-service": { "status": "UP", "response_time_ms": 0 }
  },
  "redis": { "status": "UP", "response_time_ms": 2 },
  "database": { "status": "UP", "response_time_ms": 15 }
}
```

---

## 3. Kubernetes Pod Status

**Endpoint:** `GET /kubernetes/pods`

Returns detailed list of all pods in critical namespaces.

### Response `200 OK`

```json
{
  "default": [
    {
      "name": "auth-service-7ddc7c49cd-8cw8g",
      "status": "Running",
      "ready": true,
      "restarts": 0,
      "age": "45m",
      "node": "lke-node-1"
    }
  ],
  "ingress-nginx": [
    {
      "name": "ingress-nginx-controller-abc",
      "status": "Running",
      "ready": true,
      "restarts": 0,
      "age": "2d"
    }
  ],
  "cert-manager": [...],
  "kube-system": [...]
}
```

---

## 4. Inter-Service Connectivity

**Endpoint:** `GET /connectivity`

Tests network reachability between services (e.g., Can Auth reach Admin? Can Admin reach Media?).

### Response `200 OK`

```json
[
  {
    "source": "auth-service",
    "target": "admin-core-service",
    "status": "OK",
    "response_time_ms": 45,
    "last_check": "2026-01-15T10:00:00.123Z"
  },
  {
    "source": "admin-core-service",
    "target": "media-service",
    "status": "FAILED",
    "response_time_ms": -1,
    "error_message": "Connection refused",
    "last_check": "2026-01-15T10:00:00.123Z"
  }
]
```

---

## 5. Kubernetes Events

**Endpoint:** `GET /kubernetes/events`

Returns recent cluster WARNINGS and ERRORS (last hour). Useful for debugging crash loops.

### Response `200 OK`

```json
[
  {
    "type": "Warning",
    "reason": "FailedScheduling",
    "message": "0/3 nodes are available: 3 Insufficient cpu.",
    "object": "pod/redis-xyz",
    "namespace": "default",
    "timestamp": "2026-01-15T09:50:00Z",
    "count": 5
  }
]
```

---

## 6. Database Health

**Endpoint:** `GET /database`

### Response `200 OK`

```json
{
  "status": "UP",
  "connected": true,
  "response_time_ms": 12,
  "database": "vacademy_db",
  "url": "jdbc:postgresql://vacademy-stage.cluster-xyz.us-east-1.rds.amazonaws.com:5432/..."
}
```

---

## 7. Redis Health

**Endpoint:** `GET /redis`

### Response `200 OK`

```json
{
  "status": "UP",
  "connected": true,
  "response_time_ms": 2,
  "host": "redis",
  "port": 6379
}
```
