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

- **Request Body (`AddAudioSlideDTO`):**

```json
{
  "id": "string (optional, send for update)",
  "title": "string (required)",
  "description": "string (optional)",
  "imageFileId": "string (optional, thumbnail file ID from File Service)",
  "status": "DRAFT | PUBLISHED",
  "slideOrder": 1,
  "notify": true,
  "audioSlide": {
    "id": "string (optional, send for update)",
    "audioFileId": "string (required, audio file ID from File Service)",
    "thumbnailFileId": "string (optional)",
    "audioLengthInMillis": 0,
    "sourceType": "FILE | URL",
    "externalUrl": "string (optional, if sourceType is URL)",
    "transcript": "string (optional)"
  }
}
```

- **Workflow:**
  1.  **Upload Audio:** Admin uploads the audio file using the existing File Service API. reliable return generic `fileId`.
  2.  **Upload Thumbnail (Optional):** Admin uploads a cover image/thumbnail.
  3.  **Submit Form:** calling the above API with the `fileId`s and metadata.

### 2.2 Retrieve Audio Slide Details

Use this endpoint to fetch details of an audio slide for editing or viewing.

- **Endpoint:** `GET /admin-core-service/slide/audio-slide/{slideId}`
- **Response Body (`AudioSlideDTO`):**

```json
{
  "id": "string",
  "title": "string",
  "description": "string",
  "audioFileId": "string",
  "thumbnailFileId": "string",
  "audioLengthInMillis": 120000,
  "publishedAudioFileId": "string",
  "publishedAudioLengthInMillis": 120000,
  "sourceType": "FILE",
  "externalUrl": null,
  "transcript": "string"
}
```

## 3. Learner App Integration (Tracking)

The Learner App must track the user's listening progress similar to how Video Slides are tracked.

### 3.1 Tracking Playback

The audio player should send heartbeat updates or "interval" logs to the backend to track progress.

- **Endpoint:** `POST /admin-core-service/learner/activity/add-activity` (General Activity Log Endpoint)
- **Request Body (`ActivityLogDTO`):**

```json
{
  "slideId": "string",
  "userId": "string",
  "isNewActivity": false,
  "learnerOperation": "AUDIO_LAST_TIMESTAMP",
  "audios": [
    {
      "startTimeInMillis": 0,
      "endTimeInMillis": 10000,
      "playbackSpeed": 1.0
    }
  ]
}
```

- **Logic:**
  - Send updates periodically (e.g., every 10-30 seconds) or on events (Pause, Seek, End).
  - `startTimeInMillis` and `endTimeInMillis` represent the **segment** of the audio file listened to during that interval.
  - The backend automatically merges overlapping intervals and calculates the total completion percentage.

### 3.2 Completion Logic

- **Completion:** The backend calculates completion percentage based on the unique duration covered by the tracked intervals against the `publishedAudioLengthInMillis`.
- **UI Status:** The UI can use the standard course/chapter progress APIs, which now include Audio Slide progress in their calculations.

## 4. Key Enums

- **SlideTypeEnum:** `AUDIO`
- **SlideStatus:** `DRAFT`, `PUBLISHED`
