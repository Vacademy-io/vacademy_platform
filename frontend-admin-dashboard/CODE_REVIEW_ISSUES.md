# Code Review Issues - scheduleStep1.tsx

## 🐛 Critical Bugs

### 1. **Missing `form` dependency in `getDefaultValues`** (Line 157)
**Issue**: `getDefaultValues` is wrapped in `useCallback` but doesn't include `form` in dependencies
**Location**: Lines 121-157
**Impact**: May cause stale closure issues
**Fix**: Either remove `useCallback` or add all dependencies
```typescript
// Current - Missing dependencies for getBrowserTimezone and getCurrentTimeInTimezone
const getDefaultValues = useCallback(() => {
    // ...
}, []);

// Should be:
const getDefaultValues = () => {
    // Remove useCallback since it's only called once
};
```

### 2. **Race Condition in Form Initialization** (Lines 304-432)
**Issue**: Multiple useEffects updating `isFormInitialized` can race
**Location**: Lines 304, 424-432
**Impact**: Form might initialize incorrectly or multiple times
**Potential Fix**: Consolidate initialization logic

### 3. **Duplicate Platform Detection Effects** (Lines 275-291 & 458-481)
**Issue**: Two separate effects both detect and set platform from link
**Location**: Lines 275-291 (simple includes) and 458-481 (regex-based)
**Impact**: Redundant logic, potential conflicts
**Fix**: Remove one or consolidate into single effect

### 4. **Missing Error Handling in File Upload** (Lines 627-639)
**Issue**: Error is logged but user isn't informed about which file failed
**Location**: Lines 635-639
**Impact**: Poor user experience, unclear what went wrong
**Fix**: Add specific toast messages:
```typescript
catch (error) {
    console.error('Error uploading files:', error);
    toast.error('Failed to upload file. Please try again.');
    setIsSubmitting(false);
    return;
}
```

### 5. **No Validation for Thumbnail File Uploads** (Lines 648-663)
**Issue**: Session thumbnail uploads have no error handling
**Location**: Lines 648-663
**Impact**: Silent failures, form submission continues with missing thumbnails
**Fix**: Add try-catch around each upload

### 6. **Alert in File Handler** (Line 556)
**Issue**: Using native `alert()` instead of toast notification
**Location**: Line 556
**Impact**: Inconsistent UI, blocks user
**Fix**: Replace with `toast.error()`

### 7. **Generic Error Handling in onSubmit** (Lines 686-687)
**Issue**: Error is only logged, no user feedback
**Location**: Lines 686-687
**Impact**: User doesn't know submission failed
**Fix**: Add toast notification

## ⚠️ Medium Priority Issues

### 8. **Incomplete `handleSessionPlatformChange` Dependencies** (Line 528)
**Issue**: Missing `form` in dependency array
**Location**: Lines 518-529
**Impact**: May use stale `form` reference
**Fix**: Add `form` to dependencies

### 9. **Timezone Parsing May Fail** (Line 333)
**Issue**: Combines meeting_date and start_time without validation
**Location**: Lines 331-339
**Impact**: Invalid datetime string if format is unexpected
**Fix**: Add validation:
```typescript
if (schedule.meeting_date && schedule.start_time) {
    try {
        const originalDateTime = `${schedule.meeting_date}T${schedule.start_time}`;
        // Validate it's a valid datetime
        if (!isNaN(new Date(originalDateTime).getTime())) {
            form.setValue('startTime', originalDateTime);
        }
    } catch (error) {
        // Fallback
        const currentTime = getCurrentTimeInTimezone(savedTimezone);
        form.setValue('startTime', currentTime);
    }
}
```

### 10. **NaN Risk in Duration Calculation** (Lines 382-385)
**Issue**: No validation that `matchingSchedule.duration` is a valid number
**Location**: Lines 382-389
**Impact**: Could set NaN values for hours/minutes
**Fix**: Add validation before parseInt

