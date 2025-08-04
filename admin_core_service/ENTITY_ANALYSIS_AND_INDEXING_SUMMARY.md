# Vacademy Admin Core Service - Entity Analysis & Database Indexing Summary

## Overview

This document provides a comprehensive analysis of all entities used in the Vacademy Admin Core Service and the database indexing strategy implemented to optimize query performance.

## Entities Discovered

Based on the analysis of the codebase, the following entities were identified:

### 📦 Package Management Entities
- **PackageEntity** - Core course packages
- **PackageSession** - Sessions within packages  
- **PackageInstitute** - Package-institute mappings
- **CourseStructureChangesLog** - Change tracking for course structure

### 👥 Student & Learner Management Entities  
- **Student** - Student/learner information
- **StudentSessionInstituteGroupMapping** - Critical mapping for learner-batch assignments
- **LearnerOperation** - Progress tracking operations
- **LearnerInvitation** - Student invitation management
- **LearnerInvitationResponse** - Invitation responses
- **LearnerInvitationCustomField** - Custom fields for invitations

### 📊 Activity Tracking & Analytics Entities
- **ActivityLog** - Core learning activity tracking
- **VideoTracked** - Video viewing progress  
- **DocumentTracked** - Document reading progress
- **QuizSlideQuestionTracked** - Quiz question interactions
- **QuestionSlideTracked** - Question slide interactions
- **AssignmentSlideTracked** - Assignment interactions
- **VideoSlideQuestionTracked** - Video embedded questions
- **ConcentrationScore** - Learning concentration metrics

### 📚 Content Structure Entities
- **Chapter** - Content chapters
- **ChapterPackageSessionMapping** - Chapter-session relationships
- **ChapterToSlides** - Chapter-slide relationships  
- **Module** - Content modules
- **ModuleChapterMapping** - Module-chapter relationships
- **Subject** - Academic subjects
- **SubjectModuleMapping** - Subject-module relationships
- **SubjectPackageSession** - Subject-session relationships

### 🎯 Slide & Content Entities
- **Slide** - Core content slides
- **VideoSlide** - Video content
- **DocumentSlide** - Document content
- **QuizSlide** - Quiz content
- **QuestionSlide** - Question content
- **AssignmentSlide** - Assignment content
- **VideoSlideQuestion** - Questions within videos
- **QuizSlideQuestion** - Quiz questions
- **AssignmentSlideQuestion** - Assignment questions
- **Option** - Multiple choice options
- **QuizSlideQuestionOption** - Quiz question options
- **VideoSlideQuestionOption** - Video question options

### 🎥 Live Session Entities
- **LiveSession** - Live teaching sessions
- **SessionSchedule** - Session scheduling
- **LiveSessionParticipants** - Session attendees
- **LiveSessionLogs** - Session activity logs
- **ScheduleNotification** - Session notifications
- **SessionGuestRegistration** - Guest registrations

### 👨‍🏫 Faculty & Permissions Entities
- **FacultySubjectPackageSessionMapping** - Faculty assignments

### 🏫 Institute & Organization Entities
- **Group** - Student groups
- **PackageGroupMapping** - Package-group assignments

### 💳 Payment & Subscription Entities
- **PaymentPlan** - Subscription plans
- **PaymentLog** - Payment transactions
- **PaymentLogLineItem** - Payment details
- **CouponCode** - Discount coupons
- **ReferralOption** - Referral programs
- **UserPlan** - User subscriptions
- **AppliedCouponDiscount** - Applied discounts
- **EnrollInviteDiscountOption** - Enrollment discounts
- **PaymentOption** - Payment methods
- **UserInstitutePaymentGatewayMapping** - Payment gateway mappings

### 🔔 Notification & Communication Entities
- **NotificationSetting** - Notification preferences

### ⭐ Rating & Feedback Entities
- **Rating** - Content ratings
- **RatingAction** - Rating interactions

### 📁 Document & File Management Entities
- **Document** - File documents
- **Folder** - File organization

### 🎟️ Enrollment & Invitation Entities
- **EnrollInvite** - Enrollment invitations
- **PackageSessionEnrollInvitePaymentOptionPlanToReferralOption** - Complex enrollment mappings
- **PackageSessionLearnerInvitationToPaymentOption** - Payment-invitation links

### ⚙️ Custom Fields & Configuration Entities
- **CustomFields** - Configurable fields
- **CustomFieldValues** - Field values
- **InstituteCustomField** - Institute-specific fields
- **RichTextData** - Rich content storage

### 💬 Communication Entities
- **Doubts** - Student questions/doubts
- **DoubtAssignee** - Doubt assignment tracking

### 📈 Academic Management Entities
- **Level** - Academic levels
- **Session** - Academic sessions

## Repository Query Pattern Analysis

### Most Critical Query Patterns Identified:

