# Slides & Learner Tracking System - Complete Documentation

> **Last Updated:** January 2026  
> **Module Location:** `vacademy.io.admin_core_service.features.slide` & `vacademy.io.admin_core_service.features.learner_tracking`

---

## 📊 Architecture Overview

The system consists of two main features that work together:

1. **Slide Feature** - Content management (Admin side)
2. **Learner Tracking Feature** - Progress tracking (Learner side)

---

## 🎯 Slide Types

The platform supports **8 types of slides** (defined in `SlideTypeEnum.java`):

| Slide Type       | Description                                 | Source Entity        |
| ---------------- | ------------------------------------------- | -------------------- |
| `VIDEO`          | Regular video content with upload/streaming | `VideoSlide`         |
| `DOCUMENT`       | PDF/document slides                         | `DocumentSlide`      |
| `QUESTION`       | Single question slides                      | `QuestionSlide`      |
| `ASSIGNMENT`     | Assignment submissions                      | `AssignmentSlide`    |
| `VIDEO_QUESTION` | Videos with embedded questions              | `VideoSlideQuestion` |
| `QUIZ`           | Quiz with multiple questions                | `QuizSlide`          |
| `HTML_VIDEO`     | Embedded HTML videos (YouTube, etc.)        | `HtmlVideoSlide`     |
| `SCORM`          | SCORM packages                              | `ScormSlide`         |

### Slide Status Lifecycle (`SlideStatus.java`):

```
DRAFT → PUBLISHED → UNSYNC (if edited) → PUBLISHED (after sync)
                  ↘ DELETED (soft delete)
                  ↘ PENDING_APPROVAL (if workflow enabled)
```

| Status             | Description                              |
| ------------------ | ---------------------------------------- |
| `DRAFT`            | Initial state, not visible to learners   |
| `PUBLISHED`        | Visible to learners                      |
| `UNSYNC`           | Changes made after publish, pending sync |
| `PENDING_APPROVAL` | Awaiting approval in workflow            |
| `DELETED`          | Soft deleted                             |

---

## 🗄️ Database Schema

### Core Slide Tables

```
slide (Main table)
├── id (PK)
├── source_id (FK to type-specific table)
├── source_type (VIDEO/DOCUMENT/etc.)
├── title
├── description
├── image_file_id
├── status
├── parent_id
├── created_by_user_id
├── drip_condition_json
└── timestamps

chapter_to_slides (Junction table)
├── id (PK)
├── chapter_id (FK)
├── slide_id (FK)
├── slide_order
└── status
```

### Type-Specific Tables

- `document_slide` - coverFileId, data, type, totalPages
- `video_slide` - url, description, sourceType, publishedUrl, publishedVideoLength
- `html_video_slide` - url, videoLength
- `quiz_slide` - settings, time_limit
- `question_slide` - questionType, parentRichText, options, explanation
- `assignment_slide` - instructions, dueDate
- `scorm_slide` - packageFileId, entryPoint

---

## 🔧 Admin Side APIs

### SlideController (`/admin-core-service/slide/v1`)

| Endpoint                               | Method | Description                   | Key Parameters                                                          |
| -------------------------------------- | ------ | ----------------------------- | ----------------------------------------------------------------------- |
| `/add-update-document-slide`           | POST   | Add/update document slide     | `chapterId`, `moduleId`, `subjectId`, `packageSessionId`, `instituteId` |
| `/add-update-video-slide`              | POST   | Add/update video slide        | Same as above                                                           |
| `/get-slides/{chapterId}`              | GET    | Get all slides for a chapter  | `chapterId` (path)                                                      |
| `/update-status`                       | PUT    | Update slide status           | `chapterId`, `slideId`, `instituteId`, `status`                         |
| `/update-slide-order`                  | PUT    | Reorder slides within chapter | `chapterId`, `List<UpdateSlideOrderDTO>`                                |
| `/copy`                                | POST   | Copy slide to another chapter | source & target IDs                                                     |
| `/move`                                | POST   | Move slide to another chapter | source & target IDs                                                     |
| `/slides`                              | GET    | Get simple slide list         | `chapterId`                                                             |
| `/slide-counts-by-source-type`         | GET    | Get slide statistics          | `packageSessionId`                                                      |
| `/learner-slide-counts-by-source-type` | GET    | Learner-visible slide stats   | `packageSessionId`                                                      |

### Other Slide Controllers

