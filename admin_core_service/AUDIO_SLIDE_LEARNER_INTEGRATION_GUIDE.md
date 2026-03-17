# Audio Slide Learner App Integration Guide

This guide describes how to integrate Audio Slides into the Learner Application, focusing on playback and progress tracking.

## 1. Identification & Data Structure

When fetching a list of slides or course details, each slide object allows you to identify its type and access specific content.

### 1.1 Identifying an Audio Slide

Check the `source_type` field in the slide object (Response JSON is in snake_case).

- **Value:** `AUDIO`

### 1.2 Data Object

If `source_type` is `AUDIO`, the slide object will contain a nested `audio_slide` object with the playback details.

**Example JSON Response:**

```json
{
  "id": "slide_123",
  "title": "Podcast: History of Art",
  "description": "Listen to this episode...",
  "source_type": "AUDIO", // <--- 1. Check this field
  "image_file_id": "file_thumb_1", // Slide thumbnail

  // 2. Access audio details here:
  "audio_slide": {
    "id": "audio_slide_abc",
    "source_type": "FILE",
    "published_audio_file_id": "file_audio_999", // <--- USE THIS for playback source
    "published_audio_length_in_millis": 300000, // Total duration in ms
    "thumbnail_file_id": "file_thumb_1", // Specific audio cover (often same as slide thumbnail)
    "transcript": "Welcome to the podcast...", // Optional transcript text
    "external_url": null // Used if source_type is URL
  }
}
```

**Important Notes:**

- **Playback Source:** Always use `audio_slide.published_audio_file_id` to fetch the file URL from the File Service.
- **Drafts vs Published:** Do NOT use `audio_file_id` (draft version). Always use `published*` fields for learners.

## 2. Tracking Progress

To track learner progress, the app must send regular activity heartbeats to the backend.

### 2.1 API Endpoint

- **URL:** `POST /admin-core-service/learner/activity/add-activity`
- **Auth:** Requires Learner Authentication Token.

### 2.2 Request Payload

Send this payload periodically (e.g., every 15 seconds) or on specific events (Pause, Stop, Seek, Complete).
**Note:** All fields are in **snake_case**.

```json
{
  "slide_id": "string (The Parent Slide ID, e.g., 'slide_123')",
  "user_id": "string (Current User ID)",
  "is_new_activity": false,
  "learner_operation": "AUDIO_LAST_TIMESTAMP",
  "audios": [
    {
      "start_time_in_millis": 0, // Start of the listened segment
      "end_time_in_millis": 15000, // End of the listened segment (cumulative for this session or interval)
      "playback_speed": 1.5 // Current playback speed (e.g. 1.0, 1.25, 2.0)
    }
  ]
}
```

### 2.3 Implementation Logic

1.  **Interval Tracking:**

    - The backend calculates progress based on **unique intervals** listened to.
    - You can send the _current session's_ listened segment.
    - **Example:** User listens from 0:00 to 0:15. Send `start: 0, end: 15000`.
    - User seeks to 1:00 and listens to 1:10. Send `start: 60000, end: 70000`.

2.  **Completion:**

    - The backend automatically merges these intervals to calculate percentage.
    - **Formula:** `(Total Unique Duration Listened / published_audio_length_in_millis) * 100`.
    - Do NOT calculate percentage on the client side for reporting; trust the backend aggregation.

3.  **Events to Trigger Sync:**
    - **Heartbeat:** Every 15-30 seconds during playback.
    - **Pause:** When user pauses.
    - **Seek:** Before seeking (to save the previous segment).
    - **Leave:** When navigating away from the slide.

## 3. UI Requirements

1.  **Audio Player:**

    - Must support standard playback controls (Play, Pause, Seek, Volume).
    - Should display the `thumbnail_file_id` image as album art/cover.
    - Should show `transcript` if available (e.g., in a collapsible "Read Transcript" section).

2.  **Background Playback (Mobile):**

    - If possible, ensure audio continues playing when the screen is locked or app is in background, as this is a common use case for audio learning.

3.  **Speed Control:**
    - Implement playback speed selector (1x, 1.5x, 2x).
    - Ensure the `playback_speed` is sent in the tracking payload.
