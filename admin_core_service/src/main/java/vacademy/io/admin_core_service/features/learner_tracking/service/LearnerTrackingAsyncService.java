package vacademy.io.admin_core_service.features.learner_tracking.service;

import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.chapter.enums.ChapterStatus;
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
import java.util.Optional;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.stream.Collectors;

@Service
public class LearnerTrackingAsyncService {

    private final ExecutorService executor = Executors.newFixedThreadPool(10);

    @Autowired private StudentSessionRepository studentSessionRepository;
    @Autowired private ActivityLogRepository activityLogRepository;
    @Autowired private LearnerOperationService learnerOperationService;
    @Autowired private VideoSlideRepository videoSlideRepository;

    // ==== Document Slide Tracking ====

    public void updateLearnerOperationsForDocument(String userId, String slideId, String chapterId,
                                                   String moduleId, String subjectId, String packageSessionId,
                                                   ActivityLogDTO activityLogDTO) {
        executor.submit(() -> {
            int highestPage = activityLogDTO.getDocuments().stream()
                    .map(DocumentActivityLogDTO::getPageNumber)
                    .max(Integer::compareTo)
                    .orElse(0);

            learnerOperationService.deleteLearnerOperationByUserIdSourceAndSourceIdAndOperation(userId,LearnerOperationSourceEnum.SLIDE.name(),slideId,LearnerOperationEnum.DOCUMENT_LAST_PAGE.name());
            learnerOperationService.deleteLearnerOperationByUserIdSourceAndSourceIdAndOperation(userId,LearnerOperationSourceEnum.SLIDE.name(),slideId,LearnerOperationEnum.PERCENTAGE_DOCUMENT_WATCHED.name());

            Double percentageWatched = activityLogRepository.getPercentageDocumentWatched(slideId, userId);
            if (percentageWatched == null) {
                percentageWatched = 0.0;
            }
            learnerOperationService.addOrUpdateOperation(userId, LearnerOperationSourceEnum.SLIDE.name(), slideId,
                    LearnerOperationEnum.PERCENTAGE_DOCUMENT_WATCHED.name(), String.valueOf(percentageWatched));

            learnerOperationService.addOrUpdateOperation(userId, LearnerOperationSourceEnum.SLIDE.name(), slideId,
                    LearnerOperationEnum.DOCUMENT_LAST_PAGE.name(), String.valueOf(highestPage));

            updateLearnerOperationsForChapter(userId, chapterId, moduleId, subjectId, packageSessionId);
        });
    }

    @Transactional
    @Async
    public void updateLearnerOperationsForQuestion(String userId, String slideId, String chapterId,
                                                   String moduleId, String subjectId, String packageSessionId,
                                                   ActivityLogDTO activityLogDTO) {
        learnerOperationService.deleteLearnerOperationByUserIdSourceAndSourceIdAndOperation(userId,LearnerOperationSourceEnum.SLIDE.name(),slideId,LearnerOperationEnum.PERCENTAGE_QUESTION_COMPLETED.name());
        learnerOperationService.addOrUpdateOperation(userId, LearnerOperationSourceEnum.SLIDE.name(), slideId,
                LearnerOperationEnum.PERCENTAGE_QUESTION_COMPLETED.name(), String.valueOf(100.0));

        updateLearnerOperationsForChapter(userId, chapterId, moduleId, subjectId, packageSessionId);
    }

    @Transactional
    @Async
    public void updateLearnerOperationsForAssignment(String userId, String slideId, String chapterId,
                                                   String moduleId, String subjectId, String packageSessionId,
                                                   ActivityLogDTO activityLogDTO) {
        learnerOperationService.deleteLearnerOperationByUserIdSourceAndSourceIdAndOperation(userId,LearnerOperationSourceEnum.SLIDE.name(),slideId,LearnerOperationEnum.PERCENTAGE_ASSIGNMENT_COMPLETED.name());
        learnerOperationService.addOrUpdateOperation(userId, LearnerOperationSourceEnum.SLIDE.name(), slideId,
                LearnerOperationEnum.PERCENTAGE_ASSIGNMENT_COMPLETED.name(), String.valueOf(100.0));

        updateLearnerOperationsForChapter(userId, chapterId, moduleId, subjectId, packageSessionId);
    }

    // ==== Video Slide Tracking ====

    @Transactional
    @Async
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
                .map(row -> new VideoInterval(((Timestamp) row[0]).toInstant(), ((Timestamp) row[1]).toInstant()))
                .collect(Collectors.toCollection(ArrayList::new)); // now it's mutable

        // STEP 3: Calculate actual watched milliseconds
        long actualWatchedMillis = getUniqueWatchedDurationMillis(intervals);

