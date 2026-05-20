# Transcription API — Usage Guide

Speech-to-Text transcription for class recordings. Built on top of Whisper, optimized for long lectures (1–2 hours) in English, Hindi, and Hinglish (code-mixed).

The API is **asynchronous**: submit a job, receive a `job_id`, then poll for status (or receive a webhook callback) until completion.

---

## Quick reference

| Method | Path                                    | Purpose                          |
| ------ | --------------------------------------- | -------------------------------- |
| POST   | `/ai-service/transcription/v1/submit`         | Submit a recording for transcription |
| GET    | `/ai-service/transcription/v1/status/{job_id}` | Poll job status / fetch results |

**Base URL** depends on environment:
- Local dev: `http://localhost:<ai_service_port>`
- Behind the API gateway: `https://<gateway-host>` (the `/ai-service` prefix is preserved)

---

## Authentication

All endpoints require an institute API key passed as a header:

```
X-Institute-Key: <your-institute-api-key>
```

The key is validated against `InstituteSettingsService`. Missing or inactive keys return **401 Unauthorized**.

---

## 1. Submit a transcription job

### `POST /ai-service/transcription/v1/submit`

Submits an audio or video file URL to the transcription worker. Returns a `job_id` for polling.

**Supported formats:** `mp3`, `mp4`, `wav`, `webm`, `ogg`, `m4a`, `flac`, `aac`
**Max duration:** ~2 hours per file

### Request body

```json
{
  "source_url": "https://your-bucket.s3.amazonaws.com/recordings/lecture-2026-05-15.mp4",
  "language": "auto",
  "model_size": "small",
  "word_timestamps": true,
  "output_formats": ["json", "srt", "vtt", "txt"],
  "callback_url": "https://your-app.com/webhooks/transcription"
}
```

### Field reference

