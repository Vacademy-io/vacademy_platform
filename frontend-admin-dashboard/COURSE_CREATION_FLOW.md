# Course Creation Flow Documentation

## Overview

This document explains the complete flow of creating and updating courses in the Vacademy admin dashboard, including the different course structures and the API calls made for each structure type.

---

## Table of Contents

1. [Course Structure Types](#course-structure-types)
2. [Course Creation Flow](#course-creation-flow)
3. [Course Update Flow](#course-update-flow)
4. [API Calls by Structure Type](#api-calls-by-structure-type)
5. [Key Functions](#key-functions)
6. [File References](#file-references)

---

## Course Structure Types

The system supports 4 different course depth structures, each with a different hierarchy:

### Structure 5 (Full Hierarchy)
```
Course → Subject → Module → Chapter → Slides
```
- **Use Case**: Complete academic courses with multiple subjects
- **Example**: "Advanced Software Engineering Principles"

### Structure 4 (No Subject Level)
```
Course → Module → Chapter → Slides
```
- **Use Case**: Focused courses without subject divisions
- **Example**: "Full-Stack JavaScript Development Mastery"

### Structure 3 (No Subject/Module Levels)
```
Course → Chapter → Slides
```
- **Use Case**: Simple courses with direct chapter organization
- **Example**: "Frontend Fundamentals"

### Structure 2 (Slides Only)
```
Course → Slides
```
- **Use Case**: Very simple courses with just slide content
- **Example**: "Introduction to Web Development"

---

## Course Creation Flow

### File Location
- **Main Component**: `/src/components/common/study-library/add-course/add-course-form.tsx`
- **Lines**: 280-365 (create mode logic)

### Step-by-Step Process

#### 1. User Submits Course Form
The user fills out a 2-step form:
- **Step 1**: Basic course information (title, description, tags, etc.)
- **Step 2**: Sessions and levels configuration

#### 2. Course Data Formatting
```typescript
// Convert form data to API format
const formattedData = convertToApiCourseFormat(finalData);
```

#### 3. Create Course API Call
```typescript
addCourseMutation.mutate({ requestData: formattedData }, {
    onSuccess: async (response) => {
        // response.data contains the newly created course ID
    }
});
```

#### 4. Fetch Institute Details
**Why**: We need to get the package session IDs for the newly created course.

```typescript
const instituteDetails = await fetchInstituteDetails();
```

**Validation**:
```typescript
if (!instituteDetails?.batches_for_sessions) {
    throw new Error('Institute details not loaded');
}
```

#### 5. Get Package Session ID
```typescript
const packageSessionId = findIdByPackageId(
    instituteDetails.batches_for_sessions,
    response.data  // course ID
);
```

**What it does**: 
- Filters batches that match the course package ID
- Returns comma-separated batch IDs
- Example: `"batch-1,batch-2,batch-3"`

#### 6. Create Default Structure (Based on Course Depth)

The system automatically creates default placeholder structure elements based on the `course_depth` setting:

##### For Structure 2 (course_depth === 2):
**Creates**: Subject → Module → Chapter

```typescript
// 1. Create default subject
const subjectResponse = await addSubjectMutation.mutateAsync({
    subject: {
        id: '',
        subject_name: 'DEFAULT',
        subject_code: '',
        credit: 0,
        thumbnail_id: '',
        modules: []
    },
    packageSessionIds: packageSessionId
});

// 2. Create default module under the subject
const moduleResponse = await addModuleMutation.mutateAsync({
    subjectId: subjectResponse.data.id,
    packageSessionIds: packageSessionId,
    module: {
        id: '',
        module_name: 'DEFAULT',
        description: '',
        status: '',
        thumbnail_id: ''
    }
});

// 3. Create default chapter under the module
await addChapterMutation.mutateAsync({
    subjectId: subjectResponse.data.id,
    moduleId: moduleResponse.data.id,
    commaSeparatedPackageSessionIds: packageSessionId,
    chapter: {
        id: '',
        chapter_name: 'DEFAULT',
        status: 'ACTIVE',
        file_id: '',
        description: '',
        chapter_order: 0
    }
});
```

##### For Structure 3 (course_depth === 3):
**Creates**: Subject → Module

```typescript
// 1. Create default subject
const subjectResponse = await addSubjectMutation.mutateAsync({
    subject: newSubject,
    packageSessionIds: packageSessionId
});

// 2. Create default module under the subject
await addModuleMutation.mutateAsync({
    subjectId: subjectResponse.data.id,
    packageSessionIds: packageSessionId,
    module: newModule
});
```

##### For Structure 4 (course_depth === 4):
**Creates**: Subject only

```typescript
// Create default subject
await addSubjectMutation.mutateAsync({
    subject: newSubject,
    packageSessionIds: packageSessionId
});
```

##### For Structure 5 (course_depth === 5):
**No default structure created** - Assumes full structure will be added manually.

#### 7. Navigation
After successful creation, the user is redirected to the course details page:

```typescript
navigate({
    to: `/study-library/courses/course-details?courseId=${response.data}`
});
```

---

## Course Update Flow

### File Location
- **Main Component**: `/src/components/common/study-library/add-course/add-course-form.tsx`
- **Lines**: 178-276 (update mode logic)

### Step-by-Step Process

#### 1. User Edits Course
The form is pre-populated with existing course data:
```typescript
initialCourseData={existingCourseData}
```

#### 2. Calculate Changes
```typescript
const formattedDataUpdate = convertToApiCourseFormatUpdate(
    oldFormData.current,  // Original data
    finalData,            // New data
    getPackageSessionId
);

const previousSessions = retainNewActiveLevels(formattedDataUpdate.sessions);
```

#### 3. Update Course API Call
```typescript
updateCourseMutation.mutate({ requestData: formattedDataUpdate }, {
    onSuccess: async () => {
        // Handle structure updates
    }
});
```

#### 4. Find Unmatched Batches
**Why**: When sessions/levels are removed from a course, we need to create default structure for batches that are no longer associated.

```typescript
const instituteDetails = await fetchInstituteDetails();

const unmatchedPackageSessionIds = findUnmatchedBatchIds(
    previousSessions,                           // Current sessions in updated course
    instituteDetails.batches_for_sessions,      // All available batches
    formattedDataUpdate.id                      // Course ID
);
```

**What it does**:
- Compares updated course sessions/levels with all available batches
- Returns array of batch IDs that are no longer in the course
- Example: `["batch-5", "batch-7"]` (batches that were removed)

#### 5. Create Structure for Unmatched Batches (If Any)

**Only if** `unmatchedPackageSessionIds.length > 0`:

```typescript
const packageSessionIdsStr = unmatchedPackageSessionIds.join(',');

// Then create structure based on course_depth
// (Same logic as creation flow)
```

**If no unmatched batches**:
```typescript
console.log('No unmatched batches found - skipping structure creation');
// No API calls needed
```

---

## API Calls by Structure Type

### Summary Table

| Course Depth | Structure | APIs Called After Course Creation | Purpose |
|--------------|-----------|-----------------------------------|---------|
| **5** | Subject → Module → Chapter → Slides | None | Full structure - admin adds manually |
| **4** | Module → Chapter → Slides | 1. `addSubject` | Creates default subject wrapper |
| **3** | Chapter → Slides | 1. `addSubject`<br>2. `addModule` | Creates default subject + module wrappers |
| **2** | Slides only | 1. `addSubject`<br>2. `addModule`<br>3. `addChapter` | Creates complete default hierarchy |

### API Endpoints Used

1. **`addSubjectMutation`**
   - Creates a new subject
   - Parameters: `{ subject, packageSessionIds }`
   - Returns: `{ data: { id: string } }`

2. **`addModuleMutation`**
   - Creates a new module under a subject
   - Parameters: `{ subjectId, packageSessionIds, module }`
   - Returns: `{ data: { id: string } }`

3. **`addChapterMutation`**
   - Creates a new chapter under a module
   - Parameters: `{ subjectId, moduleId, commaSeparatedPackageSessionIds, chapter }`
   - Returns: Chapter object

4. **`updateCourseMutation`**
   - Updates an existing course
   - Parameters: `{ requestData }`
   - Returns: Success response

---

## Key Functions

### 1. `findIdByPackageId`
**Location**: `add-course-form.tsx`, Line 92

**Purpose**: Extracts package session IDs for a specific course from batches.

```typescript
function findIdByPackageId(
    data: BatchForSessionType[], 
    packageId: string
): string {
    return data
        .filter((item) => item.package_dto?.id === packageId)
        .map((item) => item.id)
        .join(',');
}
```

**Input**: 
- `data`: Array of all batches
- `packageId`: The course ID to filter by

**Output**: Comma-separated batch IDs (e.g., `"1,2,3"`)

**Example**:
```typescript
const batches = [
    { id: "batch-1", package_dto: { id: "course-123" } },
    { id: "batch-2", package_dto: { id: "course-456" } },
    { id: "batch-3", package_dto: { id: "course-123" } }
];

findIdByPackageId(batches, "course-123");
// Returns: "batch-1,batch-3"
```

---

### 2. `retainNewActiveLevels`
**Location**: `add-course-form.tsx`, Line 99

**Purpose**: Filters session levels to only include active, non-new levels.

```typescript
function retainNewActiveLevels(sessions: SessionDetails[]) {
    return sessions.map((session) => ({
        ...session,
        levels: (session.levels ?? []).filter(
            (level) => 
                level.new_level === false && 
                level.package_session_status === 'ACTIVE'
        ),
    }));
}
```

**Why**: When updating a course, we only want to consider existing active levels, not new or inactive ones.

---

### 3. `findUnmatchedBatchIds`
**Location**: `add-course-form.tsx`, Line 107

**Purpose**: Finds batches that are no longer associated with the updated course.

```typescript
function findUnmatchedBatchIds(
    sessionsData: SessionDetails[],      // Updated course sessions
    batchesData: BatchForSessionType[],  // All available batches
    courseId?: string                    // Course ID filter
): string[] {
    // Build a map: sessionId → Set(levelIds)
    const sessionLevelMap = new Map<string, Set<string>>();
    
    sessionsData.forEach((session) => {
        const levels = session.levels ?? [];
        sessionLevelMap.set(session.id, new Set(levels.map((l) => l.id)));
    });
    
    // Find batches not in the updated course
    return batchesData
        .filter((batch) => {
            // Filter by course if provided
            if (courseId && batch.package_dto?.id !== courseId) return false;
            
            const levelSet = sessionLevelMap.get(batch.session.id);
            // Include if session missing OR level missing in that session
            return !levelSet || !levelSet.has(batch.level.id);
        })
        .map((batch) => batch.id);
}
```

**Algorithm**:
1. Creates a fast-lookup map of session → levels in the updated course
2. Checks each batch to see if its session/level combination exists
3. Returns IDs of batches that don't match

**Example**:
```typescript
// Original course had: Session1-Level1, Session1-Level2, Session2-Level1
// Updated course has:  Session1-Level1, Session2-Level1
// Result: Returns batches for Session1-Level2 (removed level)
```

---

### 4. `convertToApiCourseFormat`
**Location**: `add-course-form.tsx` (referenced)

**Purpose**: Transforms form data into the API format expected by the backend.

**Transforms**:
- Form field names → API field names
- Date formats
- Session/level structures
- Media file references

---

### 5. `convertToApiCourseFormatUpdate`
**Location**: `add-course-form.tsx` (referenced)

**Purpose**: Transforms form data for update operations, including change detection.

**Transforms**:
- Compares old vs new data
- Marks sessions/levels as added, removed, or unchanged
- Includes package session ID mappings

---

## File References

### Primary Files

1. **`/src/components/common/study-library/add-course/add-course-form.tsx`**
   - Main course creation/update form component
   - Handles all API orchestration
   - Lines of interest:
     - 92-127: Helper functions
     - 136-365: Form submission handler
     - 178-276: Update flow
     - 280-365: Create flow

2. **`/src/routes/study-library/courses/course-details/-components/course-structure-details.tsx`**
   - Displays course structure in the course details page
   - Shows different views based on course depth
   - Handles structure editing (add/edit/delete subjects/modules/chapters)
   - Lines of interest:
     - 562-594: Load modules effect
     - 597-621: Load chapter slides effect
     - 625-704: Auto-expand settings
     - 1042-2909: Tab rendering logic

3. **`/src/routes/study-library/courses/course-details/-components/course-details-page.tsx`**
   - Main course details page container
   - Manages session/level selection
   - Handles course data loading and display
   - Lines of interest:
     - 164-246: Session/level preservation logic
     - 316-367: Session/level change handlers
     - 420-492: Course data loading

### Supporting Files

4. **`/src/stores/study-library/use-study-library-store.ts`**
   - Zustand store for managing course data globally
   - Caches all course/session/level data
   - Provides utility functions for querying course structure

5. **`/src/hooks/use-course-settings.ts`** (referenced)
   - Hook for fetching course display settings
   - Controls default views, auto-expand behavior, etc.

6. **`/src/services/study-library/` (directory)** (referenced)
   - API mutation hooks:
     - `useAddCourse`
     - `useUpdateCourse`
     - `useAddSubject`
     - `useAddModule`
     - `useAddChapter`
     - `useUpdateSubject`
     - `useUpdateModule`
     - `useUpdateChapter`
     - `useDeleteSubject`
     - `useDeleteModule`
     - `useDeleteChapter`

### Configuration Files

7. **`/src/schemas/study-library/` (directory)** (referenced)
   - Zod schemas for form validation
   - Type definitions for course data structures

8. **`/src/types/study-library/` (directory)** (referenced)
   - TypeScript interfaces and types
   - API request/response types

---

## Error Handling

### Async Validation

All API calls include validation to prevent race conditions:

```typescript
// Wait for API response
const instituteDetails = await fetchInstituteDetails();

// Validate data exists
if (!instituteDetails?.batches_for_sessions) {
    throw new Error('Institute details not loaded or batches data missing');
}

// Validate package session ID
if (!packageSessionId) {
    throw new Error('Package session ID not found for the created course');
}
```

### Error Recovery

```typescript
try {
    // API calls
} catch (err) {
    console.error('Error in course creation flow:', err);
    toast.error(
        err instanceof Error
            ? err.message
            : `Failed to create course`
    );
} finally {
    setIsCreating(false);
}
```

---

## Key Concepts

### 1. Package Session IDs
- Represents the association between a course package and specific session/level combinations
- Used to determine which batches can access which course content
- Format: Comma-separated string (e.g., `"1,2,3"`)

### 2. Course Depth
- Determines the hierarchical structure of the course
- Affects UI rendering and default structure creation
- Values: 2, 3, 4, or 5

### 3. Default Structure
- Placeholder hierarchy created automatically after course creation
- Uses "DEFAULT" as naming convention
- Allows immediate slide addition without manual structure setup

### 4. Batch Matching
- System tracks which batches (student groups) are associated with each course
- When course structure changes, system identifies orphaned batches
- Creates default structure for orphaned batches to maintain data integrity

---

## Development Tips

### For New Developers

1. **Understanding Course Depth**:
   - Always check `courseStructure` or `course_depth` to understand hierarchy
   - Each depth requires different API calls and UI rendering

2. **Async Flow**:
   - Course creation is a multi-step async process
   - Always await `fetchInstituteDetails()` before using batch data
   - Validate data at each step to prevent silent failures

3. **State Management**:
   - Course data is cached in `useStudyLibraryStore`
   - Always invalidate queries after mutations to refresh UI

4. **Testing Different Structures**:
   - Create test courses with different `course_depth` values
   - Verify default structure creation for each type
   - Test update flow with session/level changes

5. **Debugging**:
   - Check browser console for validation errors
   - Console logs track async flow and package session IDs
   - Use React DevTools to inspect form state

---

## Common Scenarios

### Scenario 1: Creating a Simple Course (Depth 2)
1. User creates course with slides only
2. System calls `addCourse` API
3. System creates: Subject → Module → Chapter (all named "DEFAULT")
4. User can immediately add slides to the default chapter

### Scenario 2: Removing a Level from a Course
1. User edits course and removes "Level 2" from "Session A"
2. System identifies batches associated with Session A - Level 2
3. System creates default structure for those batches
4. Students in removed level still have access to course content

### Scenario 3: Adding Sessions to Existing Course
1. User adds "Session B" to existing course
2. New session doesn't have any structure yet
3. System identifies batches for Session B
4. System creates default structure based on course depth
5. New session is ready for content

---

## Diagram: Course Creation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     User Submits Form                            │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              Convert Form Data to API Format                     │
│            (convertToApiCourseFormat)                            │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Call addCourse API                              │
│              Returns: { data: courseId }                         │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              Fetch Institute Details (Async)                     │
│         Get batches_for_sessions data                            │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│         Find Package Session IDs for New Course                  │
│         (findIdByPackageId)                                      │
│         Returns: "batch-1,batch-2,batch-3"                       │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
                    ┌────┴────┐
                    │ Depth?  │
                    └────┬────┘
         ┌──────────────┼──────────────┬──────────────┐
         │              │              │              │
    Depth 2        Depth 3        Depth 4        Depth 5
         │              │              │              │
         ▼              ▼              ▼              ▼
   ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
   │ Subject │    │ Subject │    │ Subject │    │  None   │
   │    +    │    │    +    │    │         │    │         │
   │ Module  │    │ Module  │    │         │    │         │
   │    +    │    │         │    │         │    │         │
   │ Chapter │    │         │    │         │    │         │
   └────┬────┘    └────┬────┘    └────┬────┘    └────┬────┘
        │              │              │              │
        └──────────────┴──────────────┴──────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              Navigate to Course Details Page                     │
│         /course-details?courseId={newCourseId}                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2025-05-24 | 1.0 | Initial documentation created |

---

## Questions?

For questions or clarifications about the course creation flow, please contact the development team or refer to the referenced source files.
