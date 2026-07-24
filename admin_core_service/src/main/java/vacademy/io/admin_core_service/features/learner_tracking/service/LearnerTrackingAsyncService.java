package vacademy.io.admin_core_service.features.learner_tracking.service;

import jakarta.transaction.Transactional;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.chapter.enums.ChapterStatus;
import vacademy.io.admin_core_service.features.common.enums.StatusEnum;
import vacademy.io.admin_core_service.features.institute_learner.enums.LearnerSessionStatusEnum;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionRepository;
import vacademy.io.admin_core_service.features.learner_operation.enums.LearnerOperationEnum;
import vacademy.io.admin_core_service.features.learner_operation.enums.LearnerOperationSourceEnum;
import vacademy.io.admin_core_service.features.learner_operation.service.LearnerOperationService;
import vacademy.io.admin_core_service.features.learner_tracking.dto.ActivityLogDTO;
import vacademy.io.admin_core_service.features.learner_tracking.dto.DocumentActivityLogDTO;
import vacademy.io.admin_core_service.features.learner_tracking.dto.VideoActivityLogDTO;
import vacademy.io.admin_core_service.features.learner_tracking.repository.ActivityLogRepository;
import vacademy.io.admin_core_service.features.module.enums.ModuleStatusEnum;
import vacademy.io.admin_core_service.features.slide.enums.SlideStatus;
import vacademy.io.admin_core_service.features.slide.enums.SlideTypeEnum;
import vacademy.io.admin_core_service.features.slide.repository.VideoSlideRepository;
import vacademy.io.admin_core_service.features.subject.enums.SubjectStatusEnum;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.stream.Collectors;

@Slf4j
@Service
public class LearnerTrackingAsyncService {

        private final ExecutorService executor = Executors.newFixedThreadPool(10);

        @Autowired
        private StudentSessionRepository studentSessionRepository;
        @Autowired
        private ActivityLogRepository activityLogRepository;
        @Autowired
        private LearnerOperationService learnerOperationService;
        @Autowired
        private VideoSlideRepository videoSlideRepository;
        @Autowired
        private vacademy.io.admin_core_service.features.slide.repository.HtmlVideoSlideRepository htmlVideoSlideRepository;
        @Autowired
        private LLMActivityAnalyticsService llmActivityAnalyticsService;
        @Autowired
        private vacademy.io.admin_core_service.features.slide.repository.AudioSlideRepository audioSlideRepository;

        // ==== Document Slide Tracking ====

        @Async
        @Transactional // Added back to fix TransactionRequiredException
        public void updateLearnerOperationsForDocument(String userId, String slideId, String chapterId,
                        String moduleId, String subjectId, String packageSessionId,
                        ActivityLogDTO activityLogDTO) {
                int highestPage = activityLogDTO.getDocuments().stream()
                                .map(DocumentActivityLogDTO::getPageNumber)
                                .max(Integer::compareTo)
                                .orElse(0);

                learnerOperationService.deleteLearnerOperationByUserIdSourceAndSourceIdAndOperation(userId,
                                LearnerOperationSourceEnum.SLIDE.name(), slideId,
                                LearnerOperationEnum.DOCUMENT_LAST_PAGE.name());

                Double percentageWatched = activityLogRepository.getPercentageDocumentWatched(slideId, userId);

                // Use helper for percentage logic (cap at 100, skip if null)
                addOrUpdatePercentageOperation(userId, LearnerOperationSourceEnum.SLIDE.name(), slideId,
                                LearnerOperationEnum.PERCENTAGE_DOCUMENT_COMPLETED.name(), percentageWatched);

                // Standard operation for non-percentage data
                learnerOperationService.addOrUpdateOperation(userId, LearnerOperationSourceEnum.SLIDE.name(), slideId,
                                LearnerOperationEnum.DOCUMENT_LAST_PAGE.name(), String.valueOf(highestPage));

                updateLearnerOperationsForChapter(userId, chapterId, moduleId, subjectId, packageSessionId);
        }