### 11. **Missing Null Check for tokenData** (Line 548)
**Issue**: `tokenData.authorities` accessed without null check
**Location**: Line 548
**Impact**: Crash if token is invalid
**Fix**:
```typescript
const INSTITUTE_ID = (tokenData?.authorities && Object.keys(tokenData.authorities)[0]) || '';
```

### 12. **Start Time Parsing Could Fail** (Lines 351-361)
**Issue**: Creating Date objects from strings without validation
**Location**: Lines 351-361
**Impact**: Invalid Date objects if format is wrong
**Fix**: Validate dates before calculations

## 💡 Optimization & Best Practices

### 13. **Too Many useEffects**
**Issue**: 15+ useEffects monitoring similar state
**Impact**: Complex dependency chains, hard to debug
**Recommendation**: Consolidate related effects

### 14. **Form Reset in Edit Mode** (Lines 324-328)
**Issue**: Using form.reset() mid-initialization can be risky
**Impact**: Might trigger validation, clear dirty state
**Alternative**: Use form.setValue() for individual fields

### 15. **Missing Cleanup in useEffects**
**Issue**: Some effects with async operations don't have cleanup
**Impact**: Potential memory leaks if component unmounts
**Fix**: Add cleanup functions where needed

### 16. **Hard-coded User ID in Upload** (Lines 630, 633, 614, 652)
**Issue**: `'your-user-id'` is hard-coded string
**Location**: Multiple places in file upload
**Impact**: Incorrect user attribution
**Fix**: Use actual user ID from token

### 17. **Disabled eslint Rules at Top**
**Issue**: `exhaustive-deps`, `no-unused-vars`, `no-explicit-any` disabled
**Impact**: Hides potential bugs
**Recommendation**: Fix issues and remove disables

## 🔍 Edge Cases Not Handled

### 18. **Empty Selected Days in Copy Dialog**
**Issue**: Dialog allows 0 selections but button shows "Copy to 0 days"
**Location**: Lines 2042-2050
**Impact**: Confusing UX
**Fix**: Button already has disable for 0, but message could be better

### 19. **Session Deletion Not Handled**
**Issue**: If user removes all sessions from a day, day stays selected
**Location**: Lines 755-764 (removeSessionFromDay)
**Impact**: Day with 0 sessions gets submitted
**Status**: Actually handled at line 763 - OK

### 20. **No Maximum Session Limit**
**Issue**: User can keep adding unlimited sessions
**Impact**: Performance issues, UI overflow
**Recommendation**: Add a reasonable limit (e.g., 10 sessions per day)

### 21. **Copy Function Creates New Sessions Without Position Check**
**Issue**: If target day has fewer sessions, creates at wrong index
**Location**: Lines 902-917
**Impact**: Session might be inserted at wrong position
**Status**: Actually handled - OK

## 📝 Code Quality Issues

### 22. **Inconsistent Error Messages**
**Issue**: Some places use toast, some use alert, some use nothing
**Recommendation**: Standardize on toast notifications

### 23. **Magic Numbers**
**Issue**: Hard-coded values like '0', '30', '15', etc.
**Recommendation**: Extract to constants

### 24. **Long Function (2000+ lines)**
**Issue**: Component is extremely long and complex
**Recommendation**: Split into smaller components:
- RecurringScheduleSection
- SessionTimingSection
- WaitingRoomSection
- CopyTosDaysDialog (already separate-ish)

## Summary
- **Critical**: 7 bugs that should be fixed immediately
- **Medium**: 5 issues that should be addressed soon
- **Low Priority**: 12 optimization/code quality improvements

### Recommended Priority Order:
1. Fix file upload error handling (#4, #5, #7)
2. Fix null checks and validation (#11, #9, #10)
3. Remove duplicate platform detection (#3)
4. Replace alert() with toast (#6)
5. Add hard-coded user ID fix (#16)
6. Consider refactoring large component (#24)