| Controller                  | Base Path                                     | Purpose                   |
| --------------------------- | --------------------------------------------- | ------------------------- |
| `VideoSlideController`      | `/admin-core-service/slide/video/v1`          | Video-specific operations |
| `HtmlVideoSlideController`  | `/admin-core-service/slide/html-video/v1`     | HTML video operations     |
| `QuestionSlideController`   | `/admin-core-service/slide/question/v1`       | Question slide management |
| `QuizSlideController`       | `/admin-core-service/slide/quiz/v1`           | Quiz management           |
| `AssignmentSlideController` | `/admin-core-service/slide/assignment/v1`     | Assignment management     |
| `ScormController`           | `/admin-core-service/slide/scorm/v1`          | SCORM package handling    |
| `ScormTrackingController`   | `/admin-core-service/slide/scorm-tracking/v1` | SCORM progress tracking   |

---

## 👨‍🎓 Learner Side APIs

### LearnerSlideController (`/admin-core-service/slide/institute-learner/v1`)

| Endpoint                  | Method | Description                        | Response                                   |
| ------------------------- | ------ | ---------------------------------- | ------------------------------------------ |
| `/get-slides-with-status` | GET    | Get slides with learner's progress | `List<SlideDetailWithOperationProjection>` |

**Parameters:**

- `userId` - Learner's user ID
- `chapterId` - Chapter to fetch slides from

**Response includes:**

```java
interface SlideDetailWithOperationProjection {
    // Slide metadata
    String getSlideId();
    String getSlideTitle();
    String getSlideDescription();
    String getSourceType();
    String getStatus();
    String getImageFileId();
    Integer getSlideOrder();
    String getDripConditionJson();

    // Document-specific
    String getDocumentId();
    String getDocumentTitle();
    String getDocumentCoverFileId();
    String getDocumentType();
    String getDocumentData();

    // Video-specific
    String getVideoId();
    String getVideoTitle();
    String getVideoUrl();
    String getVideoDescription();
    String getVideoSourceType();
    String getPublishedUrl();
    String getPublishedData();

    // Progress tracking (joined from learner_operation)
    String getPercentageDocumentWatched();
    String getDocumentLastPage();
    Timestamp getDocumentLastUpdated();
    String getPercentageVideoWatched();
    String getVideoLastTimestamp();
    Timestamp getVideoLastUpdated();
}
```

---

## 📈 Learner Tracking System

### Core Entity: ActivityLog

The central tracking entity that captures learner interactions:

```java
@Entity
@Table(name = "activity_log")
public class ActivityLog {
    String id;                    // Unique activity session ID
    String sourceId;              // Reference to source content
    String sourceType;            // VIDEO/DOCUMENT/etc.
    String userId;                // Learner's user ID
    String slideId;               // Which slide was interacted with
    Timestamp startTime;          // Session start
    Timestamp endTime;            // Session end
    Double percentageWatched;     // Overall completion
    String rawJson;               // Raw tracking data
    String processedJson;         // Processed analytics

    // Related tracked items
    List<DocumentTracked> documentTracked;
    List<VideoTracked> videoTracked;
    List<QuestionSlideTracked> questionSlideTracked;
    List<QuizSlideQuestionTracked> quizSlideQuestionTracked;
    List<AssignmentSlideTracked> assignmentSlideTracked;
    List<VideoSlideQuestionTracked> videoSlideQuestionTracked;
    ConcentrationScore concentrationScore;
}
```

### Tracking Sub-Entities

| Entity                     | Purpose                      | Key Fields                                     |
| -------------------------- | ---------------------------- | ---------------------------------------------- |
| `DocumentTracked`          | Page-level document tracking | `pageNumber`, `watchStartTime`, `watchEndTime` |
| `VideoTracked`             | Video interval tracking      | `startTimeInMillis`, `endTimeInMillis`         |
| `QuestionSlideTracked`     | Question response tracking   | `selectedOptions`, `isCorrect`, `timeTaken`    |
| `QuizSlideQuestionTracked` | Quiz question responses      | `questionId`, `selectedOptions`, `isCorrect`   |
| `AssignmentSlideTracked`   | Assignment submissions       | `fileId`, `submittedAt`, `grade`               |
| `ConcentrationScore`       | Focus/engagement metrics     | `score`, `totalPauses`, `avgFocusTime`         |

---

## 🔄 Tracking Controllers & Endpoints

### LearnerTrackingController (`/admin-core-service/learner-tracking/v1`)