        // ==== LLM Analytics Methods ====

        /**
         * wrapper to save quiz raw data for LLM analytics
         * Called after quiz submission to capture data without blocking the main flow
         */
        @Async
        @Transactional
        public void saveLLMQuizDataAsync(
                        String activityLogId,
                        String slideId,
                        String chapterId,
                        String packageSessionId,
                        String subjectId,
                        ActivityLogDTO activityLogDTO) {
                try {
                        activityLogRepository.findById(activityLogId).ifPresent(activityLog -> {
                                llmActivityAnalyticsService.saveQuizRawData(
                                                activityLog,
                                                activityLogDTO.getQuizSides(),
                                                slideId,
                                                chapterId,
                                                packageSessionId,
                                                subjectId);
                        });
                } catch (Exception e) {
                        log.error("Error saving LLM quiz data for activityLogId: {}, slideId: {}", activityLogId,
                                        slideId, e);
                }
        }

        /**
         * Async wrapper to save question raw data for LLM analytics
         */
        @Async
        @Transactional
        public void saveLLMQuestionDataAsync(
                        String activityLogId,
                        String slideId,
                        String chapterId,
                        String packageSessionId,
                        String subjectId,
                        ActivityLogDTO activityLogDTO) {
                try {
                        activityLogRepository.findById(activityLogId).ifPresent(activityLog -> {
                                llmActivityAnalyticsService.saveQuestionRawData(
                                                activityLog,
                                                activityLogDTO.getQuestionSlides(),
                                                slideId,
                                                chapterId,
                                                packageSessionId,
                                                subjectId);
                        });
                } catch (Exception e) {
                        log.error("Error saving LLM question data for activityLogId: {}, slideId: {}", activityLogId,
                                        slideId, e);
                }
        }

        /**
         * Async wrapper to save assignment raw data for LLM analytics
         */
        @Async
        @Transactional
        public void saveLLMAssignmentDataAsync(
                        String activityLogId,
                        String slideId,
                        String chapterId,
                        String packageSessionId,
                        String subjectId,
                        ActivityLogDTO activityLogDTO) {
                try {
                        activityLogRepository.findById(activityLogId).ifPresent(activityLog -> {
                                llmActivityAnalyticsService.saveAssignmentRawData(
                                                activityLog,
                                                activityLogDTO.getAssignmentSlides(),
                                                slideId,
                                                chapterId,
                                                packageSessionId,
                                                subjectId);
                        });
                } catch (Exception e) {
                        log.error("Error saving LLM assignment data for activityLogId: {}, slideId: {}", activityLogId,
                                        slideId, e);
                }
        }

        @Async
        @Transactional // Added back to fix TransactionRequiredException
        public void updateLearnerOperationsForQuestion(String userId, String slideId, String chapterId,
                        String moduleId, String subjectId, String packageSessionId,
                        ActivityLogDTO activityLogDTO) {
                addOrUpdatePercentageOperation(userId, LearnerOperationSourceEnum.SLIDE.name(), slideId,
                                LearnerOperationEnum.PERCENTAGE_QUESTION_COMPLETED.name(), 100.0);

                updateLearnerOperationsForChapter(userId, chapterId, moduleId, subjectId, packageSessionId);
        }

        @Async
        @Transactional // Added back to fix TransactionRequiredException
        public void updateLearnerOperationsForAssignment(String userId, String slideId, String chapterId,
                        String moduleId, String subjectId, String packageSessionId,
                        ActivityLogDTO activityLogDTO) {
                addOrUpdatePercentageOperation(userId, LearnerOperationSourceEnum.SLIDE.name(), slideId,
                                LearnerOperationEnum.PERCENTAGE_ASSIGNMENT_COMPLETED.name(), 100.0);

                updateLearnerOperationsForChapter(userId, chapterId, moduleId, subjectId, packageSessionId);
        }

