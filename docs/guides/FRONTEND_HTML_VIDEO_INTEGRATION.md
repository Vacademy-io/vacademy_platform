# HTML Video Slide Support - Frontend Integration Guide

This document outlines the API updates and frontend requirements for integrating the new `HTML_VIDEO` slide type into the Admin and Learner interfaces.

## 1. Overview

A new slide type `HTML_VIDEO` has been introduced. This slide type allows for embedding AI-generated or other HTML-based video content within the course slides.

## 2. Data Structures

### 2.1 New Source Type

The `source_type` field in slide objects can now have the value:

```
"HTML_VIDEO"
```

### 2.2 HTML Video Slide Object (`html_video_slide`)

When `source_type` is `"HTML_VIDEO"`, the slide data will contain a `html_video_slide` object with the following fields:

| Field                    | Type   | Description                                            |
| :----------------------- | :----- | :----------------------------------------------------- |
| `id`                     | String | Unique Identifier for the HTML Video slide source      |
| `url`                    | String | URL of the video/HTML content                          |
| `video_length_in_millis` | Long   | Duration of the video in milliseconds                  |
| `ai_gen_video_id`        | String | ID reference to the AI Generated Video (if applicable) |

## 3. API Changes

### 3.1 Admin API: Get Slides by Chapter

**Endpoint**: `GET /admin/chapters/{chapterId}/slides`

**Response Update**:
The response list now includes slides where `source_type` is `HTML_VIDEO`.

**Example Response Fragment**:

```json
{
  "id": "slide-uuid",
  "title": "Introduction to AI Video",
  "status": "PUBLISHED",
  "source_type": "HTML_VIDEO",
  "slide_order": 1,
  "html_video_slide": {
    "id": "html-video-source-uuid",
    "url": "https://example.com/video/123",
    "video_length_in_millis": 60000,
    "ai_gen_video_id": "ai-gen-123"
  }
}
```

### 3.2 Learner API: Get Slides by Chapter (Open)

**Endpoint**: `GET /chapters/{chapterId}/slides/open`

**Response Update**:
Similar to the Admin API, the learner view now returns `HTML_VIDEO` slides.

- **Note**: `progress_marker` and `percentage_completed` fields are currently returned as `NULL` for this slide type in the initial implementation.

**Example Response Fragment**:

```json
{
  "id": "slide-uuid",
  "title": "Introduction to AI Video",
  "source_type": "HTML_VIDEO",
  "html_video_slide": {
    "id": "html-video-source-uuid",
    "url": "https://example.com/video/123",
    "video_length_in_millis": 60000,
    "ai_gen_video_id": "ai-gen-123"
  },
  "progress_marker": null,
  "percentage_completed": null
}
```

### 3.3 Read Time Calculation

The total read time calculation for a chapter/session now automatically accounts for `HTML_VIDEO` duration (converted from milliseconds to minutes). No specific frontend changes are needed for the _calculation_ itself if it relies on the backend's "read time" or "duration" summary fields, but be aware that `HTML_VIDEO` contributes to this value.

## 4. Work Required (Frontend)

### 4.1 Admin Interface

1.  **Slide Creation/Edit**:
    - Add support for selecting "HTML Video" as a slide type.
    - Form fields required:
      - **URL**: Input for the video/content URL.
      - **Duration**: Input for video length (in milliseconds/seconds).
      - **AI Video ID**: (Optional/Hidden) If linked to the AI video generator flow.
2.  **Slide List**:
    - Ensure the slide list component can render a list item for `HTML_VIDEO` type (icon, label, etc.).

### 4.2 Learner Interface

1.  **Slide Renderer**:
    - Update the slide player/renderer switch case to handle `source_type === 'HTML_VIDEO'`.
    - **Component**: Implement a component to display the content from `html_video_slide.url`.
      - If it's a standard video URL, use a video player.
      - If it's an HTML embed, use an `<iframe>` or appropriate container.
2.  **Navigation**:
    - Ensure "Next/Previous" navigation works for this new slide type.

## 5. Notes

- **Tracking**: Learner tracking (progress updates) for `HTML_VIDEO` is currently integrated into the backend `updateLearnerTrackingForSlide` hooks but explicit progress marking (e.g., "watched 50%") may need frontend implementation to call existing progress APIs if they share the same structure as `VIDEO` slides.