| Endpoint                                | Method | Description                     |
| --------------------------------------- | ------ | ------------------------------- |
| `/add-or-update-document-activity`      | POST   | Track document viewing          |
| `/add-or-update-video-activity`         | POST   | Track video watching            |
| `/add-or-update-html-video-activity`    | POST   | Track HTML video watching       |
| `/get-learner-document-activity-logs`   | GET    | Get document activity history   |
| `/get-learner-video-activity-logs`      | GET    | Get video activity history      |
| `/get-learner-html-video-activity-logs` | GET    | Get HTML video activity history |

### Specialized Tracking Controllers

| Controller                                | Base Path                            | Endpoints                                           |
| ----------------------------------------- | ------------------------------------ | --------------------------------------------------- |
| `QuestionSlideActivityLogController`      | `/activity-log/question-slide`       | `add-or-update-*`, `question-slide-activity-logs`   |
| `QuizSlideActivityLogController`          | `/activity-log/quiz-slide`           | `add-or-update-*`, `quiz-slide-activity-logs`       |
| `AssignmentSlideActivityLogController`    | `/activity-log/assignment-slide`     | `add-or-update-*`, `assignment-slide-activity-logs` |
| `VideoQuestionSlideActivityLogController` | `/activity-log/video-question-slide` | `add-or-update-*`                                   |

### Admin Activity Views

| Controller                     | Endpoint            | Purpose                               |
| ------------------------------ | ------------------- | ------------------------------------- |
| `ActivityLogController`        | `/learner-activity` | View all learner activity for a slide |
| `LearnerActivityLogController` | `/daily-time-spent` | Learner's daily time spent analytics  |

---

## 🔄 Tracking Flow Examples

### Document Tracking Flow

```
1. Learner opens document slide
   ↓
2. Frontend tracks page views and sends:
   ActivityLogDTO {
     id: "uuid",
     slideId: "slide-123",
     newActivity: true,
     startTimeInMillis: 1705410000000,
     documents: [
       { pageNumber: 1, watchStartTime: ..., watchEndTime: ... },
       { pageNumber: 2, watchStartTime: ..., watchEndTime: ... }
     ],
     concentrationScore: { score: 85, totalPauses: 2 }
   }
   ↓
3. POST /admin-core-service/learner-tracking/v1/add-or-update-document-activity
   ↓
4. LearnerTrackingService.addOrUpdateDocumentActivityLog()
   - Validates DTO
   - Saves/Updates ActivityLog entity
   - Saves DocumentTracked entries for each page
   - Saves ConcentrationScore if provided
   ↓
5. ASYNC: LearnerTrackingAsyncService.updateLearnerOperationsForDocument()
   - Finds highest page reached
   - Calculates percentage completed
   - Saves DOCUMENT_LAST_PAGE operation
   - Saves PERCENTAGE_DOCUMENT_COMPLETED operation
   - Triggers cascade update: Chapter → Module → Subject → Package
```

### Video Tracking Flow

```
1. Learner watches video
   ↓
2. Frontend tracks playback intervals and sends:
   ActivityLogDTO {
     id: "uuid",
     slideId: "slide-456",
     newActivity: false,  // Updating existing session
     videos: [
       { startTimeInMillis: 0, endTimeInMillis: 30000 },      // 0-30s
       { startTimeInMillis: 45000, endTimeInMillis: 60000 }   // 45-60s (skipped 30-45s)
     ]
   }
   ↓
3. POST /admin-core-service/learner-tracking/v1/add-or-update-video-activity
   ↓
4. LearnerTrackingService.addOrUpdateVideoActivityLog()
   - Saves VideoTracked entries for each interval
   ↓
5. ASYNC: LearnerTrackingAsyncService.updateLearnerOperationsForVideo()
   - Fetches ALL video intervals from DB for this user+slide
   - Merges overlapping intervals (deduplication!)
   - Calculates unique watched duration
   - Compares with published video length
   - Saves PERCENTAGE_VIDEO_WATCHED (capped at 100%)
   - Saves VIDEO_LAST_TIMESTAMP
   - Triggers cascade update
```

### Quiz Tracking Flow

```
1. Learner submits quiz answer
   ↓
2. ActivityLogDTO {
     slideId: "quiz-slide-789",
     quizSides: [
       {
         questionId: "q1",
         selectedOptions: ["opt-a", "opt-c"],
         isCorrect: true,
         timeTaken: 45
       }
     ]
   }
   ↓
3. POST /activity-log/quiz-slide/add-or-update-quiz-slide-activity-log
   ↓
4. QuizSlideActivityLogService.addOrUpdateQuizSlideActivityLog()
   - Saves QuizSlideQuestionTracked entries
   ↓
5. ASYNC:
   - saveLLMQuizDataAsync() - Capture for AI analytics
   - updateLearnerOperationsForQuiz() - Calculate completion %
```