        @Async
        @Transactional // Added back to fix TransactionRequiredException
        public void updateLearnerOperationsForQuiz(String userId, String slideId, String chapterId,
                        String moduleId, String subjectId, String packageSessionId,
                        ActivityLogDTO activityLogDTO) {
                Double percentageCompleted = activityLogRepository.getQuizSlideCompletionPercentage(slideId,
                                List.of(StatusEnum.ACTIVE.name()), userId);

                addOrUpdatePercentageOperation(userId, LearnerOperationSourceEnum.SLIDE.name(), slideId,
                                LearnerOperationEnum.PERCENTAGE_QUIZ_COMPLETED.name(), percentageCompleted);

                updateLearnerOperationsForChapter(userId, chapterId, moduleId, subjectId, packageSessionId);
        }

        // ==== Assessment Slide Tracking ====
        //
        // ASSESSMENT slides are marked complete as soon as the learner has
        // attempted and submitted the assessment (mirrors the ASSIGNMENT
        // pattern: submission itself is the completion signal, not a
        // percentage derived from marks/evaluation, which stays in
        // assessment_service). chapterId/moduleId/subjectId/packageSessionId
        // are optional — older frontend builds that haven't been updated to
        // send them yet still get the slide-level 100% write (which is what
        // the drip/prerequisite check reads), just without the chapter/
        // module/subject/package_session rollup cascade.
        @Async
        @Transactional
        public void updateLearnerOperationsForAssessment(String userId, String slideId, String chapterId,
                        String moduleId, String subjectId, String packageSessionId) {
                addOrUpdatePercentageOperation(userId, LearnerOperationSourceEnum.SLIDE.name(), slideId,
                                LearnerOperationEnum.PERCENTAGE_ASSESSMENT_DONE.name(), 100.0);

                if (chapterId != null) {
                        updateLearnerOperationsForChapter(userId, chapterId, moduleId, subjectId, packageSessionId);
                }
        }

        // ==== SCORM Tracking ====
        //
        // SCORM packages POST to /scorm/tracking/v1/{slideId}/commit on every
        // LMSCommit / LMSFinish (1.2) or Commit / Terminate (2004) fired by the
        // content inside the iframe. ScormTrackingService persists the row in
        // scorm_learner_progress and then calls this method with a percentage
        // already derived per SCORM 2004 spec precedence (progress_measure >
        // score.scaled > score.raw/max > completion-status fallback).
        //
        // SCORM is its own SlideTypeEnum and gets its own operation enum
        // (PERCENTAGE_SCORM_COMPLETED). Both are added to the chapter cascade
        // lists below so the rollup actually picks SCORM slides up. Before
        // this fix, source_type=SCORM was excluded from the cascade's
        // sourceTypeList entirely — SCORM completion was invisible to chapter
        // / module / subject / course percentages (B1 in the ledger).
        //
        // Slide-level monotonic guard (B9) keeps the slide at its high-water
        // mark — once a fully-completed run produces 100%, partial restarts
        // can't lower it. Rollups still overwrite freely on each cascade run.
        @Async
        @Transactional
        public void updateLearnerOperationsForScorm(String userId, String slideId, Double percentage,
                        String chapterId, String moduleId, String subjectId, String packageSessionId) {
                addOrUpdatePercentageOperation(userId, LearnerOperationSourceEnum.SLIDE.name(), slideId,
                                LearnerOperationEnum.PERCENTAGE_SCORM_COMPLETED.name(), percentage);

                updateLearnerOperationsForChapter(userId, chapterId, moduleId, subjectId, packageSessionId);
        }

