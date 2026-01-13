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
                learnerOperationService.deleteLearnerOperationByUserIdSourceAndSourceIdAndOperation(userId,
                                LearnerOperationSourceEnum.SLIDE.name(), slideId,
                                LearnerOperationEnum.PERCENTAGE_DOCUMENT_COMPLETED.name());

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
                learnerOperationService.deleteLearnerOperationByUserIdSourceAndSourceIdAndOperation(userId,
                                LearnerOperationSourceEnum.SLIDE.name(), slideId,
                                LearnerOperationEnum.PERCENTAGE_QUESTION_COMPLETED.name());

                addOrUpdatePercentageOperation(userId, LearnerOperationSourceEnum.SLIDE.name(), slideId,
                                LearnerOperationEnum.PERCENTAGE_QUESTION_COMPLETED.name(), 100.0);

                updateLearnerOperationsForChapter(userId, chapterId, moduleId, subjectId, packageSessionId);
        }

        @Async
        @Transactional // Added back to fix TransactionRequiredException
        public void updateLearnerOperationsForAssignment(String userId, String slideId, String chapterId,
                        String moduleId, String subjectId, String packageSessionId,
                        ActivityLogDTO activityLogDTO) {
                learnerOperationService.deleteLearnerOperationByUserIdSourceAndSourceIdAndOperation(userId,
                                LearnerOperationSourceEnum.SLIDE.name(), slideId,
                                LearnerOperationEnum.PERCENTAGE_ASSIGNMENT_COMPLETED.name());

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

                learnerOperationService.deleteLearnerOperationByUserIdSourceAndSourceIdAndOperation(userId,
                                LearnerOperationSourceEnum.SLIDE.name(), slideId,
                                LearnerOperationEnum.PERCENTAGE_QUIZ_COMPLETED.name());

                addOrUpdatePercentageOperation(userId, LearnerOperationSourceEnum.SLIDE.name(), slideId,
                                LearnerOperationEnum.PERCENTAGE_QUIZ_COMPLETED.name(), percentageCompleted);

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
                                LearnerOperationEnum.PERCENTAGE_VIDEO_WATCHED.name());

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
                                LearnerOperationEnum.PERCENTAGE_VIDEO_WATCHED.name());

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

        // ==== Chapter-Level Tracking ====

        public void updateLearnerOperationsForChapter(String userId, String chapterId, String moduleId,
                        String subjectId, String packageSessionId) {
                learnerOperationService.deleteLearnerOperationByUserIdSourceAndSourceIdAndOperation(userId,
                                LearnerOperationSourceEnum.CHAPTER.name(), chapterId,
                                LearnerOperationEnum.PERCENTAGE_CHAPTER_COMPLETED.name());
                learnerOperationService.deleteLearnerOperationByUserIdSourceAndSourceIdAndOperation(userId,
                                LearnerOperationSourceEnum.CHAPTER.name(), chapterId,
                                LearnerOperationEnum.LAST_SLIDE_VIEWED.name());
                List<String> operationList = List.of(
                                LearnerOperationEnum.PERCENTAGE_VIDEO_WATCHED.name(),
                                LearnerOperationEnum.PERCENTAGE_DOCUMENT_COMPLETED.name(),
                                LearnerOperationEnum.PERCENTAGE_ASSIGNMENT_COMPLETED.name(),
                                LearnerOperationEnum.PERCENTAGE_QUESTION_COMPLETED.name(),
                                LearnerOperationEnum.PERCENTAGE_QUIZ_COMPLETED.name());
                List<String> slideStatusList = List.of(
                                SlideStatus.PUBLISHED.name(),
                                SlideStatus.UNSYNC.name());

                Double chapterPercentage = activityLogRepository.getChapterCompletionPercentage(
                                userId, chapterId, operationList, slideStatusList,
                                List.of(SlideTypeEnum.VIDEO.name(), SlideTypeEnum.DOCUMENT.name(),
                                                SlideTypeEnum.ASSIGNMENT.name(),
                                                SlideTypeEnum.QUESTION.name(), SlideTypeEnum.QUIZ.name(),
                                                SlideTypeEnum.HTML_VIDEO.name()));

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
                learnerOperationService.deleteLearnerOperationByUserIdSourceAndSourceIdAndOperation(userId,
                                LearnerOperationSourceEnum.MODULE.name(), moduleId,
                                LearnerOperationEnum.PERCENTAGE_MODULE_COMPLETED.name());
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
                learnerOperationService.deleteLearnerOperationByUserIdSourceAndSourceIdAndOperation(userId,
                                LearnerOperationSourceEnum.SUBJECT.name(), subjectId,
                                LearnerOperationEnum.PERCENTAGE_SUBJECT_COMPLETED.name());
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
                learnerOperationService.deleteLearnerOperationByUserIdSourceAndSourceIdAndOperation(userId,
                                LearnerOperationSourceEnum.PACKAGE_SESSION.name(), packageSessionId,
                                LearnerOperationEnum.PERCENTAGE_PACKAGE_SESSION_COMPLETED.name());
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
         * Saves percentage operation with specific rules:
         * 1. If value is null, do nothing.
         * 2. If value > 100, save as 100.
         */
        private void addOrUpdatePercentageOperation(String userId, String source, String sourceId, String operation,
                        Double value) {
                if (value == null) {
                        return;
                }
                if (value > 100.0) {
                        value = 100.0;
                }
                learnerOperationService.addOrUpdateOperation(userId, source, sourceId, operation,
                                String.valueOf(value));
        }

        public record VideoInterval(Instant start, Instant end) {
        }
}
