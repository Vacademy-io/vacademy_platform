# AI Models Selection API - Frontend Integration Guide

This document explains how to integrate the AI Models Selection API into the frontend.

## Overview

The AI service provides a centralized, database-backed model registry. All model data (names, pricing, capabilities, recommendations) is managed in the database and can be dynamically updated without code changes.

## Base URL

```
Production: https://api.vacademy.io/ai-service
Staging: https://staging-api.vacademy.io/ai-service
Local: http://localhost:8077/ai-service
```

---

## API Endpoints

### 1. List All Models

Get all available AI models with optional filtering.

```bash
# Get all models
curl -X GET "http://localhost:8077/ai-service/models/v2/list"

# Filter by tier
curl -X GET "http://localhost:8077/ai-service/models/v2/list?tier=free"
curl -X GET "http://localhost:8077/ai-service/models/v2/list?tier=standard"
curl -X GET "http://localhost:8077/ai-service/models/v2/list?tier=premium"

# Filter by provider
curl -X GET "http://localhost:8077/ai-service/models/v2/list?provider=Google"
curl -X GET "http://localhost:8077/ai-service/models/v2/list?provider=OpenAI"

# Filter by use case
curl -X GET "http://localhost:8077/ai-service/models/v2/list?use_case=content"
curl -X GET "http://localhost:8077/ai-service/models/v2/list?use_case=video"

# Filter free models only
curl -X GET "http://localhost:8077/ai-service/models/v2/list?is_free=true"

# Combine filters
curl -X GET "http://localhost:8077/ai-service/models/v2/list?tier=standard&provider=Google"
```

**Response:**

```json
{
  "models": [
    {
      "model_id": "google/gemini-2.5-flash",
      "name": "Gemini 2.5 Flash",
      "provider": "Google",
      "category": "general",
      "tier": "standard",
      "max_tokens": 1048576,
      "context_window": 1048576,
      "supports_streaming": true,
      "supports_images": true,
      "input_price_per_1m": 0.3,
      "output_price_per_1m": 2.5,
      "credit_multiplier": 1.0,
      "is_free": false,
      "recommended_for": ["content", "outline", "copilot", "video"],
      "quality_score": 4,
      "speed_score": 5,
      "description": "Fast Gemini model with great price/performance"
    }
  ],
  "total": 15,
  "free_count": 6,
  "paid_count": 9
}
```

---

### 2. Get Free Tier Models

Get the currently active free models.

```bash
curl -X GET "http://localhost:8077/ai-service/models/v2/free"
```

**Response:**

```json
{
  "models": [
    {
      "model_id": "xiaomi/mimo-v2-flash:free",
      "name": "MIMO v2 Flash",
      "provider": "OpenRouter",
      "tier": "free",
      "is_free": true,
      "quality_score": 3,
      "speed_score": 5,
      "description": "Fast free model for general tasks"
    },
    {
      "model_id": "arcee-ai/trinity-large-preview:free",
      "name": "Trinity Large Preview",
      "provider": "OpenRouter",
      "tier": "free",
      "is_free": true,
      "quality_score": 3,
      "speed_score": 4,
      "description": "Arcee AI's preview model"
    }
  ],
  "count": 6,
  "last_updated": "2026-02-08T15:00:00Z"
}
```

---

### 3. Get Models for Use Case

Get recommended models for a specific use case with defaults.

```bash
# For content generation
curl -X GET "http://localhost:8077/ai-service/models/v2/use-case/content"

# For video generation
curl -X GET "http://localhost:8077/ai-service/models/v2/use-case/video"

# For answer evaluation
curl -X GET "http://localhost:8077/ai-service/models/v2/use-case/evaluation"

# Available use cases:
# - content (text/content generation)
# - outline (course outline generation)
# - video (video generation)
# - image (image generation)
# - evaluation (answer evaluation)
# - embedding (text embeddings)
# - copilot (student/instructor copilot)
# - agent (AI agent interactions)
# - analytics (student analytics)
# - tts (text-to-speech)
```

**Response:**

```json
{
  "use_case": "content",
  "default_model": {
    "model_id": "google/gemini-2.5-flash",
    "name": "Gemini 2.5 Flash",
    "provider": "Google",
    "tier": "standard",
    "is_free": false,
    "quality_score": 4,
    "speed_score": 5,
    "description": "Fast Gemini model"
  },
  "fallback_model": {
    "model_id": "deepseek/deepseek-v3.2",
    "name": "DeepSeek V3.2",
    ...
  },
  "free_tier_model": {
    "model_id": "xiaomi/mimo-v2-flash:free",
    "name": "MIMO v2 Flash",
    ...
  },
  "recommended_models": [...],
  "all_compatible_models": [...]
}
```