        // ==== Coding Submission Tracking ====
        //
        // Code Editor slides are stored as source_type = DOCUMENT, so they live in
        // the cascade under PERCENTAGE_DOCUMENT_COMPLETED (no new enum / no change
        // to the cascade source-type list). Question Mode submissions don't go
        // through the normal /add-or-update-document-activity path — they POST to
        // /coding/submissions which has its own table (coding_submission). This
        // method is the bridge: after CodingSubmissionService saves the row, it
        // calls this so the slide gets a learner_operation entry and the cascade
        // updates the chapter / module / subject / package_session rollups.
        //
        // Completion bar: any submission = 100%. The verdict / score / passed
        // count still live on coding_submission for admin review and learner
        // history; here we only signal "the slide has been completed." Slide-level
        // monotonic guard (B9) makes re-submits a no-op at this layer.
        @Async
        @Transactional
        public void updateLearnerOperationsForCodingSubmission(String userId, String slideId, String chapterId,
                        String moduleId, String subjectId, String packageSessionId) {
                addOrUpdatePercentageOperation(userId, LearnerOperationSourceEnum.SLIDE.name(), slideId,
                                LearnerOperationEnum.PERCENTAGE_DOCUMENT_COMPLETED.name(), 100.0);

                updateLearnerOperationsForChapter(userId, chapterId, moduleId, subjectId, packageSessionId);
        }

        // ==== Video Slide Tracking ====

        @Async
        @Transactional // Added back to fix TransactionRequiredException
        public void updateLearnerOperationsForVideo(String userId, String slideId, String chapterId,
                        String moduleId, String subjectId, String packageSessionId,
                        ActivityLogDTO activityLogDTO) {
                learnerOperationService.deleteLearnerOperationByUserIdSourceAndSourceIdAndOperation(
                                userId, LearnerOperationSourceEnum.SLIDE.name(), slideId,
                                LearnerOperationEnum.VIDEO_LAST_TIMESTAMP.name());

                // STEP 1: Get endTime for timestamp metric
                Long maxEndTime = activityLogDTO.getVideos().stream()
                                .map(VideoActivityLogDTO::getEndTimeInMillis)
                                .max(Long::compareTo)
                                .orElse(null);

                // STEP 2: Fetch all start-end time intervals for this slide + user
                List<Object[]> trackedTimes = activityLogRepository.getVideoTrackedIntervals(slideId, userId);
                List<VideoInterval> intervals = trackedTimes.stream()
                                .filter(row -> row[0] != null && row[1] != null) // Skip rows with null timestamps
                                .map(row -> new VideoInterval(((Timestamp) row[0]).toInstant(),
                                                ((Timestamp) row[1]).toInstant()))
                                .collect(Collectors.toCollection(ArrayList::new));

                // STEP 3: Calculate actual watched milliseconds
                long actualWatchedMillis = getUniqueWatchedDurationMillis(intervals);

                // STEP 4: Fetch published video length
                Long publishedVideoLengthMillis = videoSlideRepository.getPublishedVideoLength(slideId);

                Double percentageWatched = null;
                if (publishedVideoLengthMillis != null && publishedVideoLengthMillis > 0) {
                        percentageWatched = (actualWatchedMillis * 100.0) / publishedVideoLengthMillis;
                }

                // STEP 5: Save learner operations
                // Use helper to handle > 100 and null check
                addOrUpdatePercentageOperation(userId, LearnerOperationSourceEnum.SLIDE.name(), slideId,
                                LearnerOperationEnum.PERCENTAGE_VIDEO_WATCHED.name(), percentageWatched);

                learnerOperationService.addOrUpdateOperation(userId, LearnerOperationSourceEnum.SLIDE.name(), slideId,
                                LearnerOperationEnum.VIDEO_LAST_TIMESTAMP.name(), String.valueOf(maxEndTime));

                updateLearnerOperationsForChapter(userId, chapterId, moduleId, subjectId, packageSessionId);
        }

        // ==== HTML Video Slide Tracking ====

