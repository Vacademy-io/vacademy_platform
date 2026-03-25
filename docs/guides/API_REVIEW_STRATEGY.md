# Admin Core Service API Review Strategy

## Objective
Systematically review all APIs in `admin_core_service` and update `admin_apis.md` with accurate, semantically meaningful documentation suitable for AI agent consumption.

---

## Phase 1: Discovery & Inventory

### 1.1 List All Controllers
Run the following command to get all controller files:
```bash
find /Users/shreyashjain/code_repos/vacademy_platform/admin_core_service/src/main/java -name "*Controller.java" | grep -v "target" | grep -v "Open" | grep -v "Public" | grep -v "Internal"
```

### 1.2 Categorize Controllers by Feature Domain
| Domain | Controllers | Status |
|--------|-------------|--------|
| **Audience/Campaigns** | AudienceController | ✅ Reviewed |
| **Chapters** | ChapterController | ✅ Reviewed |
| **Courses** | CourseController, TeacherCourseController, AdminCourseApprovalController, TeacherCourseApprovalController | ✅ Reviewed |
| **Course Catalogue** | CourseCatalogueController | ✅ Reviewed |
| **Course Settings** | DripConditionController | ✅ Reviewed |
| **Custom Fields** | InstituteCustomFieldController, InstituteCustomFieldSettingController | ✅ Reviewed |
| **Documents** | DocumentController, FolderController | ✅ Reviewed |
| **Domain Routing** | DomainRoutingAdminController, DomainRoutingController | ✅ Reviewed |
| **Doubts** | DoubtsController | ✅ Reviewed |
| **Enrollment Invites** | EnrollInviteController | ✅ Reviewed |
| **Faculty** | FacultyController | ✅ Reviewed |
| **Institute** | InsituteController, InstituteCertificateController, InstituteSettingController, InstitutePaymentSettingController, UserInstituteController, TemplateController | ✅ Reviewed |
| **Learner Management** | InstituteStudentController, InstituteStudentOperationController, InstituteGetStudentController, StudentGetV2Controller, LearnerBatchController, InstituteCSVBulkStudentController | ✅ Reviewed |
| **Learner Features** | LearnerDashBoardController, LearnerEnrollRequestController, LearnerPortalAccessController, LearnerSetupController, LearnerUserInfoController, SubOrgLearnerController | ⏳ Partial |
| **Learner Invitations** | LearnerInvitationController, LearnerInvitationResponseController | ⏳ Pending |
| **Learner Reports** | LearnerReportController | ⏳ Pending |
| **Learner Study Library** | LearnerStudyLibraryController | ⏳ Pending |
| **Learner Tracking** | LearnerActivityLogController, LearnerLLMAnalyticsController, LearnerTrackingController | ⏳ Pending |
| **Modules** | LearnerModuleDetailController | ⏳ Pending |
| **Packages** | LearnerPackageDetailController | ⏳ Pending |
| **Presentation Mode** | LearnerPresentationModeController | ⏳ Pending |
| **Slides** | LearnerSlideController | ⏳ Pending |
| **Subjects** | LearnerSubjectDetailsController | ⏳ Pending |
| **Student Stats** | StudentStatsController | ⏳ Pending |
| **Student Analysis** | StudentAnalysisController | ⏳ Pending |
| **Ratings** | RatingController, RatingActionController, OperRatingController | ⏳ Pending |

---

## Phase 2: Review Checklist (Per Controller)

For each controller, perform the following:

### Step 1: View Controller Source
```bash
# Example
cat /path/to/Controller.java
```

### Step 2: Identify Endpoints
For each method, extract:
- [ ] HTTP Method (GET, POST, PUT, DELETE)
- [ ] Base path + method path
- [ ] Method name (becomes `api_name`)
- [ ] Parameters: `@RequestBody`, `@RequestParam`, `@PathVariable`
- [ ] Return type

### Step 3: Check if Endpoint Exists in `admin_apis.md`
```bash
grep -n "api_name: methodName" admin_apis.md
```

### Step 4: Evaluate Existing Documentation
- [ ] **Tool Name**: Is it human-readable? (e.g., "Get Linked Students" not "getLinkedStudents")
- [ ] **Description**: Does it explain WHAT the API does and WHEN to use it?
- [ ] **Inputs**: Are all parameters documented with correct types?
- [ ] **Sample Input JSON**: Does it accurately reflect the DTO structure?
- [ ] **Sample Output JSON**: Does it represent a realistic response?

