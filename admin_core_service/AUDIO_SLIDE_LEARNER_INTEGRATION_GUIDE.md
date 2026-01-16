# Audio Slide Learner App Integration Guide

This guide describes how to integrate Audio Slides into the Learner Application, focusing on playback and progress tracking.

## 1. Identification & Data Structure

When fetching a list of slides or course details, each slide object allows you to identify its type and access specific content.

### 1.1 Identifying an Audio Slide

Check the `sourceType` field in the slide object.

- **Value:** `AUDIO`

### 1.2 Data Object

If `sourceType` is `AUDIO`, the slide object will contain a nested `audioSlide` object with the playback details.

**Example JSON Response:**

```json
{
  "id": "slide_123",
  "title": "Podcast: History of Art",
  "description": "Listen to this episode...",
  "sourceType": "AUDIO", // <--- 1. Check this field
  "imageFileId": "file_thumb_1", // Slide thumbnail

  // 2. Access audio details here:
  "audioSlide": {
    "id": "audio_slide_abc",
    "sourceType": "FILE",
    "publishedAudioFileId": "file_audio_999", // <--- USE THIS for playback source
    "publishedAudioLengthInMillis": 300000, // Total duration in ms
    "thumbnailFileId": "file_thumb_1", // Specific audio cover (often same as slide thumbnail)
    "transcript": "Welcome to the podcast...", // Optional transcript text
    "externalUrl": null // Used if sourceType is URL
  }
}
```

**Important Notes:**

- **Playback Source:** Always use `audioSlide.publishedAudioFileId` to fetch the file URL from the File Service.
- **Drafts vs Published:** Do NOT use `audioFileId` (draft version). Always use `published*` fields for learners.

## 2. Tracking Progress

To track learner progress, the app must send regular activity heartbeats to the backend.

### 2.1 API Endpoint

- **URL:** `POST /admin-core-service/learner/activity/add-activity`
- **Auth:** Requires Learner Authentication Token.

### 2.2 Request Payload

Send this payload periodically (e.g., every 15 seconds) or on specific events (Pause, Stop, Seek, Complete).

```json
{
  "slideId": "string (The Parent Slide ID, e.g., 'slide_123')",
  "userId": "string (Current User ID)",
  "isNewActivity": false,
  "learnerOperation": "AUDIO_LAST_TIMESTAMP",
  "audios": [
    {
      "startTimeInMillis": 0, // Start of the listened segment
      "endTimeInMillis": 15000, // End of the listened segment (cumulative for this session or interval)
      "playbackSpeed": 1.5 // Current playback speed (e.g. 1.0, 1.25, 2.0)
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
    - **Formula:** `(Total Unique Duration Listened / publishedAudioLengthInMillis) * 100`.
    - Do NOT calculate percentage on the client side for reporting; trust the backend aggregation.

3.  **Events to Trigger Sync:**
    - **Heartbeat:** Every 15-30 seconds during playback.
    - **Pause:** When user pauses.
    - **Seek:** Before seeking (to save the previous segment).
    - **Leave:** When navigating away from the slide.

## 3. UI Requirements

1.  **Audio Player:**

    - Must support standard playback controls (Play, Pause, Seek, Volume).
    - Should display the `thumbnailFileId` image as album art/cover.
    - Should show `transcript` if available (e.g., in a collapsible "Read Transcript" section).

2.  **Background Playback (Mobile):**

    - If possible, ensure audio continues playing when the screen is locked or app is in background, as this is a common use case for audio learning.

3.  **Speed Control:**
    - Implement playback speed selector (1x, 1.5x, 2x).
    - Ensure the `playbackSpeed` is sent in the tracking payload.