        @Async
        @Transactional
        public void updateLearnerOperationsForHtmlVideo(String userId, String slideId, String chapterId,
                        String moduleId, String subjectId, String packageSessionId,
                        ActivityLogDTO activityLogDTO) {
                learnerOperationService.deleteLearnerOperationByUserIdSourceAndSourceIdAndOperation(
                                userId, LearnerOperationSourceEnum.SLIDE.name(), slideId,
                                LearnerOperationEnum.VIDEO_LAST_TIMESTAMP.name());

                // STEP 1: Get endTime for timestamp metric
                Long maxEndTime = activityLogDTO.getVideos().stream()
                                .map(VideoActivityLogDTO::getEndTimeInMillis)
                                .max(Long::compareTo)
                                .orElse(null);

                // STEP 2: Fetch all start-end time intervals for this slide + user
                List<Object[]> trackedTimes = activityLogRepository.getVideoTrackedIntervals(slideId, userId);
                List<VideoInterval> intervals = trackedTimes.stream()
                                .filter(row -> row[0] != null && row[1] != null) // Skip rows with null timestamps
                                .map(row -> new VideoInterval(((Timestamp) row[0]).toInstant(),
                                                ((Timestamp) row[1]).toInstant()))
                                .collect(Collectors.toCollection(ArrayList::new));

                // STEP 3: Calculate actual watched milliseconds
                long actualWatchedMillis = getUniqueWatchedDurationMillis(intervals);

                // STEP 4: Fetch published video length
                Long videoLength = htmlVideoSlideRepository.getVideoLength(slideId);

                Double percentageWatched = null;
                if (videoLength != null && videoLength > 0) {
                        percentageWatched = (actualWatchedMillis * 100.0) / videoLength;
                }

                // STEP 5: Save learner operations
                addOrUpdatePercentageOperation(userId, LearnerOperationSourceEnum.SLIDE.name(), slideId,
                                LearnerOperationEnum.PERCENTAGE_VIDEO_WATCHED.name(), percentageWatched);

                learnerOperationService.addOrUpdateOperation(userId, LearnerOperationSourceEnum.SLIDE.name(), slideId,
                                LearnerOperationEnum.VIDEO_LAST_TIMESTAMP.name(), String.valueOf(maxEndTime));

                updateLearnerOperationsForChapter(userId, chapterId, moduleId, subjectId, packageSessionId);
        }

        public long getUniqueWatchedDurationMillis(List<VideoInterval> intervals) {
                if (intervals.isEmpty())
                        return 0;

                intervals.sort(Comparator.comparing(VideoInterval::start));
                List<VideoInterval> merged = new ArrayList<>();

                Instant start = intervals.get(0).start();
                Instant end = intervals.get(0).end();

                for (int i = 1; i < intervals.size(); i++) {
                        VideoInterval current = intervals.get(i);
                        if (!current.start().isAfter(end)) {
                                end = end.isAfter(current.end()) ? end : current.end();
                        } else {
                                merged.add(new VideoInterval(start, end));
                                start = current.start();
                                end = current.end();
                        }
                }
                merged.add(new VideoInterval(start, end));

                return merged.stream()
                                .mapToLong(i -> Duration.between(i.start(), i.end()).toMillis())
                                .sum();
        }

        // ==== Audio Slide Tracking ====

