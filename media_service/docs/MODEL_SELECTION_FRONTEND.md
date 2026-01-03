# AI Model Selection - Frontend Integration Guide

This document explains how the frontend can integrate with the AI model selection feature in the media service.

## Overview

The AI processing APIs now support optional model selection, allowing users to choose their preferred AI model for various operations like question generation, lecture planning, and audio transcription.

---

## Available Endpoints

### 1. Get Available Models

```http
GET /media-service/ai/retry/available-models
```

**Response:**
```json
{
  "defaultModel": "google/gemini-2.5-flash",
  "availableModels": [
    "google/gemini-2.5-flash",
    "openai/gpt-4o-mini",
    "anthropic/claude-3-haiku"
  ],
  "fallbackModels": [
    "google/gemini-2.0-flash-exp",
    "openai/gpt-4o-mini"
  ]
}
```

---

## Model Selection in API Calls

### PDF to Questions

```http
POST /media-service/ai/get-question-pdf/start-generate-questions
```

**Request Body:**
```json
{
  "pdfId": "abc123",
  "taskId": null,
  "taskName": "Math Questions",
  "instituteId": "inst_001",
  "preferredModel": "openai/gpt-4o-mini"  // Optional
}
```

### Audio to Questions

```http
GET /media-service/ai/get-question-audio/audio-parser/audio-to-questions
```

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `audioId` | string | Yes | Audio file ID |
| `numQuestions` | string | No | Number of questions (default: 20) |
| `difficulty` | string | No | Difficulty level (default: "hard and medium") |
| `language` | string | No | Question language (default: "english") |
| `preferredModel` | string | No | AI model to use |
| `taskId` | string | No | Existing task ID for retry |
| `taskName` | string | No | Task name for tracking |
| `instituteId` | string | No | Institute ID |

**Example:**
```
/media-service/ai/get-question-audio/audio-parser/audio-to-questions?audioId=xyz&preferredModel=openai/gpt-4o-mini
```

### Text to Questions

```http
POST /media-service/ai/get-question-pdf/from-text
```

**Request Body:**
```json
{
  "text": "Your text content here...",
  "num": 10,
  "classLevel": "Class 10",
  "topics": "Algebra, Geometry",
  "questionLanguage": "english",
  "questionType": "MCQS",
  "taskName": "Algebra Quiz",
  "taskId": null,
  "preferredModel": "google/gemini-2.5-flash"  // Optional
}
```

### Retry Failed Task

```http
POST /media-service/ai/retry/task?taskId={taskId}
```

**Request Body:**
```json
{
  "preferredModel": "anthropic/claude-3-haiku",
  "maxRetries": 3,
  "enableFallback": true
}
```

### Lecture Plan Generation

```http
GET /media-service/ai/lecture/generate-plan
```

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userPrompt` | string | Yes | The topic/content for the lecture |
| `lectureDuration` | string | Yes | Duration (e.g., "45 minutes") |
| `taskName` | string | Yes | Name for tracking this task |
| `instituteId` | string | Yes | Institute identifier |
| `language` | string | No | Language for the plan |
| `methodOfTeaching` | string | No | Teaching method |
| `level` | string | No | Class/skill level |
| `preferredModel` | string | No | AI model to use |

**Example:**
```
/media-service/ai/lecture/generate-plan?userPrompt=Introduction%20to%20Algebra&lectureDuration=45%20minutes&taskName=algebra_intro&instituteId=inst_001&preferredModel=openai/gpt-4o-mini
```

**Response:**
```json
{
  "taskId": "abc123",
  "status": "STARTED",
  "model": "openai/gpt-4o-mini",
  "message": "Lecture plan generation started"
}
```

### Lecture Feedback Generation

```http
GET /media-service/ai/lecture/generate-feedback
```

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `audioId` | string | Yes | Audio file ID of the lecture |
| `instituteId` | string | Yes | Institute identifier |
| `taskName` | string | Yes | Name for tracking this task |
| `preferredModel` | string | No | AI model to use |

**Example:**
```
/media-service/ai/lecture/generate-feedback?audioId=xyz123&instituteId=inst_001&taskName=lecture_feedback&preferredModel=google/gemini-2.5-flash
```

**Response:**
```json
{
  "taskId": "def456",
  "audioId": "xyz123",
  "status": "STARTED", 
  "model": "google/gemini-2.5-flash",
  "message": "Lecture feedback generation started"
}
```

---

## Frontend UI Recommendations

### Model Selector Component

```tsx
interface ModelSelectorProps {
  value?: string;
  onChange: (model: string) => void;
  showAdvanced?: boolean;
}

