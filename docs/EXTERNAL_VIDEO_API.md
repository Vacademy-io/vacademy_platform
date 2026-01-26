# Vacademy AI Video Generation API

Welcome to the Vacademy AI Video Generation API. This API allows you to generate high-quality AI videos from text prompts programmatically.

## Authentication

All API requests must include the `X-Institute-Key` header with your valid API Key.

**Header:**

```http
X-Institute-Key: vac_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## Base URL

`https://api.content.vacademy.io` (or your specific environment URL)

---

## API Key Management

These endpoints allow you to manage API keys for your institute.

### 1. Generate API Key

Generate a new API key for your institute.

**Endpoint:** `POST /api/v1/institute/api-keys/generate`

**Request Body:**

```json
{
  "institute_id": "your-institute-uuid",
  "name": "My Prod Key"
}
```

**Response:**

```json
{
  "id": "uuid...",
  "name": "My Prod Key",
  "key": "vac_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "created_at": "2024-01-25T12:00:00Z",
  "status": "active"
}
```

### 2. List API Keys

Get all active API keys for your institute.

**Endpoint:** `GET /api/v1/institute/api-keys/{institute_id}`

**Response:**

```json
[
  {
    "id": "uuid...",
    "name": "My Prod Key",
    "key": "vac_live_xxxxxxxxxxxx...xxxx",
    "created_at": "2024-01-25T12:00:00Z",
    "status": "active"
  }
]
```

### 3. Revoke API Key

Revoke/delete an API key.

**Endpoint:** `DELETE /api/v1/institute/api-keys/{institute_id}/{key_id}`

**Response:**

```json
{
  "status": "success",
  "message": "Key revoked"
}
```

---

## External Video Generation APIs

## 1. Generate Video

Start a video generation process. This endpoint returns a Server-Sent Events (SSE) stream that provides real-time progress updates.

**Endpoint:** `POST /api/v1/external/video/v1/generate`

**Query Parameters:**

- `target_stage` (optional): The stage to generate up to. Default is `RENDER` (full video). Options: `SCRIPT`, `TTS`, `WORDS`, `HTML`, `RENDER`.

**Request Body (JSON):**

```json
{
  "prompt": "Explain the concept of photosynthesis to a 10-year-old student.",
  "language": "English",
  "captions_enabled": true,
  "html_quality": "advanced",
  "target_audience": "Class 5 (Ages 10-11)",
  "target_duration": "2-3 minutes",
  "video_id": "optional-custom-id"
}
```

| Field              | Type    | Description                                                                 |
| :----------------- | :------ | :-------------------------------------------------------------------------- |
| `prompt`           | string  | **Required**. The topic or script instructions.                             |
| `language`         | string  | Language of the video (e.g., "English", "Spanish"). Default: "English".     |
| `captions_enabled` | boolean | Whether to include captions. Default: `true`.                               |
| `html_quality`     | string  | "classic" or "advanced". Default: "advanced".                               |
| `target_audience`  | string  | Target age group (e.g., "Class 5"). Default: "General/Adult".               |
| `target_duration`  | string  | Target length (e.g., "5 minutes"). Default: "2-3 minutes".                  |
| `video_id`         | string  | Optional. A unique ID for the video. One will be generated if not provided. |

**Response (SSE Stream):**

The API streams JSON objects prefixed with `data: `.

```
data: {"type": "progress", "stage": "PENDING", "message": "Video generation initialized", "percentage": 0, "video_id": "..."}

data: {"type": "progress", "stage": "SCRIPT", "message": "Generating script...", "percentage": 10}

...

data: {"type": "completed", "files": {"video": "https://...", "script": "https://..."}, "percentage": 100}
```

---

## 2. Get Video Status

Check the status of a video generation and retrieve file URLs.

**Endpoint:** `GET /api/v1/external/video/v1/status/{video_id}`

**Response:**

```json
{
  "id": "uuid-...",
  "video_id": "custom-video-id",
  "current_stage": "RENDER",
  "status": "COMPLETED",
  "s3_urls": {
    "script": "https://bucket.s3.amazonaws.com/.../script.txt",
    "audio": "https://bucket.s3.amazonaws.com/.../narration.mp3",
    "video": "https://bucket.s3.amazonaws.com/.../output.mp4"
  },
  "created_at": "2024-01-25T10:00:00Z"
}
```

---

## 3. Get Player URLs

Retrieve specific URLs needed to embed the video in a custom player (HTML timeline + Audio).

**Endpoint:** `GET /api/v1/external/video/v1/urls/{video_id}`

**Response:**

```json
{
  "video_id": "custom-video-id",
  "html_url": "https://bucket.s3.amazonaws.com/.../time_based_frame.json",
  "audio_url": "https://bucket.s3.amazonaws.com/.../narration.mp3",
  "words_url": "https://bucket.s3.amazonaws.com/.../narration.words.json",
  "current_stage": "RENDER"
}
```

---

## 4. Regenerate Specific Frame

Generate a new HTML preview for a specific frame based on your instructions (e.g., "Change background to blue", "Make text larger").
This returns the new HTML but does NOT apply it to the timeline yet.

**Endpoint:** `POST /api/v1/external/video/v1/frame/regenerate`

**Request Body:**

```json
{
  "video_id": "custom-video-id",
  "timestamp": 12.5,
  "user_prompt": "Change the background color to dark blue and make the font yellow."
}
```

- `timestamp`: The time in seconds where the frame is visible.

**Response:**

```json
{
  "video_id": "custom-video-id",
  "frame_index": 5,
  "timestamp": 12.5,
  "original_html": "<html>...</html>",
  "new_html": "<html><style>body { background: darkblue; color: yellow; }</style>...</html>"
}
```

---

## 5. Update Frame

Apply the confirmed HTML change to the video timeline. This updates the underlying `time_based_frame.json` file.
Note: This updates the HTML timeline immediately. If a full MP4 exists, it will strictly _not_ match until re-rendered, but HTML players will show the update instantly.

**Endpoint:** `POST /api/v1/external/video/v1/frame/update`

**Request Body:**

```json
{
  "video_id": "custom-video-id",
  "frame_index": 5,
  "new_html": "<html>...</html>"
}
```

- `frame_index`: Returned from the generate/preview step.
- `new_html`: The HTML content you want to save.

**Response:**

```json
{
  "status": "success",
  "video_id": "custom-video-id",
  "updated_frame_index": 5,
  "message": "Frame updated successfully. Player should reflect changes immediately."
}
```

---

## Error Handling

- **401 Unauthorized**: Invalid or missing `X-Institute-Key`.
- **404 Not Found**: Video ID not found.
- **500 Internal Server Error**: Service failure.

## Usage Limits

Usage is tracked against your institute's account. Limits apply based on your subscription plan.