---

## 📊 Progress Aggregation Hierarchy

The system calculates progress at multiple levels using **learner operations**:

```
┌─────────────────────────────────────────────────────────────┐
│ PACKAGE_SESSION Level                                        │
│   PERCENTAGE_PACKAGE_SESSION_COMPLETED = avg(subjects)      │
├─────────────────────────────────────────────────────────────┤
│ SUBJECT Level                                                │
│   PERCENTAGE_SUBJECT_COMPLETED = avg(modules)               │
├─────────────────────────────────────────────────────────────┤
│ MODULE Level                                                 │
│   PERCENTAGE_MODULE_COMPLETED = avg(chapters)               │
├─────────────────────────────────────────────────────────────┤
│ CHAPTER Level                                                │
│   PERCENTAGE_CHAPTER_COMPLETED = avg(slides)                │
│   LAST_SLIDE_VIEWED = slideId                               │
├─────────────────────────────────────────────────────────────┤
│ SLIDE Level                                                  │
│   PERCENTAGE_VIDEO_WATCHED                                   │
│   PERCENTAGE_DOCUMENT_COMPLETED                              │
│   PERCENTAGE_QUIZ_COMPLETED                                  │
│   PERCENTAGE_QUESTION_COMPLETED                              │
│   PERCENTAGE_ASSIGNMENT_COMPLETED                            │
│   VIDEO_LAST_TIMESTAMP                                       │
│   DOCUMENT_LAST_PAGE                                         │
└─────────────────────────────────────────────────────────────┘
```

### Aggregation Logic (in LearnerTrackingAsyncService)

```java
// Chapter completion = average of all slide completions
Double chapterPercentage = activityLogRepository.getChapterCompletionPercentage(
    userId, chapterId,
    List.of(
        "PERCENTAGE_VIDEO_WATCHED",
        "PERCENTAGE_DOCUMENT_COMPLETED",
        "PERCENTAGE_ASSIGNMENT_COMPLETED",
        "PERCENTAGE_QUESTION_COMPLETED",
        "PERCENTAGE_QUIZ_COMPLETED"
    ),
    List.of("PUBLISHED", "UNSYNC"),  // Only count published slides
    List.of("VIDEO", "DOCUMENT", "ASSIGNMENT", "QUESTION", "QUIZ", "HTML_VIDEO")
);

// Module completion = average of chapter completions
Double modulePercentage = activityLogRepository.getModuleCompletionPercentage(
    userId, moduleId,
    List.of("PERCENTAGE_CHAPTER_COMPLETED"),
    List.of("ACTIVE")  // Only active chapters
);
```

---

## 🔑 Key Design Patterns

### 1. Async Processing

All cascading updates are `@Async` to avoid blocking the main request:

```java
@Async
@Transactional
public void updateLearnerOperationsForVideo(String userId, String slideId, ...) {
    // Heavy calculations done in background thread
    // Uses ExecutorService with fixed thread pool (10 threads)
}
```

### 2. Video Interval Merging (Deduplication)

Smart handling of overlapping watch intervals to calculate accurate watch time:

```java
public long getUniqueWatchedDurationMillis(List<VideoInterval> intervals) {
    // Sort by start time
    intervals.sort(Comparator.comparing(VideoInterval::start));

    // Merge overlapping intervals
    List<VideoInterval> merged = new ArrayList<>();
    // ... merging logic ...

    // Sum unique durations
    return merged.stream()
        .mapToLong(i -> Duration.between(i.start(), i.end()).toMillis())
        .sum();
}
```

**Example:**

```
Input intervals:  [0-30s], [20-50s], [60-90s]
Merged:           [0-50s], [60-90s]
Total unique:     80 seconds (not 110s from naive sum)
```

### 3. Percentage Capping

All percentages are capped at 100% to handle edge cases:

```java
private void addOrUpdatePercentageOperation(..., Double value) {
    if (value == null) return;
    if (value > 100.0) {
        value = 100.0;  // Cap at 100%
    }
    learnerOperationService.addOrUpdateOperation(...);
}
```

### 4. LLM Analytics Integration

Quiz and question data is captured for AI-powered learning analytics:

```java
@Async
@Transactional
public void saveLLMQuizDataAsync(String activityLogId, String slideId, ...) {
    activityLogRepository.findById(activityLogId).ifPresent(activityLog -> {
        llmActivityAnalyticsService.saveQuizRawData(
            activityLog,
            activityLogDTO.getQuizSides(),
            slideId, chapterId, packageSessionId, subjectId
        );
    });
}
```

---