// Example usage
<ModelSelector 
  value={selectedModel}
  onChange={setSelectedModel}
  showAdvanced={true}
/>
```

### Suggested UI Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Generate Questions                                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Upload PDF: [Browse...] document.pdf ✓                         │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ ⚙️ Advanced Options                               [▼]     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  When expanded:                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ AI Model:                                                 │   │
│  │ ○ Default (Recommended)                                   │   │
│  │ ○ Google Gemini 2.5 Flash - Fast, balanced               │   │
│  │ ○ OpenAI GPT-4o Mini - Complex reasoning                 │   │
│  │ ○ Claude 3 Haiku - Creative, nuanced                     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│              [Generate Questions]                                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Model Display Names

Map the API model names to user-friendly display names:

```typescript
const MODEL_DISPLAY_NAMES: Record<string, { name: string; description: string }> = {
  "google/gemini-2.5-flash": {
    name: "Gemini 2.5 Flash",
    description: "Fast and balanced (Recommended)"
  },
  "openai/gpt-4o-mini": {
    name: "GPT-4o Mini",
    description: "Complex reasoning"
  },
  "anthropic/claude-3-haiku": {
    name: "Claude 3 Haiku",
    description: "Creative and nuanced"
  },
  "google/gemini-2.0-flash-exp": {
    name: "Gemini 2.0 Flash",
    description: "Experimental, fast"
  }
};
```

---

## Task Status Response

All AI processing endpoints return a task ID. Use the task status endpoint to check progress:

```http
GET /media-service/task-status/get-status?taskId={taskId}
```

**Response:**
```json
{
  "taskId": "abc123",
  "status": "PROGRESS",
  "statusMessage": "Processing PDF... (attempt 3/10)",
  "type": "PDF_TO_QUESTIONS",
  "taskName": "Math Questions",
  "hasResult": false,
  "createdAt": "2024-12-22T10:30:00",
  "updatedAt": "2024-12-22T10:31:15"
}
```

### Status Values

| Status | Description |
|--------|-------------|
| `STARTED` | Task has been created |
| `FILE_PROCESSING` | Converting PDF/Audio |
| `PROGRESS` | AI is generating content |
| `COMPLETED` | Task finished successfully |
| `FAILED` | Task failed (can retry) |

---

## Error Handling

### Common Error Responses

```json
{
  "error": true,
  "errorCode": "MODEL_NOT_ALLOWED",
  "message": "Requested model is not available",
  "userMessage": "The selected AI model is currently unavailable. Using default model.",
  "timestamp": "2024-12-22T10:30:00Z"
}
```

### Error Codes

| Code | Description | User Action |
|------|-------------|-------------|
| `MODEL_NOT_ALLOWED` | Model not in allowed list | Show fallback to default |
| `FILE_CONVERSION_ERROR` | PDF/Audio processing failed | Retry with different file |
| `AI_PROCESSING_ERROR` | AI model failed | Retry with different model |
| `TASK_NOT_FOUND` | Invalid task ID | Create new task |

---

## Example React Hook

```typescript
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';

interface GenerateQuestionsParams {
  pdfId: string;
  preferredModel?: string;
  taskName?: string;
  instituteId?: string;
}

export function useQuestionGeneration() {
  // Fetch available models
  const { data: models } = useQuery({
    queryKey: ['availableModels'],
    queryFn: () => fetch('/media-service/ai/retry/available-models').then(r => r.json())
  });

  // Start generation
  const generateMutation = useMutation({
    mutationFn: async (params: GenerateQuestionsParams) => {
      const response = await fetch('/media-service/ai/get-question-pdf/start-generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      return response.json();
    }
  });

  return {
    availableModels: models?.availableModels || [],
    defaultModel: models?.defaultModel,
    generateQuestions: generateMutation.mutate,
    isLoading: generateMutation.isPending
  };
}
```

---

## Best Practices

1. **Default Selection**: Always default to "Use default model" unless user explicitly selects
2. **Fallback Handling**: If selected model fails, system automatically tries fallback models
3. **Progress Polling**: Poll task status every 2-3 seconds during processing
4. **Error Recovery**: On failure, show retry button with option to change model
5. **Model Caching**: Cache available models list (refresh every 5 minutes)

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2024-12-22 | Initial model selection support |
