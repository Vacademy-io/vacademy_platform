# Adding a New Slide Type - Developer Checklist

This document provides a comprehensive checklist for adding a new slide type (e.g., `AUDIO`, `INTERACTIVE`, `SIMULATION`) to the Vacademy platform. Use the Audio Slide implementation as a reference.

---

## 1. Enums

### 1.1 `SlideTypeEnum.java`

**Path:** `features/slide/enums/SlideTypeEnum.java`

Add the new slide type constant.

```java
public enum SlideTypeEnum {
    VIDEO,
    DOCUMENT,
    // ... existing types
    AUDIO,       // <-- Example: Add your new type here
    INTERACTIVE  // <-- Your new type
}
```

### 1.2 `LearnerOperationEnum.java` (If Tracking is needed)

**Path:** `features/learner_operation/enums/LearnerOperationEnum.java`

If the new slide type requires progress tracking, add relevant operation enums.

```java
PERCENTAGE_AUDIO_LISTENED,  // For progress percentage
AUDIO_LAST_TIMESTAMP,       // For last position
// Add similar for your new type:
PERCENTAGE_INTERACTIVE_COMPLETED,
INTERACTIVE_LAST_STATE,
```

---

## 2. Database

### 2.1 Migration Script

**Path:** `src/main/resources/db/migration/V<version>__<description>.sql`

Create a new table for the slide type's specific data.

**Example (`V88_audio_slide_migration.sql`):**

```sql
CREATE TABLE IF NOT EXISTS audio_slide (
    id VARCHAR(255) PRIMARY KEY,
    title VARCHAR(255),
    audio_file_id VARCHAR(255),
    -- ... other specific columns
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- If tracking is needed:
CREATE TABLE IF NOT EXISTS audio_tracked (
    id VARCHAR(255) PRIMARY KEY,
    activity_id VARCHAR(255) REFERENCES activity_log(id),
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    -- ... other tracking columns
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_audio_tracked_activity ON audio_tracked(activity_id);
```

---

## 3. Entities

### 3.1 Main Slide Entity

**Path:** `features/slide/entity/<NewType>Slide.java`

Create the JPA entity for the new slide type.

**Required:**

- `@Entity`, `@Table`, `@Id` annotations.
- A constructor from DTO.
- A `toDTO()` method.
- An `updateFromDTO()` method for updates.

### 3.2 Tracking Entity (If applicable)

**Path:** `features/learner_tracking/entity/<NewType>Tracked.java`

Create an entity to store individual tracking records (e.g., time intervals, page views).

**Required:**

- `activityId` field linking to `ActivityLog`.
- A constructor from DTO.
- A `toDTO()` method.

---

## 4. DTOs

### 4.1 Slide DTO

**Path:** `features/slide/dto/<NewType>SlideDTO.java`

Create the DTO for API input/output.

### 4.2 Add DTO (Simplified)

**Path:** `features/slide/dto/Add<NewType>SlideDTO.java`

Create a simplified DTO for Admin create/update operations if needed.

### 4.3 Activity Log DTO (If tracking)

**Path:** `features/learner_tracking/dto/<NewType>ActivityLogDTO.java`

Create a DTO for the tracking data sent by the client.

### 4.4 Update `SlideDTO.java`

**Path:** `features/slide/dto/SlideDTO.java`

Add a field for the new slide type's DTO.

```java
public class SlideDTO {
    // ... existing fields
    private AudioSlideDTO audioSlide;
    private InteractiveSlideDTO interactiveSlide; // <-- Add this
}
```

### 4.6 Update `LearnerSlidesDetailDTO.java`

**Path:** `features/learner_study_library/dto/LearnerSlidesDetailDTO.java`

Add a field for the new slide type's DTO to ensure it is mapped correctly in the Learner API.

```java
public class LearnerSlidesDetailDTO {
    // ... existing fields
    private InteractiveSlideDTO interactiveSlide; // <-- Add this
}
```

### 4.7 Update `ActivityLogDTO.java` (If tracking)

**Path:** `features/learner_tracking/dto/ActivityLogDTO.java`

Add a list field for the new tracking type.

```java
public class ActivityLogDTO {
    // ... existing fields
    private List<AudioActivityLogDTO> audios;
    private List<InteractiveActivityLogDTO> interactives; // <-- Add this
}
```