        @Async
        @Transactional
        public void updateLearnerOperationsForAudio(String userId, String slideId, String chapterId,
                        String moduleId, String subjectId, String packageSessionId,
                        ActivityLogDTO activityLogDTO) {
                learnerOperationService.deleteLearnerOperationByUserIdSourceAndSourceIdAndOperation(
                                userId, LearnerOperationSourceEnum.SLIDE.name(), slideId,
                                LearnerOperationEnum.AUDIO_LAST_TIMESTAMP.name());

                // STEP 1: Get endTime for timestamp metric
                Long maxEndTime = activityLogDTO.getAudios() != null
                                ? activityLogDTO.getAudios().stream()
                                                .map(vacademy.io.admin_core_service.features.learner_tracking.dto.AudioActivityLogDTO::getEndTimeInMillis)
                                                .filter(java.util.Objects::nonNull)
                                                .max(Long::compareTo)
                                                .orElse(null)
                                : null;

                // STEP 2: Fetch all start-end time intervals for this slide + user
                List<Object[]> trackedTimes = activityLogRepository.getAudioTrackedIntervals(slideId, userId);
                List<VideoInterval> intervals = trackedTimes.stream()
                                .filter(row -> row[0] != null && row[1] != null)
                                .map(row -> new VideoInterval(((Timestamp) row[0]).toInstant(),
                                                ((Timestamp) row[1]).toInstant()))
                                .collect(Collectors.toCollection(ArrayList::new));

                // STEP 3: Calculate actual listened milliseconds
                long actualListenedMillis = getUniqueWatchedDurationMillis(intervals);

                // STEP 4: Fetch published audio length
                Long publishedAudioLengthMillis = audioSlideRepository.getPublishedAudioLength(slideId);

                Double percentageListened = null;
                if (publishedAudioLengthMillis != null && publishedAudioLengthMillis > 0) {
                        percentageListened = (actualListenedMillis * 100.0) / publishedAudioLengthMillis;
                }

                // STEP 5: Save learner operations
                addOrUpdatePercentageOperation(userId, LearnerOperationSourceEnum.SLIDE.name(), slideId,
                                LearnerOperationEnum.PERCENTAGE_AUDIO_LISTENED.name(), percentageListened);

                if (maxEndTime != null) {
                        learnerOperationService.addOrUpdateOperation(userId, LearnerOperationSourceEnum.SLIDE.name(),
                                        slideId,
                                        LearnerOperationEnum.AUDIO_LAST_TIMESTAMP.name(), String.valueOf(maxEndTime));
                }

                updateLearnerOperationsForChapter(userId, chapterId, moduleId, subjectId, packageSessionId);
        }

        // ==== Chapter-Level Tracking ====

        public void updateLearnerOperationsForChapter(String userId, String chapterId, String moduleId,
                        String subjectId, String packageSessionId) {
                learnerOperationService.deleteLearnerOperationByUserIdSourceAndSourceIdAndOperation(userId,
                                LearnerOperationSourceEnum.CHAPTER.name(), chapterId,
                                LearnerOperationEnum.LAST_SLIDE_VIEWED.name());
                List<String> operationList = List.of(
                                LearnerOperationEnum.PERCENTAGE_VIDEO_WATCHED.name(),
                                LearnerOperationEnum.PERCENTAGE_DOCUMENT_COMPLETED.name(),
                                LearnerOperationEnum.PERCENTAGE_ASSIGNMENT_COMPLETED.name(),
                                LearnerOperationEnum.PERCENTAGE_QUESTION_COMPLETED.name(),
                                LearnerOperationEnum.PERCENTAGE_QUIZ_COMPLETED.name(),
                                LearnerOperationEnum.PERCENTAGE_AUDIO_LISTENED.name(),
                                LearnerOperationEnum.PERCENTAGE_SCORM_COMPLETED.name(),
                                LearnerOperationEnum.PERCENTAGE_ASSESSMENT_DONE.name());
                List<String> slideStatusList = List.of(
                                SlideStatus.PUBLISHED.name(),
                                SlideStatus.UNSYNC.name());

                Double chapterPercentage = activityLogRepository.getChapterCompletionPercentage(
                                userId, chapterId, operationList, slideStatusList,
                                List.of(SlideTypeEnum.VIDEO.name(), SlideTypeEnum.DOCUMENT.name(),
                                                SlideTypeEnum.ASSIGNMENT.name(),
                                                SlideTypeEnum.QUESTION.name(), SlideTypeEnum.QUIZ.name(),
                                                SlideTypeEnum.HTML_VIDEO.name(), SlideTypeEnum.AUDIO.name(),
                                                SlideTypeEnum.SCORM.name(), SlideTypeEnum.ASSESSMENT.name()));

                addOrUpdatePercentageOperation(
                                userId,
                                LearnerOperationSourceEnum.CHAPTER.name(),
                                chapterId,
                                LearnerOperationEnum.PERCENTAGE_CHAPTER_COMPLETED.name(),
                                chapterPercentage);

                activityLogRepository
                                .findLatestWatchedSlideIdForChapter(userId, chapterId, slideStatusList, slideStatusList)
                                .ifPresent(slideId -> learnerOperationService.addOrUpdateOperation(
                                                userId,
                                                LearnerOperationSourceEnum.CHAPTER.name(),
                                                chapterId,
                                                LearnerOperationEnum.LAST_SLIDE_VIEWED.name(),
                                                slideId));

                updateModuleCompletionPercentage(userId, moduleId);
                updateSubjectCompletionPercentage(userId, subjectId);
                updatePackageSessionCompletionPercentage(userId, packageSessionId);
        }