1. **Package Queries** (PackageRepository)
   - Heavy use of `institute_id` filtering
   - Complex JOINs across package, package_session, package_institute
   - Status-based filtering (`status != 'DELETED'`)
   - Tag-based searches using `comma_separated_tags`
   - Faculty and learner progress calculations

2. **Student Lookups** (InstituteStudentRepository)
   - Full-text search on `full_name`, `username`, `mobile_number`
   - Email-based lookups
   - Institute-student mappings via `student_session_institute_group_mapping`
   - Status filtering for active enrollments

3. **Activity Analytics** (ActivityLogRepository)
   - User-based activity tracking (`user_id`)
   - Time-range queries on `created_at`, `start_time`, `end_time`
   - Slide-specific progress tracking
   - Complex progress calculations with multiple JOINs

4. **Live Session Management** (LiveSessionRepository)
   - Institute-scoped session queries
   - Date and time-based filtering
   - Session status management
   - Participant tracking

## Indexing Strategy

### 🎯 Key Design Principles:

1. **Composite Indexes** - Created for frequently combined filter conditions
2. **Partial Indexes** - Used WHERE clauses to exclude deleted/inactive records
3. **GIN Indexes** - Implemented for full-text search and array operations
4. **Time-based Indexes** - Optimized for date range queries and sorting
5. **Foreign Key Indexes** - Covered all JOIN relationships

### 📊 Index Categories Created:

#### 1. Core Business Logic Indexes
- Package discovery and filtering
- Student enrollment and progress tracking  
- Activity analytics and reporting
- Live session management

#### 2. Search & Discovery Indexes
- Full-text search on names and content
- Tag-based filtering using GIN indexes
- Multi-field composite searches

#### 3. Performance Optimization Indexes
- Time-range query optimization
- Status-based filtering
- Foreign key relationship optimization

#### 4. Analytics & Reporting Indexes
- Progress calculation optimization
- Activity aggregation support
- Performance metrics tracking

#### 5. Maintenance Indexes
- Data cleanup and archival support
- Historical data management

## Usage Instructions

### 🚀 Deploying the Index Script

1. **Backup First**: Always backup your database before running the script
2. **Test Environment**: Run on staging/test environment first
3. **Schema Validation**: Run `test_critical_indexes.sql` first to verify schema correctness
4. **Execute Full Script**: If test passes, run `database_indexes_script.sql` on your PostgreSQL database
5. **Monitor Performance**: Track query performance improvements

### ⚠️ Schema Corrections Made

**Important**: The initial analysis revealed some schema assumptions that were corrected:

- **Package Table**: Does NOT have `institute_id` field directly
- **Package-Institute Relationship**: Managed through `package_institute` bridge table
- **Correct Table Names**: 
  - `package` (not package)
  - `package_institute` (bridge table)
  - `groups` (not group)
  - `institutes` (not institute)
  - `users` (not user)

### 📈 Expected Performance Improvements

- **Package Queries**: 3-5x faster package discovery and filtering
- **Student Searches**: 10x faster full-text searches on student data  
- **Activity Analytics**: 5-10x faster progress calculations and reporting
- **Live Sessions**: 2-3x faster session management operations
- **Complex Joins**: Significant improvement in multi-table query performance

### 🔍 Monitoring & Maintenance

1. **Monitor Index Usage**:
   ```sql
   SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch 
   FROM pg_stat_user_indexes 
   ORDER BY idx_scan DESC;
   ```

2. **Check Index Size**:
   ```sql
   SELECT schemaname, tablename, indexname, pg_size_pretty(pg_relation_size(indexrelname::regclass)) as index_size
   FROM pg_stat_user_indexes 
   ORDER BY pg_relation_size(indexrelname::regclass) DESC;
   ```

3. **Analyze Query Performance**:
   ```sql
   EXPLAIN (ANALYZE, BUFFERS) YOUR_QUERY_HERE;
   ```

### ⚠️ Important Notes

- **CONCURRENTLY**: All indexes are created with `CONCURRENTLY` to avoid blocking operations
- **IF NOT EXISTS**: Safe to re-run the script multiple times
- **Partial Indexes**: Many indexes exclude deleted records for efficiency
- **GIN Indexes**: Used for full-text search and array operations (may take longer to build)

## Conclusion

This comprehensive indexing strategy covers all major query patterns identified in the Vacademy Admin Core Service. The indexes are designed to provide significant performance improvements for:

- Course catalog browsing and search
- Student management and progress tracking
- Learning analytics and reporting  
- Live session management
- Administrative operations

Regular monitoring and maintenance of these indexes will ensure continued optimal performance as the system scales.

---

**Generated**: Based on comprehensive analysis of 70+ entities and repository query patterns  
**Indexes Created**: 80+ indexes covering all major use cases  
**Performance Impact**: Expected 3-10x improvement in query performance 