---

## 5. Repositories

### 5.1 Slide Repository

**Path:** `features/slide/repository/<NewType>SlideRepository.java`

Create a JPA repository for the slide entity. Add any custom queries needed for tracking (e.g., `getPublishedLength`).

### 5.2 Tracked Repository (If tracking)

**Path:** `features/learner_tracking/repository/<NewType>TrackedRepository.java`

Create a repository for the tracking entity. Must include a `deleteByActivityId` method.

```java
@Modifying
@Transactional
@Query("DELETE FROM AudioTracked a WHERE a.activityId = :activityId")
void deleteByActivityId(@Param("activityId") String activityId);
```

### 5.3 Update `SlideRepository.java`

**Path:** `features/slide/repository/SlideRepository.java`

You MUST update the native SQL queries to include the new slide type in the results. FAILURE TO DO THIS WILL RESULT IN THE SLIDE NOT APPEARING IN THE LIST.

**Queries to Update:**

1.  `getSlidesByChapterId` (Admin version) - Add a `UNION ALL` block for basic slide details.
2.  `getSlidesByChapterId` (Learner version with `userId`) - Add a `UNION ALL` block that includes `learner_operation` joins for progress tracking.
3.  `getSlidesByChapterIdOpen` (Guest/Public version) - Add a `UNION ALL` block with `NULL` for progress markers.

**Example (Admin Query Pattern):**

```sql
UNION ALL
-- NEW SLIDE TYPE
SELECT
    s.created_at,
    cs.slide_order,
    json_build_object(
        'id', s.id,
        'title', s.title,
        'status', s.status,
        -- ... common fields
        'new_slide_type', json_build_object(
            'id', n.id,
            'some_specific_field', n.some_specific_field
            -- ... specific fields
        )
    ) AS slide_data
FROM slide s
JOIN chapter_to_slides cs ON cs.slide_id = s.id
JOIN chapter c ON c.id = cs.chapter_id
JOIN new_slide_type n ON n.id = s.source_id
WHERE s.source_type = 'NEW_TYPE' AND c.id = :chapterId
AND s.status IN (:slideStatus)
AND cs.status IN (:chapterToSlidesStatus)
```

### 5.4 Update `ChapterRepository.java`

**Path:** `features/chapter/repository/ChapterRepository.java`

The query `getChaptersAndSlidesByModuleIdAndPackageSessionId` constructs a complex JSON response using Common Table Expressions (CTEs). You MUST:

1.  Add a new CTE for your slide type (e.g., `audio_slides AS (...)`).
2.  Add a `UNION ALL` clause to the `all_slides` CTE to include your new CTE.

**Example CTE:**

```sql
your_new_slides AS (
    SELECT
        vs.chapter_id,
        vs.created_at,
        vs.slide_order,
        json_build_object(
            'id', vs.slide_id,
           -- ... common fields
            'new_slide_type', json_build_object(
                'id', n.id,
                -- ... specific fields
            )
        ) AS slide_data
    FROM valid_slides vs
    JOIN new_slide_type n ON n.id = vs.source_id
    WHERE vs.source_type = 'NEW_TYPE'
),
```

**Example Union:**

```sql
all_slides AS (
    SELECT * FROM video_slides
    UNION ALL
    -- ...
    UNION ALL
    SELECT * FROM your_new_slides -- <-- Add this
)
```

---

## 6. Services

### 6.1 Slide Service

**Path:** `features/slide/service/<NewType>SlideService.java`

Implement CRUD operations:

- `addOrUpdate<NewType>Slide()`
- Helper methods for creating `Slide`, the specific entity, and `ChapterToSlides` mapping.

**Key Integrations:**

- Inject `SlideRepository`, `ChapterToSlidesRepository`, `ChapterRepository`.
- Use `SlideNotificationService.sendNotificationForAddingSlide()` for publish notifications.

### 6.2 Controller

**Path:** `features/slide/controller/<NewType>SlideController.java`

Expose REST endpoints for the Admin Portal.

---

## 7. Tracking Integration (If applicable)

### 7.1 `LearnerTrackingService.java`

**Path:** `features/learner_tracking/service/LearnerTrackingService.java`

Add methods:

- `addOrUpdate<NewType>ActivityLog()` - Main handler.
- `save<NewType>Tracking()` - Saves tracking records.
- `validate<NewType>ActivityLogDTO()` - Validates input.
- `get<NewType>ActivityLogs()` - Retrieves logs for a slide.

### 7.2 `LearnerTrackingAsyncService.java`

**Path:** `features/learner_tracking/service/LearnerTrackingAsyncService.java`

Add async method for progress calculation:

- `updateLearnerOperationsFor<NewType>()` - Calculates and saves percentage.

### 7.3 `LearnerTrackingController.java`

**Path:** `features/learner_tracking/controller/LearnerTrackingController.java`

Add endpoints:

- `POST /add-<new-type>-activity`
- `GET /get-<new-type>-activity-logs`

### 7.4 `ActivityLogRepository.java`

**Path:** `features/learner_tracking/repository/ActivityLogRepository.java`

Add queries:

- `findActivityLogsWithNewTypes()` - For fetching logs with new tracking data.
- `get<NewType>TrackedIntervals()` - For progress calculation.

### 7.5 `ActivityLog.java` Entity

**Path:** `features/learner_tracking/entity/ActivityLog.java`

Add:

- `@OneToMany` relationship for the new tracked entity.
- Update `toActivityLogDTO()` to map the new tracking data.

---

## 8. Reporting / Analytics

### 8.1 `ActivityLogRepository.java` - Completion Query

**Path:** `features/learner_tracking/repository/ActivityLogRepository.java`

Update `getBatchCourseCompletionPercentagePerLearner` (or similar queries) to include the new slide type in completion calculations.

```sql
WHEN s.source_type = 'AUDIO' THEN
    LEAST(COALESCE(SUM(...) / NULLIF(..., 0) * 100, 0), 100)
-- Add similar CASE for your new type
WHEN s.source_type = 'INTERACTIVE' THEN
    ...
```

---

## 9. Frontend Identification

The frontend identifies the slide type by checking the `sourceType` field in the `SlideDTO`.

```typescript
if (slide.sourceType === "AUDIO") {
  // Render audio player
  // Access data via slide.audioSlide
} else if (slide.sourceType === "INTERACTIVE") {
  // Render interactive component
  // Access data via slide.interactiveSlide
}
```

---

## Summary Checklist

| Area           | File/Action                                     | Done |
| -------------- | ----------------------------------------------- | ---- |
| **Enums**      | `SlideTypeEnum.java`                            | ☐    |
| **Enums**      | `LearnerOperationEnum.java` (if tracking)       | ☐    |
| **Database**   | Migration script for new tables                 | ☐    |
| **Entity**     | `<NewType>Slide.java`                           | ☐    |
| **Entity**     | `<NewType>Tracked.java` (if tracking)           | ☐    |
| **DTO**        | `<NewType>SlideDTO.java`                        | ☐    |
| **DTO**        | `Add<NewType>SlideDTO.java`                     | ☐    |
| **DTO**        | `<NewType>ActivityLogDTO.java` (if tracking)    | ☐    |
| **DTO**        | Update `SlideDTO.java`                          | ☐    |
| **DTO**        | Update `LearnerSlidesDetailDTO.java`            | ☐    |
| **DTO**        | Update `ActivityLogDTO.java` (if tracking)      | ☐    |
| **Repository** | `<NewType>SlideRepository.java`                 | ☐    |
| **Repository** | Update `SlideRepository.java` native queries    | ☐    |
| **Repository** | Update `ChapterRepository.java` native queries  | ☐    |
| **Repository** | `<NewType>TrackedRepository.java` (if tracking) | ☐    |
| **Service**    | `<NewType>SlideService.java`                    | ☐    |
| **Controller** | `<NewType>SlideController.java`                 | ☐    |
| **Tracking**   | Update `LearnerTrackingService.java`            | ☐    |
| **Tracking**   | Update `LearnerTrackingAsyncService.java`       | ☐    |
| **Tracking**   | Update `LearnerTrackingController.java`         | ☐    |
| **Tracking**   | Update `ActivityLogRepository.java`             | ☐    |
| **Tracking**   | Update `ActivityLog.java` entity                | ☐    |
| **Reporting**  | Update completion % queries                     | ☐    |
| **Frontend**   | Handle new `sourceType`                         | ☐    |