---

### 4. Get All Use Case Defaults

Get default model assignments for all use cases (useful for initialization).

```bash
curl -X GET "http://localhost:8077/ai-service/models/v2/defaults"
```

**Response:**

```json
{
  "defaults": [
    {
      "use_case": "content",
      "default_model_id": "google/gemini-2.5-flash",
      "fallback_model_id": "deepseek/deepseek-v3.2",
      "free_tier_model_id": "xiaomi/mimo-v2-flash:free",
      "description": "Content generation"
    },
    {
      "use_case": "video",
      "default_model_id": "google/gemini-2.0-flash-exp:free",
      "fallback_model_id": "google/gemini-2.5-flash",
      "free_tier_model_id": "google/gemini-2.0-flash-exp:free",
      "description": "Video generation"
    }
  ]
}
```

---

### 5. Get Model Details

Get detailed information about a specific model.

```bash
# Note: model_id may contain slashes, so URL encode if needed
curl -X GET "http://localhost:8077/ai-service/models/v2/google/gemini-2.5-flash"

# For models with :free suffix
curl -X GET "http://localhost:8077/ai-service/models/v2/xiaomi/mimo-v2-flash:free"
```

---

### 6. Get Providers List

Get list of model providers with counts.

```bash
curl -X GET "http://localhost:8077/ai-service/models/v2/providers"
```

**Response:**

```json
{
  "providers": [
    {
      "provider": "Google",
      "total_models": 6,
      "free_models": 1,
      "paid_models": 5
    },
    {
      "provider": "OpenRouter",
      "total_models": 5,
      "free_models": 5,
      "paid_models": 0
    },
    {
      "provider": "Anthropic",
      "total_models": 3,
      "free_models": 0,
      "paid_models": 3
    }
  ],
  "total_providers": 5
}
```

---

### 7. Get Tiers List

Get list of pricing tiers with stats.

```bash
curl -X GET "http://localhost:8077/ai-service/models/v2/tiers"
```

**Response:**

```json
{
  "tiers": [
    { "tier": "free", "count": 6, "avg_input_price": 0, "avg_output_price": 0 },
    {
      "tier": "standard",
      "count": 5,
      "avg_input_price": 0.21,
      "avg_output_price": 1.36
    },
    {
      "tier": "premium",
      "count": 5,
      "avg_input_price": 1.55,
      "avg_output_price": 8.2
    },
    {
      "tier": "ultra",
      "count": 3,
      "avg_input_price": 4.0,
      "avg_output_price": 17.3
    }
  ]
}
```

---

## Frontend Integration Examples

### TypeScript/React Example

```typescript
// types.ts
interface AIModel {
  model_id: string;
  name: string;
  provider: string;
  tier: "free" | "standard" | "premium" | "ultra";
  is_free: boolean;
  quality_score: number;
  speed_score: number;
  description?: string;
  input_price_per_1m?: number;
  output_price_per_1m?: number;
  credit_multiplier?: number;
}

// api.ts
const API_BASE = "/ai-service/models/v2";

export async function getModelsForUseCase(useCase: string) {
  const response = await fetch(`${API_BASE}/use-case/${useCase}`);
  return response.json();
}

export async function getFreeModels() {
  const response = await fetch(`${API_BASE}/free`);
  return response.json();
}

export async function getAllModels(filters?: {
  tier?: string;
  provider?: string;
  is_free?: boolean;
}) {
  const params = new URLSearchParams();
  if (filters?.tier) params.set("tier", filters.tier);
  if (filters?.provider) params.set("provider", filters.provider);
  if (filters?.is_free !== undefined)
    params.set("is_free", String(filters.is_free));

  const response = await fetch(`${API_BASE}/list?${params}`);
  return response.json();
}
```

### Model Selector Component Example