        // STEP 4: Fetch published video length
        Long publishedVideoLengthMillis = videoSlideRepository.getPublishedVideoLength(slideId);

        double percentageWatched = 0.0;
        if (publishedVideoLengthMillis != null && publishedVideoLengthMillis > 0) {
            percentageWatched = (actualWatchedMillis * 100.0) / publishedVideoLengthMillis;
            if (percentageWatched > 100.0) percentageWatched = 100.0;
        }

        // STEP 5: Save learner operations
        learnerOperationService.addOrUpdateOperation(userId, LearnerOperationSourceEnum.SLIDE.name(), slideId,
                LearnerOperationEnum.PERCENTAGE_VIDEO_WATCHED.name(), String.valueOf(percentageWatched));

        learnerOperationService.addOrUpdateOperation(userId, LearnerOperationSourceEnum.SLIDE.name(), slideId,
                LearnerOperationEnum.VIDEO_LAST_TIMESTAMP.name(), String.valueOf(maxEndTime));

        updateLearnerOperationsForChapter(userId, chapterId, moduleId, subjectId, packageSessionId);
    }

    public long getUniqueWatchedDurationMillis(List<VideoInterval> intervals) {
        if (intervals.isEmpty()) return 0;

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
        learnerOperationService.deleteLearnerOperationByUserIdSourceAndSourceIdAndOperation(userId,LearnerOperationSourceEnum.CHAPTER.name(),chapterId,LearnerOperationEnum.PERCENTAGE_CHAPTER_COMPLETED.name());
        learnerOperationService.deleteLearnerOperationByUserIdSourceAndSourceIdAndOperation(userId,LearnerOperationSourceEnum.CHAPTER.name(),chapterId,LearnerOperationEnum.LAST_SLIDE_VIEWED.name());
        List<String> operationList = List.of(
                LearnerOperationEnum.PERCENTAGE_VIDEO_WATCHED.name(),
                LearnerOperationEnum.PERCENTAGE_DOCUMENT_WATCHED.name(),
                LearnerOperationEnum.PERCENTAGE_ASSIGNMENT_COMPLETED.name(),
                LearnerOperationEnum.PERCENTAGE_QUESTION_COMPLETED.name()
        );
        List<String> slideStatusList = List.of(
                SlideStatus.PUBLISHED.name(),
                SlideStatus.UNSYNC.name()
        );

        Double chapterPercentage = activityLogRepository.getChapterCompletionPercentage(
                userId, chapterId, operationList, slideStatusList,List.of(SlideTypeEnum.VIDEO.name(), SlideTypeEnum.DOCUMENT.name(),SlideTypeEnum.ASSIGNMENT.name(),SlideTypeEnum.QUESTION.name())
        );

        learnerOperationService.addOrUpdateOperation(
                userId,
                LearnerOperationSourceEnum.CHAPTER.name(),
                chapterId,
                LearnerOperationEnum.PERCENTAGE_CHAPTER_COMPLETED.name(),
                String.valueOf(chapterPercentage)
        );

        activityLogRepository.findLatestWatchedSlideIdForChapter(userId, chapterId, slideStatusList, slideStatusList)
                .ifPresent(slideId -> learnerOperationService.addOrUpdateOperation(
                        userId,
                        LearnerOperationSourceEnum.CHAPTER.name(),
                        chapterId,
                        LearnerOperationEnum.LAST_SLIDE_VIEWED.name(),
                        slideId
                ));

        updateModuleCompletionPercentage(userId, moduleId);
        updateSubjectCompletionPercentage(userId, subjectId);
        updatePackageSessionCompletionPercentage(userId, packageSessionId);
    }

    // ==== Module-Level Tracking ====

    public void updateModuleCompletionPercentage(String userId, String moduleId) {
        learnerOperationService.deleteLearnerOperationByUserIdSourceAndSourceIdAndOperation(userId,LearnerOperationSourceEnum.MODULE.name(),moduleId,LearnerOperationEnum.PERCENTAGE_MODULE_COMPLETED.name());
        Double percentage = activityLogRepository.getModuleCompletionPercentage(
                userId,
                moduleId,
                List.of(LearnerOperationEnum.PERCENTAGE_CHAPTER_COMPLETED.name()),
                List.of(ChapterStatus.ACTIVE.name())
        );


        if (percentage == null) {
            percentage = 0.0;
        }

        learnerOperationService.addOrUpdateOperation(
                userId,
                LearnerOperationSourceEnum.MODULE.name(),
                moduleId,
                LearnerOperationEnum.PERCENTAGE_MODULE_COMPLETED.name(),
                String.valueOf(percentage)
        );
    }

    // ==== Subject-Level Tracking ====

    public void updateSubjectCompletionPercentage(String userId, String subjectId) {
        learnerOperationService.deleteLearnerOperationByUserIdSourceAndSourceIdAndOperation(userId,LearnerOperationSourceEnum.SUBJECT.name(),subjectId,LearnerOperationEnum.PERCENTAGE_SUBJECT_COMPLETED.name());
        Double percentage = activityLogRepository.getSubjectCompletionPercentage(
                userId,
                subjectId,
                List.of(LearnerOperationEnum.PERCENTAGE_MODULE_COMPLETED.name()),
                List.of(ModuleStatusEnum.ACTIVE.name())
        );

        if (percentage == null) {
            percentage = 0.0;
        }
        learnerOperationService.addOrUpdateOperation(
                userId,
                LearnerOperationSourceEnum.SUBJECT.name(),
                subjectId,
                LearnerOperationEnum.PERCENTAGE_SUBJECT_COMPLETED.name(),
                String.valueOf(percentage)
        );
    }

    // ==== Package Session-Level Tracking ====

    public void updatePackageSessionCompletionPercentage(String userId, String packageSessionId) {
        learnerOperationService.deleteLearnerOperationByUserIdSourceAndSourceIdAndOperation(userId,LearnerOperationSourceEnum.PACKAGE_SESSION.name(),packageSessionId,LearnerOperationEnum.PERCENTAGE_PACKAGE_SESSION_COMPLETED.name());
        Double percentage = activityLogRepository.getPackageSessionCompletionPercentage(
                userId,
                List.of(LearnerOperationEnum.PERCENTAGE_SUBJECT_COMPLETED.name()),
                packageSessionId,
                List.of(SubjectStatusEnum.ACTIVE.name())
        );

        if (percentage == null) {
            percentage = 0.0;
        }

        learnerOperationService.addOrUpdateOperation(
                userId,
                LearnerOperationSourceEnum.PACKAGE_SESSION.name(),
                packageSessionId,
                LearnerOperationEnum.PERCENTAGE_PACKAGE_SESSION_COMPLETED.name(),
                String.valueOf(percentage)
        );
    }

    // ==== Triggered Update from Slide ====

    public void updateLearnerOperationsForSlideTrigger(String userId, String slideId, String slideType,
                                                       String chapterId, String moduleId,
                                                       String subjectId, String packageSessionId) {
        Double percentageWatched = slideType.equals(SlideTypeEnum.VIDEO.name())
                ? activityLogRepository.getPercentageVideoWatched(slideId, userId)
                : activityLogRepository.getPercentageDocumentWatched(slideId, userId);

        LearnerOperationEnum operation = slideType.equals(SlideTypeEnum.VIDEO.name())
                ? LearnerOperationEnum.PERCENTAGE_VIDEO_WATCHED
                : LearnerOperationEnum.PERCENTAGE_DOCUMENT_WATCHED;

        learnerOperationService.addOrUpdateOperation(
                userId,
                LearnerOperationSourceEnum.SLIDE.name(),
                slideId,
                operation.name(),
                String.valueOf(percentageWatched)
        );

        updateLearnerOperationsForChapter(userId, chapterId, moduleId, subjectId, packageSessionId);
    }

    // ==== Batch-Level Trigger ====

    @Transactional
    @Async
    public void updateLearnerOperationsForBatch(String source, String slideId, String slideType,
                                                String chapterId, String moduleId,
                                                String subjectId, String packageSessionId) {
        List<String> userIds = studentSessionRepository.findDistinctUserIdsByPackageSessionAndStatus(
                packageSessionId,
                List.of(
                        LearnerSessionStatusEnum.ACTIVE.name(),
                        LearnerSessionStatusEnum.INACTIVE.name()
                )
        );

        switch (source) {
            case "SLIDE":
                userIds.forEach(userId ->
                        updateLearnerOperationsForSlideTrigger(userId, slideId, slideType, chapterId, moduleId, subjectId, packageSessionId)
                );
                break;

            case "CHAPTER":
                userIds.forEach(userId ->
                        {
                            updateModuleCompletionPercentage(userId,moduleId);
                            updateSubjectCompletionPercentage(userId,subjectId);
                        }
                );
                break;

            case "MODULE":
                userIds.forEach(userId ->
                        {
                            updateSubjectCompletionPercentage(userId,subjectId);
                        }
                );
                break;

            case "SUBJECT":
                userIds.forEach(userId ->
                        updatePackageSessionCompletionPercentage(userId,packageSessionId)
                );
                break;

            default:
                throw new IllegalArgumentException("Unknown source type: " + source);
        }
    }

    public record VideoInterval(Instant start, Instant end) {}
}