        // ==== Module-Level Tracking ====

        public void updateModuleCompletionPercentage(String userId, String moduleId) {
                Double percentage = activityLogRepository.getModuleCompletionPercentage(
                                userId,
                                moduleId,
                                List.of(LearnerOperationEnum.PERCENTAGE_CHAPTER_COMPLETED.name()),
                                List.of(ChapterStatus.ACTIVE.name()));

                addOrUpdatePercentageOperation(
                                userId,
                                LearnerOperationSourceEnum.MODULE.name(),
                                moduleId,
                                LearnerOperationEnum.PERCENTAGE_MODULE_COMPLETED.name(),
                                percentage);
        }

        // ==== Subject-Level Tracking ====

        public void updateSubjectCompletionPercentage(String userId, String subjectId) {
                Double percentage = activityLogRepository.getSubjectCompletionPercentage(
                                userId,
                                subjectId,
                                List.of(LearnerOperationEnum.PERCENTAGE_MODULE_COMPLETED.name()),
                                List.of(ModuleStatusEnum.ACTIVE.name()));

                addOrUpdatePercentageOperation(
                                userId,
                                LearnerOperationSourceEnum.SUBJECT.name(),
                                subjectId,
                                LearnerOperationEnum.PERCENTAGE_SUBJECT_COMPLETED.name(),
                                percentage);
        }

        // ==== Package Session-Level Tracking ====

        public void updatePackageSessionCompletionPercentage(String userId, String packageSessionId) {
                Double percentage = activityLogRepository.getPackageSessionCompletionPercentage(
                                userId,
                                List.of(LearnerOperationEnum.PERCENTAGE_SUBJECT_COMPLETED.name()),
                                packageSessionId,
                                List.of(SubjectStatusEnum.ACTIVE.name()));

                addOrUpdatePercentageOperation(
                                userId,
                                LearnerOperationSourceEnum.PACKAGE_SESSION.name(),
                                packageSessionId,
                                LearnerOperationEnum.PERCENTAGE_PACKAGE_SESSION_COMPLETED.name(),
                                percentage);
        }

        // ==== Triggered Update from Slide ====

