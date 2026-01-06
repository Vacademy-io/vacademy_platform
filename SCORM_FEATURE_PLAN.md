# SCORM Feature Implementation Plan

This document outlines the architectural plan for adding SCORM (Sharable Content Object Reference Model) support to the platform.

## 1. Overview

SCORM support allows the platform to host interactive e-learning packages exported from distinct authoring tools (Articulate, Captivate, etc.).
The implementation involves:

1.  **Uploading & Processing**: Unzipping SCORM packages and identifying the launch file (`index.html`, `story.html`, etc.).
2.  **Serving**: Hosting the extracted files publicly or via signed URLs.
3.  **Playback**: Rendering the content in an iframe.
4.  **Tracking**: Implementing the SCORM Run-Time Environment (RTE) API to capture scores, completion status, and session time.

## 2. Database Schema

### 2.1 New Table: `scorm_slide`

Stores metadata about the specific SCORM package source.

```sql
CREATE TABLE scorm_slide (
    id VARCHAR(255) PRIMARY KEY,
    title VARCHAR(255),
    -- Reference to the original zip file in SystemFile or separate storage
    original_file_id VARCHAR(255),
    -- The relative path to the launch file (e.g., 'scorm_pkg_123/index.html')
    launch_path VARCHAR(512),
    -- SCORM Version (e.g., '1.2', '2004_3rd', '2004_4th')
    scorm_version VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 2.2 Learner Tracking Updates

We need to store SCORM CMI (Computer Managed Instruction) data. Use a dedicated table or a JSONB column in `learner_operation`.

**Recommendation**: A new `scorm_learner_progress` table for structured tracking.

```sql
CREATE TABLE scorm_learner_progress (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    slide_id VARCHAR(255) NOT NULL, -- references slide(id)
    attempt_number INT DEFAULT 1,

    -- Core SCORM Status
    completion_status VARCHAR(50), -- 'completed', 'incomplete', 'passed', 'failed'
    success_status VARCHAR(50),    -- 'passed', 'failed', 'unknown'
    score_raw DOUBLE PRECISION,
    score_min DOUBLE PRECISION,
    score_max DOUBLE PRECISION,

    -- Session Time (in standard SCORM duration format PT1H30M)
    total_time VARCHAR(50),

    -- The "Bookmark" or Suspend Data (can be large)
    cmi_suspend_data TEXT,

    -- Full state JSON for detailed analysis (optional)
    cmi_json JSONB,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, slide_id, attempt_number)
);
```

## 3. Backend Implementation (Java)

### 3.1 `ScormService`

- **Upload Processing**:
  - Accept `.zip` file upload.
  - Unzip to a persistent storage location (e.g., S3 bucket under `scorm-content/{slideId}/`).
  - **Manifest Parsing**: Read `imsmanifest.xml` to find the `<resource>` with `adlcp:scormType="sco"` and its `href`. This is the `launch_path`.
  - Detect SCORM version (1.2 vs 2004) from the manifest namespace or metadata.
- **CRUD**: Standard create/update/copy logic akin to `VideoSlide`.

### 3.2 `ScormTrackingController`

Endpoints for the frontend SCORM player to communicate with.

- `GET /api/scorm/init/{slideId}`: Returns current CMI data (suspend_data, status) for the user.
- `POST /api/scorm/commit/{slideId}`: Receives updated CMI data from the browser and saves to `scorm_learner_progress`.

### 3.3 `SlideService` & Repository Updates

- Add `SCORM` to `SlideTypeEnum`.
- Update `SlideRepository` queries (`getSlidesByChapterId`, read time calc) to include `scorm_slide`.
- Update `copySlideByType` to handle deep copying of SCORM slides (pointing to same file path vs duplicating storage).

## 4. Frontend Implementation

### 4.1 Admin: SCORM Upload

- **Component**: `ScormUploadDragger`.
- **Logic**:
  - Validates `.zip` extension.
  - Uploads to backend.
  - Polls for "Processing" status (unzipping can take time).
  - Displays extracted metadata (Entry File: `index.html`) for confirmation.

### 4.2 Learner: SCORM Player

- **Component**: `ScormPlayer`.
- **Logic**:
  - Creates an `<iframe>` pointing to the `launch_path` URL.
  - **API Bridge**: Injects the SCORM API object (`window.API` for 1.2, `window.API_1484_11` for 2004) into the parent window so the iframe can find it.
  - **Events**:
    - `LMSInitialize()`: Calls backend `init` to get previous state.
    - `LMSSetValue()`: Updates local state.
    - `LMSCommit()`: Flushes local state to backend `commit` endpoint.
    - `LMSFinish()`: Marks session end.

## 5. Security & Hosting

- **Same-Origin Policy**: The unzipped HTML files must be served from a domain that allows the iframe to communicate with the parent (using `postMessage` or same domain).
  - _Option A_: Serve SCORM content from the same domain (e.g., `/content/scorm/...`).
  - _Option B_: Cross-domain (CDN) requires proper CORS and potentially a `postMessage` proxy in the SCORM content (harder to inject).

## 6. Development Phasing

1.  **Phase 1: Admin Upload & Storage**
    - Table creation.
    - Upload & Unzip logic.
    - Manifest parsing.
2.  **Phase 2: Basic Playback**
    - Serve unzipped files.
    - Frontend iframe player.
3.  **Phase 3: Tracking (SCORM 1.2)**
    - Implement `window.API`.
    - Backend tracking endpoints.
4.  **Phase 4: Advanced (SCORM 2004)**
    - Implement `window.API_1484_11` (more complex data model).

## 7. Dependencies

- **Unzipping**: `java.util.zip` or Apache Commons Compress.
- **XML Parsing**: standard Java XML parsers for `imsmanifest.xml`.