| Field             | Type             | Required | Default | Description |
| ----------------- | ---------------- | -------- | ------- | ----------- |
| `source_url`      | string           | yes      | —       | Publicly fetchable URL (S3 presigned URL or public file). The worker downloads from this URL — make sure it is reachable from the render server. |
| `language`        | string \| null   | no       | `null` (auto-detect) | One of `auto`, `en`, `hi`, `hinglish`, or any ISO 639-1 code (e.g. `fr`, `es`). Use `hinglish` for Hindi-English mixed audio. |
| `model_size`      | string           | no       | `"base"` | `base` (fast, clear audio), `small` (best for Hindi-English mix), `medium` (best accuracy, slowest). Anything else → **400**. |
| `word_timestamps` | boolean          | no       | `true`  | Include word-level timestamps in JSON output. Disable to reduce payload size. |
| `output_formats`  | string[] \| null | no       | `null` (all formats) | Subset of `["json", "srt", "vtt", "txt"]`. Invalid values → **400**. |
| `callback_url`    | string \| null   | no       | `null`  | Webhook URL that the worker will POST to on completion or failure. See [Webhook callback](#webhook-callback). |

### Response — `200 OK`

```json
{
  "job_id": "tr_01JABCXYZ...",
  "status": "queued",
  "message": "Transcription job submitted"
}
```

Persist `job_id` — it is the only handle for polling status and retrieving results.

### Error responses

| Status | Reason | Body |
| ------ | ------ | ---- |
| `400`  | Invalid `model_size` | `{"detail": "model_size must be 'base', 'small', or 'medium'"}` |
| `400`  | Invalid `output_formats` | `{"detail": "Invalid output formats: {...}. Valid: {...}"}` |
| `401`  | Missing / inactive API key | `{"detail": "Invalid or inactive API Key"}` |
| `429`  | Worker at capacity — retry later | `{"detail": "Transcription server is busy, try again later"}` |
| `502`  | Upstream worker error | `{"detail": "Transcription service error: ..."}` |

### `curl` example

```bash
curl -X POST "https://<host>/ai-service/transcription/v1/submit" \
  -H "Content-Type: application/json" \
  -H "X-Institute-Key: $INSTITUTE_KEY" \
  -d '{
    "source_url": "https://bucket.s3.amazonaws.com/lecture.mp4",
    "language": "hinglish",
    "model_size": "small",
    "word_timestamps": true,
    "output_formats": ["json", "srt"]
  }'
```

---

## 2. Poll job status

### `GET /ai-service/transcription/v1/status/{job_id}`

Returns current status, progress, and (on completion) output URLs and metadata.

### Response — `200 OK`

```json
{
  "job_id": "tr_01JABCXYZ...",
  "status": "completed",
  "progress": 100.0,
  "output_urls": {
    "json": "https://bucket.s3.amazonaws.com/transcripts/tr_01J.../transcript.json",
    "srt":  "https://bucket.s3.amazonaws.com/transcripts/tr_01J.../transcript.srt",
    "vtt":  "https://bucket.s3.amazonaws.com/transcripts/tr_01J.../transcript.vtt",
    "txt":  "https://bucket.s3.amazonaws.com/transcripts/tr_01J.../transcript.txt"
  },
  "duration_seconds": 3582.4,
  "detected_language": "hi",
  "language_probability": 0.97,
  "segment_count": 412,
  "word_count": 8741,
  "error": null
}
```

### Field reference

| Field                  | Type             | Description |
| ---------------------- | ---------------- | ----------- |
| `job_id`               | string           | Echoed back. |
| `status`               | string           | `queued` → `running` → `completed` \| `failed`. |
| `progress`             | float \| null    | 0–100 (only meaningful while `running`). |
| `output_urls`          | object \| null   | Map of format → downloadable URL. Only populated when `status == "completed"`. Only includes keys for the formats requested at submit time. |
| `duration_seconds`     | float \| null    | Decoded media length. |
| `detected_language`    | string \| null   | ISO code returned by the model (set even if you passed `language="auto"`). |
| `language_probability` | float \| null    | Confidence (0–1) for `detected_language`. |
| `segment_count`        | int \| null      | Number of subtitle segments produced. |
| `word_count`           | int \| null      | Total words across all segments. |
| `error`                | string \| null   | Populated only when `status == "failed"`. |

### Error responses

| Status | Reason | Body |
| ------ | ------ | ---- |
| `401`  | Missing / inactive API key | `{"detail": "Invalid or inactive API Key"}` |
| `502`  | Could not reach worker | `{"detail": "Could not reach transcription server"}` |

> Note: an unknown `job_id` is not distinguished by the worker — the status response will simply have `status: "unknown"`, which the router converts to **502**. Make sure you store the `job_id` returned at submit time.

### `curl` example

```bash
curl -H "X-Institute-Key: $INSTITUTE_KEY" \
  "https://<host>/ai-service/transcription/v1/status/tr_01JABCXYZ..."
```

---

## Output formats

| Format | Use case |
| ------ | -------- |
| `json` | Programmatic access — full segment list, word-level timestamps (if requested), confidence, language probability. The richest format. |
| `srt`  | Standard subtitle format (most video players, YouTube). |
| `vtt`  | Web-native subtitles — works with HTML5 `<track>` element. |
| `txt`  | Plain transcript with no timing — for search, summarization, RAG ingestion. |

If you do not pass `output_formats`, all four are generated.

---

## Webhook callback

If you provide `callback_url`, the worker will POST to it once on terminal state (`completed` or `failed`). The body matches the **status response** shape.

- The webhook fires **once**. Treat it as a hint — always reconcile by polling `GET /status/{job_id}` if you do not see it within a few minutes after expected completion.
- Make the endpoint idempotent (key on `job_id`).
- Make the endpoint publicly reachable from the render worker (or whitelist its egress IP).
- The worker does not currently sign callbacks — verify by re-fetching the job status before acting on the payload.

---

## Choosing a model size

| Model    | Speed     | Hindi-English mix | When to use |
| -------- | --------- | ----------------- | ----------- |
| `base`   | Fastest   | Weak              | Clean English audio, near-realtime needs |
| `small`  | Moderate  | Strong            | **Default for Indian classrooms / Hinglish** |
| `medium` | Slowest   | Best              | Archival quality, noisy audio, low-resource languages |

Larger models also take more GPU memory on the worker. If you see frequent **429**s, drop to `small` or `base` — they queue against the same capacity pool.

---

## Typical client flow

```
1. Upload recording to S3 → get a public or presigned URL
2. POST /transcription/v1/submit  →  { job_id }
3. Either:
     a) Wait for the webhook callback, OR
     b) Poll GET /transcription/v1/status/{job_id} every 10–30s
4. When status == "completed":
     - Download from output_urls[<format>]
     - Persist locally / link from your UI
   When status == "failed":
     - Surface `error` to user; optionally retry submit
```

### Polling cadence

- Short clips (<10 min): poll every **5–10s**
- Lectures (1–2 hr): poll every **30–60s**
- Aggressive polling does not speed up completion; it just adds load. Prefer `callback_url` if you can host a webhook.

---

## Operational notes

- **Authentication is per institute** — usage is attributed to the institute that owns the API key.
- **`source_url` must be reachable from the render worker.** If you store recordings in a private S3 bucket, generate a presigned URL with TTL >> expected processing time (job duration ≈ 0.1×–0.4× media length depending on `model_size` and queue depth).
- **Output URLs are issued by the render worker** and are subject to its own retention policy. Download and re-store anything you need long-term.
- **Capacity (429)**: the worker has a fixed concurrent-job ceiling. Implement exponential backoff on submit when you hit 429.
- **Upstream (502)**: indicates the AI service could not reach the render worker — usually transient. Retry after 30–60s.

---

## Related code

- Router: [ai_service/app/routers/transcription.py](../../ai_service/app/routers/transcription.py)
- HTTP client: [ai_service/app/services/transcription_service.py](../../ai_service/app/services/transcription_service.py)
- Auth dependency: [ai_service/app/dependencies.py:149](../../ai_service/app/dependencies.py#L149) (`get_institute_from_api_key`)
- Settings: `RENDER_SERVER_URL`, `RENDER_SERVER_KEY` env vars (see [ai_service/app/config.py](../../ai_service/app/config.py))