## 📁 File Structure

```
slide/
├── controller/
│   ├── SlideController.java           # Main admin slide APIs
│   ├── LearnerSlideController.java    # Learner slide APIs
│   ├── VideoSlideController.java
│   ├── HtmlVideoSlideController.java
│   ├── QuestionSlideController.java
│   ├── QuizSlideController.java
│   ├── AssignmentSlideController.java
│   ├── ScormController.java
│   └── ScormTrackingController.java
├── dto/
│   ├── AddDocumentSlideDTO.java
│   ├── AddVideoSlideDTO.java
│   ├── SlideDetailProjection.java
│   ├── SlideDetailWithOperationProjection.java
│   └── ... (30 DTOs total)
├── entity/
│   ├── Slide.java                     # Core slide entity
│   ├── DocumentSlide.java
│   ├── VideoSlide.java
│   ├── QuizSlide.java
│   └── ... (15 entities total)
├── enums/
│   ├── SlideTypeEnum.java
│   ├── SlideStatus.java
│   └── ...
├── repository/
│   └── ... (14 repositories)
└── service/
    ├── SlideService.java              # Main slide operations
    ├── LearnerSlideService.java       # Learner-facing queries
    ├── VideoSlideService.java
    └── ... (13 services total)

learner_tracking/
├── controller/
│   ├── LearnerTrackingController.java
│   ├── ActivityLogController.java
│   ├── LearnerActivityLogController.java
│   ├── QuestionSlideActivityLogController.java
│   ├── QuizSlideActivityLogController.java
│   ├── AssignmentSlideActivityLogController.java
│   └── VideoQuestionSlideActivityLogController.java
├── dto/
│   ├── ActivityLogDTO.java            # Main tracking DTO
│   ├── DocumentActivityLogDTO.java
│   ├── VideoActivityLogDTO.java
│   └── ... (13 DTOs total)
├── entity/
│   ├── ActivityLog.java               # Core tracking entity
│   ├── DocumentTracked.java
│   ├── VideoTracked.java
│   ├── ConcentrationScore.java
│   └── ... (8 entities total)
├── repository/
│   └── ... (9 repositories)
├── service/
│   ├── LearnerTrackingService.java    # Main tracking operations
│   ├── LearnerTrackingAsyncService.java  # Async progress updates
│   ├── ActivityLogProcessorService.java
│   ├── LLMActivityAnalyticsService.java  # AI analytics
│   └── ... (12 services total)
└── util/
    └── ...
```

---

## 🔐 Caching

The learner slide endpoint uses client-side caching:

```java
@GetMapping("/get-slides-with-status")
@ClientCacheable(maxAgeSeconds = 60, scope = CacheScope.PRIVATE, varyHeaders = {"X-User-Id"})
public ResponseEntity<List<SlideDetailWithOperationProjection>> getLearnerSlides(...) {
    // Cached for 60 seconds per user
}
```

---

## 📝 Usage Examples

### Frontend: Track Document Progress

```typescript
const trackDocumentProgress = async (slideId: string, pages: PageView[]) => {
  const response = await fetch(
    "/admin-core-service/learner-tracking/v1/add-or-update-document-activity",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: generateUUID(),
        slide_id: slideId,
        new_activity: true,
        start_time_in_millis: Date.now(),
        documents: pages.map((p) => ({
          page_number: p.pageNumber,
          watch_start_time: p.startTime,
          watch_end_time: p.endTime,
        })),
      }),
      params: {
        slideId,
        chapterId,
        packageSessionId,
        moduleId,
        subjectId,
      },
    }
  );
  return response.json();
};
```

### Frontend: Track Video Progress

```typescript
const trackVideoProgress = async (
  slideId: string,
  intervals: VideoInterval[]
) => {
  await fetch(
    "/admin-core-service/learner-tracking/v1/add-or-update-video-activity",
    {
      method: "POST",
      body: JSON.stringify({
        id: activityId,
        slide_id: slideId,
        new_activity: false, // Update existing session
        videos: intervals.map((i) => ({
          start_time_in_millis: i.start,
          end_time_in_millis: i.end,
        })),
      }),
      params: { slideId, chapterId, packageSessionId, moduleId, subjectId },
    }
  );
};
```

---

## 🔗 Related Features

- **Learner Operations** (`features/learner_operation`) - Stores computed progress values
- **Certificates** - Uses `PERCENTAGE_PACKAGE_SESSION_COMPLETED` for criteria
- **Analytics Dashboard** - Queries activity logs for reports
- **AI Chatbot** - Uses LLM analytics data for personalized learning
