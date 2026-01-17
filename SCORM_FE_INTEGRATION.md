# SCORM Frontend Integration Guide

This document outlines the frontend integration steps for SCORM 1.2/2004 support in the Vacademy Platform, covering both the Admin (Upload) and Learner (Player) experiences.

## 1. Admin: SCORM Package Upload

The admin interface needs to allow instructors to upload a SCORM zip package and then attach it to a slide within a chapter.

### API Endpoints

1.  **Upload Package**

    - **Endpoint**: `POST /admin-core-service/scorm/v1/upload`
    - **Content-Type**: `multipart/form-data`
    - **Payload**: `file` (The .zip file)
    - **Response**: `ScormSlideDTO`
      ```json
      {
        "id": "scorm_slide_uuid",
        "launch_path": "scorm/{uuid}/index.html",
        "original_file_id": "scorm/{uuid}",
        "scorm_version": "1.2"
      }
      ```

2.  **Add/Update Slide**
    - **Endpoint**: `POST /admin-core-service/scorm/v1/add-or-update`
    - **Payload**: `AddScormSlideDTO`
      ```json
      {
        "title": "My SCORM Module",
        "description": "Description...",
        "status": "PUBLISHED", // or DRAFT
        "slide_order": 1,
        "new_slide": true, // true for creation
        "id": "slide_uuid", // pass if updating, or generating new
        "scorm_slide": {
          "id": "scorm_slide_uuid" // Returned from upload step
        }
      }
      ```
    - **Query Params**: `chapterId`, `instituteId`, `packageSessionId`, `moduleId`, `subjectId`

### UI Implementation (Suggested)

1.  **Upload Component**:
    - Use a file drag-and-drop zone accepting `.zip` files.
    - On drop:
      1.  Show progress bar.
      2.  Call `/upload` endpoint.
      3.  On success, store the returned `scorm_slide.id`.
      4.  Display the parsed title or allow user to edit "Slide Title" and "Description".
2.  **Save Slide**:
    - When user clicks "Save" on the slide editor:
      - Construct `AddScormSlideDTO`.
      - Call `/add-or-update`.

---

## 2. Learner: SCORM Player

The learner player is responsible for initializing the SCORM API adapter, loading the content in an iframe, and communicating progress to the backend.

### Architecture

- **Wrapper Component**: A React/Frontend component that acts as the SCORM Host.
- **Iframe**: loads the `launch_path` of the SCORM package.
- **Window.API (SCORM 1.2) / Window.API_1484_11 (SCORM 2004)**: The wrapper MUST expose these objects on the `window` (or managing iframe communication) so the content can find them.

### API Endpoints (Learner Tracking)

1.  **Initialize Session**

    - **Endpoint**: `GET /admin-core-service/scorm/tracking/v1/{slideId}/initialize`
    - **Query Params**: `packageSessionId`
    - **Response**: `ScormTrackingDTO` (Initial or stored CMI data)
      ```json
      {
          "cmi_core_lesson_status": "incomplete",
          "cmi_suspend_data": "...",
          ...
      }
      ```

2.  **Commit Data (LMSCommit)**
    - **Endpoint**: `POST /admin-core-service/scorm/tracking/v1/commit`
    - **Payload**: `ScormTrackingDTO`
      ```json
      {
        "scorm_slide_id": "...",
        "package_session_id": "...",
        "cmi_core_lesson_status": "completed",
        "cmi_core_score_raw": "80",
        "cmi_suspend_data": "viewed_slide_1",
        "cmi_core_session_time": "00:10:00"
      }
      ```

### Player Implementation Logic

1.  **Initialization**:

    - When the slide loads, fetch existing progress via `/initialize`.
    - Implement the SCORM API Adapter (JavaScript object `window.API` for 1.2).
    - **LMSInitialize()**: Return "true".
    - **LMSGetValue(model)**: Return mapped value from the initial fetched data (e.g., `cmi.suspend_data`).
    - **LMSSetValue(model, value)**: Update local state for that model.
    - **LMSCommit()**: Send the _current_ local state to the backend `/commit` endpoint.
    - **LMSFinish()**: Final commit and cleanup.

2.  **Iframe Loading**:

    - Set iframe `src` to the `launch_path` URL (served via Media Service/CDN).
    - Ensure the iframe can access `window.parent.API`.

3.  **Cross-Origin Considerations**:
    - If content is on a different domain (e.g., S3 CDN), you may need `postMessage` proxying instead of direct `window.parent` access.

### Reference SCORM 1.2 API Stubs

```javascript
window.API = {
  LMSInitialize: function () {
    return "true";
  },
  LMSGetValue: function (key) {
    /* return value from local state */
  },
  LMSSetValue: function (key, val) {
    /* update local state */ return "true";
  },
  LMSCommit: function () {
    /* POST to backend */ return "true";
  },
  LMSFinish: function () {
    /* Finalize */ return "true";
  },
  LMSGetLastError: function () {
    return "0";
  },
  LMSGetErrorString: function (code) {
    return "No error";
  },
  LMSGetDiagnostic: function (code) {
    return "No error";
  },
};
```
