# Audio Slide Integration Guide for Admin Portal

This guide details the integration steps required to implement Audio Slide management in the Admin Portal and Learner App.

## 1. Overview

The Audio Slide feature allows admins to create slides that contain an audio track (e.g., podcasts, audio lectures) along with metadata like a title, description, thumbnail, and optional transcript.

## 2. Admin Portal Integration

### 2.1 Create or Update Audio Slide

Use this endpoint to create a new audio slide or update an existing one within a chapter.

- **Endpoint:** `POST /admin-core-service/slide/audio-slide/add-update-audio-slide`
- **Query Parameters:**

  - `chapterId` (Required): ID of the chapter.
  - `moduleId` (Required): ID of the module.
  - `subjectId` (Required): ID of the subject.
  - `packageSessionId` (Required): ID of the package session.
  - `instituteId` (Required): ID of the institute.

- **Request Body (`AddAudioSlideDTO` - snake_case):**

```json
{
  "id": "string (optional, send for update)",
  "title": "string (required)",
  "description": "string (optional)",
  "image_file_id": "string (optional, thumbnail file ID from File Service)",
  "status": "DRAFT | PUBLISHED",
  "slide_order": 1,
  "notify": true,
  "new_slide": true, // <--- IMPORTANT: Send true if creating a new slide (even if you provide an ID)
  "audio_slide": {
    "id": "string (optional, send for update)",
    "audio_file_id": "string (required, audio file ID from File Service)",
    "thumbnail_file_id": "string (optional)",
    "audio_length_in_millis": 0,
    "source_type": "FILE | URL",
    "external_url": "string (optional, if source_type is URL)",
    "transcript": "string (optional)"
  }
}
```

- **Workflow:**
  1.  **Upload Audio:** Admin uploads the audio file using the existing File Service API.
  2.  **Upload Thumbnail (Optional):** Admin uploads a cover image/thumbnail.
  3.  **Submit Form:** calling the above API with the `fileId`s and metadata (using snake_case keys).

### 2.2 Retrieve Audio Slide Details

Use this endpoint to fetch details of an audio slide for editing or viewing.

- **Endpoint:** `GET /admin-core-service/slide/audio-slide/{slideId}`
- **Response Body (`AudioSlideDTO` - snake_case):**

```json
{
  "id": "string",
  "title": "string",
  "description": "string",
  "audio_file_id": "string",
  "thumbnail_file_id": "string",
  "audio_length_in_millis": 120000,
  "published_audio_file_id": "string",
  "published_audio_length_in_millis": 120000,
  "source_type": "FILE",
  "external_url": null,
  "transcript": "string"
}
```

## 3. Learner App Integration (Tracking)

The Learner App must track the user's listening progress similar to how Video Slides are tracked.

### 3.1 Tracking Playback

The audio player should send heartbeat updates or "interval" logs to the backend to track progress.

- **Endpoint:** `POST /admin-core-service/learner/activity/add-activity` (General Activity Log Endpoint)
- **Request Body (`ActivityLogDTO` - snake_case):**

```json
{
  "slide_id": "string",
  "user_id": "string",
  "is_new_activity": false,
  "learner_operation": "AUDIO_LAST_TIMESTAMP",
  "audios": [
    {
      "start_time_in_millis": 0,
      "end_time_in_millis": 10000,
      "playback_speed": 1.0
    }
  ]
}
```

- **Logic:**
  - Send updates periodically (e.g., every 10-30 seconds) or on events (Pause, Seek, End).
  - `start_time_in_millis` and `end_time_in_millis` represent the **segment** of the audio file listened to during that interval.
  - The backend automatically merges overlapping intervals and calculates the total completion percentage.

## 4. Key Enums

- **SlideTypeEnum:** `AUDIO`
- **SlideStatus:** `DRAFT`, `PUBLISHED`
