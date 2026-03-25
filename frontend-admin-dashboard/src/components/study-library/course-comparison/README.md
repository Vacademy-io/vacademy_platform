# Course Comparison Feature

This feature allows non-admin users to preview changes between their draft course and the original published course.

## Components

### PreviewChangesButton
- **Location**: `src/components/study-library/course-comparison/PreviewChangesButton.tsx`
- **Purpose**: Trigger button that opens the comparison modal
- **Props**:
  - `currentCourseId`: ID of the current draft course
  - `originalCourseId`: ID of the parent/original course (can be null for new courses)
  - `subjectId`: Current subject ID
  - `packageSessionId`: Selected package session ID
  - `disabled`: Whether the button should be disabled

### CourseComparisonModal
- **Location**: `src/components/study-library/course-comparison/CourseComparisonModal.tsx`
- **Purpose**: Modal that displays the detailed comparison results
- **Features**:
  - Package session selection (dropdown when multiple sessions exist)
  - Summary cards showing counts of added/updated/deleted/unchanged items
  - Tabbed interface for modules, chapters, and slides
  - Change indicators with icons and badges

## Services

### course-comparison.ts
- **Location**: `src/services/study-library/course-comparison.ts`
- **Functions**:
  - `compareCourses()`: Main comparison logic
  - `getPackageSessionsForCourse()`: Fetch available package sessions
  - `fetchModulesWithChaptersForComparison()`: Fetch module data
  - `fetchChaptersWithSlidesForComparison()`: Fetch chapter and slide data

## Types

### course-comparison.ts
- **Location**: `src/types/study-library/course-comparison.ts`
- **Interfaces**:
  - `ModuleWithParent`, `ChapterWithParent`, `SlideWithParent`: Data structures with parent_id tracking
  - `ComparisonItem`: Individual comparison result
  - `CourseComparisonResult`: Complete comparison output
  - `PackageSession`: Session information

## Integration

The feature is integrated into:
- `NonAdminSlidesView.tsx`: Added PreviewChangesButton as a floating action button

## How It Works

1. **Button Placement**: The Preview Changes button appears as a floating action button in the bottom-right corner of the non-admin slides view.

2. **Course Detection**:
   - If `originalCourseId` is null, shows "no comparison available" message (new course)
   - If `originalCourseId` exists, proceeds with comparison

3. **Package Session Handling**:
   - Fetches available package sessions for the course
   - Shows dropdown if multiple sessions exist
   - Auto-selects if only one session or default is provided

4. **Comparison Logic**:
   - Fetches current course data (modules, chapters, slides)
   - Compares based on `parent_id` field:
     - `parent_id = null`: Item is newly added
     - `parent_id != null`: Item exists in parent (currently marked as unchanged)
   - Future enhancement: Compare actual data changes for updated items

5. **UI Display**:
   - Summary cards with counts
   - Tabbed interface for different item types
   - Color-coded badges and icons for change types
   - Scrollable lists with item details

## Future Enhancements

1. **Complete Comparison Logic**: Currently only detects added items. Needs enhancement to:
   - Fetch parent course data
   - Detect deleted items (exist in parent but not in current)
   - Detect updated items (compare field values)

2. **Subject Level Comparison**: Add subject-level comparison support

3. **Detailed Change Detection**: Show exactly what fields changed in updated items

4. **Export/Print**: Add ability to export or print comparison results

## Usage

```tsx
import { PreviewChangesButton } from '@/components/study-library/course-comparison/PreviewChangesButton';

<PreviewChangesButton
    currentCourseId={courseId}
    originalCourseId={originalCourseId}
    subjectId={subjectId}
    packageSessionId={sessionId}
    disabled={hasUnsavedChanges}
/>
```