```tsx
// ModelSelector.tsx
import { useState, useEffect } from "react";
import { getModelsForUseCase } from "./api";

interface Props {
  useCase: "content" | "video" | "evaluation" | "outline";
  onModelSelect: (modelId: string) => void;
  showFreeOnly?: boolean;
}

export function ModelSelector({ useCase, onModelSelect, showFreeOnly }: Props) {
  const [models, setModels] = useState<any>(null);
  const [selectedModel, setSelectedModel] = useState<string>("");

  useEffect(() => {
    getModelsForUseCase(useCase).then((data) => {
      setModels(data);
      // Auto-select appropriate default
      const defaultModel = showFreeOnly
        ? data.free_tier_model?.model_id
        : data.default_model?.model_id;
      setSelectedModel(defaultModel);
      onModelSelect(defaultModel);
    });
  }, [useCase, showFreeOnly]);

  if (!models) return <div>Loading models...</div>;

  const modelOptions = showFreeOnly
    ? models.recommended_models.filter((m: any) => m.is_free)
    : models.recommended_models;

  return (
    <select
      value={selectedModel}
      onChange={(e) => {
        setSelectedModel(e.target.value);
        onModelSelect(e.target.value);
      }}
    >
      {/* Default option */}
      <option value={models.default_model.model_id}>
        {models.default_model.name} (Recommended)
      </option>

      {/* Free option if different */}
      {models.free_tier_model &&
        models.free_tier_model.model_id !== models.default_model.model_id && (
          <option value={models.free_tier_model.model_id}>
            {models.free_tier_model.name} (Free)
          </option>
        )}

      {/* Other options */}
      {modelOptions.map((model: any) => (
        <option key={model.model_id} value={model.model_id}>
          {model.name}{" "}
          {model.is_free ? "(Free)" : `($${model.input_price_per_1m}/1M)`}
        </option>
      ))}
    </select>
  );
}
```

---

## Admin APIs (ROOT_ADMIN Only)

### Update Free Tier Models

When OpenRouter changes which models are free:

```bash
curl -X PUT "http://localhost:8077/ai-service/models/v2/free-tier" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin-token>" \
  -d '{
    "model_ids": [
      "arcee-ai/trinity-large-preview:free",
      "nvidia/nemotron-3-nano-30b-a3b:free",
      "tngtech/deepseek-r1t2-chimera:free",
      "xiaomi/mimo-v2-flash:free",
      "google/gemini-2.0-flash-exp:free"
    ]
  }'
```

### Add New Model

```bash
curl -X POST "http://localhost:8077/ai-service/models/v2/" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin-token>" \
  -d '{
    "model_id": "anthropic/claude-4-opus",
    "name": "Claude 4 Opus",
    "provider": "Anthropic",
    "category": "general",
    "tier": "ultra",
    "is_free": false,
    "credit_multiplier": 4.0,
    "input_price_per_1m": 15.0,
    "output_price_per_1m": 75.0,
    "max_tokens": 200000,
    "context_window": 200000,
    "recommended_for": ["evaluation", "analytics"],
    "quality_score": 5,
    "speed_score": 3,
    "description": "Most capable Claude model"
  }'
```

### Update Model

```bash
curl -X PATCH "http://localhost:8077/ai-service/models/v2/google/gemini-2.5-flash" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin-token>" \
  -d '{
    "input_price_per_1m": 0.25,
    "output_price_per_1m": 2.0,
    "quality_score": 5
  }'
```

### Update Use Case Defaults

```bash
curl -X PATCH "http://localhost:8077/ai-service/models/v2/defaults/video" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin-token>" \
  -d '{
    "default_model_id": "google/gemini-3-flash-preview",
    "free_tier_model_id": "google/gemini-2.0-flash-exp:free"
  }'
```

---

## Model Tiers Explained

| Tier       | Credit Multiplier | Description        |
| ---------- | ----------------- | ------------------ |
| `free`     | 0.0x              | No credits charged |
| `standard` | 1.0x              | Base rate          |
| `premium`  | 2.0x              | 2x credit cost     |
| `ultra`    | 4.0x              | 4x credit cost     |

---

## Best Practices

1. **Cache API responses**: Model lists don't change frequently. Cache for 5-10 minutes.

2. **Use use-case endpoint**: Instead of listing all models, use `/use-case/{type}` to get relevant models.

3. **Handle fallbacks**: If a model is unavailable, use the `fallback_model` from the response.

4. **Show free badge**: Use `is_free` to show a "Free" badge on free models.

5. **Sort by quality/speed**: Use `quality_score` and `speed_score` for sorting options.

---

## Migration from v1 API

The old `/models/v1/list` endpoint still works but is deprecated. Migrate to `/models/v2/list`.

Key differences:

- v2 fetches from database (dynamic, no code changes needed)
- v2 has more fields (credit_multiplier, recommended_for, quality_score, etc.)
- v2 supports use-case-based defaults