### Step 5: Add or Update Entry
If missing or incomplete, add/update the entry following this format:
```markdown
# Tool: [Human Readable Name]
## api_name: [exactMethodName]
Description: [Clear description of what the API does]. [When to use it]. Endpoint: [HTTP_METHOD] [full_path]
Inputs:
- [paramName] ([Type]): [Path Variable | Query Param]
- Body: [DTOName] (optional description)

Sample Input JSON:
```json
{ ... }
```

Sample Output JSON:
```json
{ ... }
```
---
```

---

## Phase 3: Priority Order for Review

### High Priority (Admin/Instructor Core Operations)
1. ✅ Learner Management (Search, Filter, Update, Enroll)
2. ✅ Enrollment Invites (Create, Get, Delete)
3. ✅ Courses (CRUD, Approval Workflow)
4. ✅ Institute Settings (All config)
5. ✅ Faculty Management

### Medium Priority (Content Management)
6. ✅ Chapters, Modules, Subjects
7. ✅ Documents, Folders
8. ✅ Slides & Content Drip
9. ✅ Course Catalogue

### Lower Priority (Analytics & Specialized)
10. ✅ Learner Reports & Tracking
11. ✅ Student Analysis
12. ✅ Ratings
13. ✅ Doubts

---

## Phase 4: Validation

### 4.1 Cross-Reference with Controllers
After completing all domains, run:
```bash
# Count endpoints in controllers
find . -name "*Controller.java" -path "*/src/main/*" | xargs grep -E "@(Get|Post|Put|Delete)Mapping" | wc -l

# Count documented APIs
grep -c "## api_name:" admin_apis.md
```

### 4.2 Quality Checks
- [ ] No duplicate `api_name` entries
- [ ] All descriptions are semantic (not "Use to X")
- [ ] Sample JSONs are valid JSON format
- [ ] No `<DTO>` placeholders remain unexpanded

---

## Appendix: Excluded Controllers

The following are intentionally excluded (learner-facing or internal):
- `Open*Controller.java` - Public/unauthenticated endpoints
- `Public*Controller.java` - Public landing pages
- `Internal*Controller.java` - Inter-service communication

---

## Progress Tracking

| Date | Domain Reviewed | APIs Added | APIs Updated | Notes |
|------|-----------------|------------|--------------|-------|
| 2024-12-21 | Audience | 6 | 0 | Added updateCampaign, deleteCampaign, getLeadById |
| 2024-12-21 | Enrollment | 4 | 2 | Added createEnrollInvite, getEnrollInviteById |
| 2024-12-21 | Learner Mgmt | 0 | 8 | Enhanced descriptions for search/export |
| 2024-12-21 | Courses | 4 | 9 | Added getCourseHistory, getCourseReviewDetails, canEditCourse, getMyCourseHistory |
| 2024-12-21 | Course Catalogue | 0 | 6 | Enhanced descriptions |
| 2024-12-21 | Faculty | 1 | 4 | Added getFacultyByInstitute |
| 2024-12-21 | Institute | 8 | 7 | Added template CRUD, getInstituteDetails, getInstituteSetupDetails |
| 2024-12-21 | Chapters/Modules/Subjects | 0 | 8 | Enhanced descriptions, fixed duplicate entries |
| 2024-12-21 | Documents/Folders | 0 | 8 | Enhanced descriptions |
| 2024-12-21 | Slides/Content Drip | 0 | 8 | Enhanced descriptions |
| 2024-12-21 | Learner Reports | 0 | 5 | Enhanced descriptions, fixed duplicate entry |
| 2024-12-21 | Ratings | 2 | 5 | Added addRating, updateRating |
| 2024-12-21 | Doubts | 2 | 0 | Added createDoubt, getAllDoubts |
| 2024-12-21 | Student Analysis | 0 | 3 | Enhanced descriptions |
| 2024-12-21 | Domain Routing | 0 | 1 | Enhanced resolve description |

---

## Notes

- Sample JSONs should reflect realistic data structures, not just placeholders
- For complex DTOs, expand at least the first level of nesting
- Use `$ref` notation for deeply nested or cyclical structures
- Always test grep commands to verify documentation exists before editing