        public void updateLearnerOperationsForSlideTrigger(String userId, String slideId, String slideType,
                        String chapterId, String moduleId,
                        String subjectId, String packageSessionId) {
                Double percentageWatched;
                if (SlideTypeEnum.VIDEO.name().equals(slideType)) {
                        percentageWatched = activityLogRepository.getPercentageVideoWatched(slideId, userId);
                } else if (SlideTypeEnum.HTML_VIDEO.name().equals(slideType)) {
                        percentageWatched = activityLogRepository.getPercentageHtmlVideoWatched(slideId, userId);
                } else {
                        percentageWatched = activityLogRepository.getPercentageDocumentWatched(slideId, userId);
                }

                LearnerOperationEnum operation = (SlideTypeEnum.VIDEO.name().equals(slideType)
                                || SlideTypeEnum.HTML_VIDEO.name().equals(slideType))
                                                ? LearnerOperationEnum.PERCENTAGE_VIDEO_WATCHED
                                                : LearnerOperationEnum.PERCENTAGE_DOCUMENT_COMPLETED;

                addOrUpdatePercentageOperation(
                                userId,
                                LearnerOperationSourceEnum.SLIDE.name(),
                                slideId,
                                operation.name(),
                                percentageWatched);

                updateLearnerOperationsForChapter(userId, chapterId, moduleId, subjectId, packageSessionId);
        }

        // ==== Batch-Level Trigger ====

        @Async
        @Transactional // Added back to fix TransactionRequiredException
        public void updateLearnerOperationsForBatch(String source, String slideId, String slideType,
                        String chapterId, String moduleId,
                        String subjectId, String packageSessionId) {
                List<String> userIds = studentSessionRepository.findDistinctUserIdsByPackageSessionAndStatus(
                                packageSessionId,
                                List.of(
                                                LearnerSessionStatusEnum.ACTIVE.name(),
                                                LearnerSessionStatusEnum.INACTIVE.name()));

                switch (source) {
                        case "SLIDE":
                                userIds.forEach(userId -> updateLearnerOperationsForSlideTrigger(userId, slideId,
                                                slideType, chapterId,
                                                moduleId, subjectId, packageSessionId));
                                break;

                        case "CHAPTER":
                                userIds.forEach(userId -> {
                                        updateModuleCompletionPercentage(userId, moduleId);
                                        updateSubjectCompletionPercentage(userId, subjectId);
                                });
                                break;

                        case "MODULE":
                                userIds.forEach(userId -> {
                                        updateSubjectCompletionPercentage(userId, subjectId);
                                });
                                break;

                        case "SUBJECT":
                                userIds.forEach(userId -> updatePackageSessionCompletionPercentage(userId,
                                                packageSessionId));
                                break;

                        default:
                                throw new IllegalArgumentException("Unknown source type: " + source);
                }
        }

        // ==== Private Helper for Percentage Operations ====

        /**
         * Saves a percentage operation with these rules:
         * 1. If value is null, do nothing.
         * 2. If value > 100, save as 100.
         * 3. Monotonic guard at SLIDE level only: never lower a previously-recorded
         *    slide percentage. A learner re-opening a PDF (or scrubbing back in a
         *    video) must not see their per-slide progress drop because of a stale
         *    re-computation.
         *
         *    The guard is intentionally NOT applied at rollup levels (CHAPTER,
         *    MODULE, SUBJECT, PACKAGE_SESSION). Rollups are aggregates over
         *    potentially-changing structure (new slides added to a chapter, new
         *    chapters added to a module, etc.). If we kept rollups monotonic, any
         *    content edit that legitimately lowers an aggregate would permanently
         *    freeze the old higher value, and the displayed course % would diverge
         *    from the actual chapter/module math forever.
         */
        private void addOrUpdatePercentageOperation(String userId, String source, String sourceId, String operation,
                        Double value) {
                if (value == null) {
                        return;
                }
                if (value > 100.0) {
                        value = 100.0;
                }

                if (LearnerOperationSourceEnum.SLIDE.name().equals(source)) {
                        Double existing = learnerOperationService
                                        .findDoubleValueByUserIdSourceAndSourceIdAndOperation(userId, source, sourceId,
                                                        operation)
                                        .orElse(null);
                        if (existing != null && existing >= value) {
                                return;
                        }
                }

                learnerOperationService.addOrUpdateOperation(userId, source, sourceId, operation,
                                String.valueOf(value));
        }

        public record VideoInterval(Instant start, Instant end) {
        }
}
