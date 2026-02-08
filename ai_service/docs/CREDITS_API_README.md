# AI Credits API - Frontend Integration Guide

This document explains how to integrate the AI Credits API into the frontend to display credit balances, transaction logs, and usage analytics.

## Overview

The AI service provides endpoints to track credit usage, view transaction history, and analyzing credit consumption for institutes.

## Base URL

```
Production: https://api.vacademy.io/ai-service
Staging: https://staging-api.vacademy.io/ai-service
Local: http://localhost:8077/ai-service
```

---

## API Endpoints

### 1. Get Credit Balance

Get the current credit balance and status for an institute.

```bash
# Get balance for an institute
# Replace {institute_id} with the actual ID
curl -X GET "http://localhost:8077/ai-service/credits/v1/institutes/{institute_id}/balance" \
  -H "Authorization: Bearer <token>"
```

**Response:**

```json
{
  "institute_id": "inst_12345",
  "total_credits": 200.0,
  "used_credits": 45.5,
  "current_balance": 154.5,
  "low_balance_threshold": 50.0,
  "is_low_balance": false,
  "created_at": "2024-01-01T10:00:00Z",
  "updated_at": "2024-01-15T14:30:00Z"
}
```

### 2. Get Transaction Logs (History)

Get paginated history of all credit transactions (grants, deductions, etc.).

```bash
# Get logs (default page 1, size 50)
curl -X GET "http://localhost:8077/ai-service/credits/v1/institutes/{institute_id}/transactions" \
  -H "Authorization: Bearer <token>"

# Pagination
curl -X GET "http://localhost:8077/ai-service/credits/v1/institutes/{institute_id}/transactions?page=2&page_size=20" \
  -H "Authorization: Bearer <token>"

# Filter by specific transaction types (optional)
# Types: USAGE_DEDUCTION, INITIAL_GRANT, ADMIN_GRANT, REFUND
curl -X GET "http://localhost:8077/ai-service/credits/v1/institutes/{institute_id}/transactions?transaction_types=USAGE_DEDUCTION" \
  -H "Authorization: Bearer <token>"
```

**Response:**

```json
{
  "transactions": [
    {
      "id": "tx_98765",
      "institute_id": "inst_12345",
      "transaction_type": "USAGE_DEDUCTION",
      "amount": -0.5,
      "balance_after": 154.5,
      "description": "content using google/gemini-2.5-flash",
      "request_type": "content",
      "model_name": "google/gemini-2.5-flash",
      "granted_by": null,
      "created_at": "2024-01-15T14:30:00Z"
    },
    {
      "id": "tx_98760",
      "institute_id": "inst_12345",
      "transaction_type": "INITIAL_GRANT",
      "amount": 200.0,
      "balance_after": 200.0,
      "description": "Initial signup bonus",
      "request_type": null,
      "model_name": null,
      "granted_by": "system",
      "created_at": "2024-01-01T10:00:00Z"
    }
  ],
  "total_count": 45,
  "page": 1,
  "page_size": 50,
  "total_pages": 1
}
```

### 3. Get Usage Analytics

Get a breakdown of credit usage by request type (video, content, etc.) and daily usage stats.

```bash
# Get analytics for the last 30 days (default)
curl -X GET "http://localhost:8077/ai-service/credits/v1/institutes/{institute_id}/usage" \
  -H "Authorization: Bearer <token>"

# Get analytics for the last 7 days
curl -X GET "http://localhost:8077/ai-service/credits/v1/institutes/{institute_id}/usage?days=7" \
  -H "Authorization: Bearer <token>"
```

**Response:**

```json
{
  "institute_id": "inst_12345",
  "period_start": "2023-12-17T14:30:00Z",
  "period_end": "2024-01-16T14:30:00Z",
  "total_requests": 150,
  "total_credits_used": 45.5,
  "by_request_type": [
    {
      "request_type": "video",
      "total_requests": 5,
      "total_credits": 25.0,
      "percentage": 54.95
    },
    {
      "request_type": "content",
      "total_requests": 145,
      "total_credits": 20.5,
      "percentage": 45.05
    }
  ],
  "by_day": [
    {
      "date": "2024-01-15",
      "total_requests": 12,
      "total_credits": 3.2
    },
    {
      "date": "2024-01-16",
      "total_requests": 5,
      "total_credits": 1.5
    }
  ],
  "top_models": [
    {
      "model": "google/gemini-2.0-flash-exp:free",
      "requests": 50,
      "credits": 0.0
    },
    {
      "model": "google/gemini-2.5-flash",
      "requests": 20,
      "credits": 5.4
    }
  ]
}
```

### 4. Get Usage Forecast

Get estimated days remaining based on recent usage patterns.

```bash
curl -X GET "http://localhost:8077/ai-service/credits/v1/institutes/{institute_id}/forecast" \
  -H "Authorization: Bearer <token>"
```

**Response:**

```json
{
  "institute_id": "inst_12345",
  "current_balance": 154.5,
  "average_daily_usage": 1.5,
  "estimated_days_remaining": 103,
  "projected_zero_date": "2024-04-29",
  "recommendation": "Credit balance is healthy."
}
```

---

## Frontend Integration Examples

### TypeScript Interfaces

```typescript
export interface CreditBalance {
  institute_id: string;
  total_credits: number;
  used_credits: number;
  current_balance: number;
  low_balance_threshold: number;
  is_low_balance: boolean;
}

export interface CreditTransaction {
  id: string;
  transaction_type:
    | "INITIAL_GRANT"
    | "ADMIN_GRANT"
    | "USAGE_DEDUCTION"
    | "REFUND";
  amount: number;
  balance_after: number;
  description: string;
  request_type?: string;
  model_name?: string;
  created_at: string;
}

export interface UsageAnalytics {
  total_requests: number;
  total_credits_used: number;
  by_request_type: {
    request_type: string;
    total_requests: number;
    total_credits: number;
    percentage: number;
  }[];
  by_day: {
    date: string;
    total_requests: number;
    total_credits: number;
  }[];
}
```

### API Service Helper

```typescript
// api.ts
const API_BASE = "/ai-service/credits/v1";

export async function getBalance(instituteId: string) {
  const response = await fetch(`${API_BASE}/institutes/${instituteId}/balance`);
  return response.json();
}

export async function getTransactions(
  instituteId: string,
  page = 1,
  pageSize = 50,
) {
  const params = new URLSearchParams({
    page: page.toString(),
    page_size: pageSize.toString(),
  });
  const response = await fetch(
    `${API_BASE}/institutes/${instituteId}/transactions?${params}`,
  );
  return response.json();
}

export async function getAnalytics(instituteId: string, days = 30) {
  const response = await fetch(
    `${API_BASE}/institutes/${instituteId}/usage?days=${days}`,
  );
  return response.json();
}
```
