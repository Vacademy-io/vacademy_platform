package vacademy.io.admin_core_service.features.learner_tracking.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import vacademy.io.admin_core_service.features.learner_tracking.dto.ActivityLogDTO;
import vacademy.io.admin_core_service.features.learner_tracking.dto.ConcentrationScoreDTO;

import java.sql.Timestamp;
import java.util.List;

@Entity
@Table(name = "activity_log")
@Getter
@Setter
@NoArgsConstructor
public class ActivityLog {

        @Id
        @Column(length = 255, nullable = false)
        private String id;

        @Column(name = "source_id", length = 255)
        private String sourceId;

        @Column(name = "source_type", length = 255)
        private String sourceType;

        @Column(name = "user_id", length = 255, nullable = false)
        private String userId;

        @Column(name = "slide_id", length = 255)
        private String slideId;

        @Column(name = "start_time")
        private Timestamp startTime;

        @Column(name = "end_time")
        private Timestamp endTime;

        @Column(name = "percentage_watched")
        private Double percentageWatched;

        @Column(name = "engaged_ms")
        private Long engagedMs;

        @Column(name = "status", length = 50)
        private String status;

        @Column(name = "raw_json", columnDefinition = "TEXT")
        private String rawJson;

        @Column(name = "processed_json", columnDefinition = "TEXT")
        private String processedJson;

        @Column(name = "created_at", insertable = false, updatable = false, columnDefinition = "TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
        private Timestamp createdAt;

        @Column(name = "updated_at", insertable = false, updatable = false, columnDefinition = "TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
        private Timestamp updatedAt;

        @OneToMany(mappedBy = "activityLog", fetch = FetchType.LAZY)
        private List<DocumentTracked> documentTracked;

        @OneToMany(mappedBy = "activityLog", fetch = FetchType.LAZY)
        private List<VideoTracked> videoTracked;

        @OneToMany(mappedBy = "activityLog", fetch = FetchType.LAZY)
        private List<QuestionSlideTracked> questionSlideTracked;

        @OneToMany(mappedBy = "activityLog", fetch = FetchType.LAZY)
        private List<AssignmentSlideTracked> assignmentSlideTracked;

        @OneToMany(mappedBy = "activityLog", fetch = FetchType.LAZY)
        private List<AssessmentSlideTracked> assessmentSlideTracked;

        @OneToMany(mappedBy = "activityLog", fetch = FetchType.LAZY)
        private List<VideoSlideQuestionTracked> videoSlideQuestionTracked;

        @OneToMany(mappedBy = "activityLog", fetch = FetchType.LAZY)
        private List<QuizSlideQuestionTracked> quizSlideQuestionTracked;

        @OneToMany(mappedBy = "activityLog", fetch = FetchType.LAZY)
        private List<AudioTracked> audioTracked;

        @OneToOne(mappedBy = "activityLog", cascade = CascadeType.ALL, fetch = FetchType.LAZY, orphanRemoval = true)
        private ConcentrationScore concentrationScore;

        public ActivityLog(ActivityLogDTO activityLogDTO, String userId, String slideId) {
                this.id = activityLogDTO.getId();
                this.sourceId = activityLogDTO.getSourceId();
                this.sourceType = activityLogDTO.getSourceType();
                this.userId = userId;
                this.slideId = slideId;
                if (activityLogDTO.getStartTimeInMillis() != null) {
                        this.startTime = new Timestamp(activityLogDTO.getStartTimeInMillis());
                }
                if (activityLogDTO.getEndTimeInMillis() != null) {
                        this.endTime = new Timestamp(activityLogDTO.getEndTimeInMillis());
                }
                this.percentageWatched = activityLogDTO.getPercentageWatched();
        }

        /** Anything before this is a client-side unset (start_time_in_millis = 0 -> 1970-01-01). */
        private static final long MIN_VALID_EPOCH_MS = 1672531200000L; // 2023-01-01T00:00:00Z

        /** Per-activity sanity ceiling (24h), matching the old query cap. No single slide session
         *  should credit more than a day; guards against inflated breadcrumbs / left-open sessions. */
        private static final long MAX_ENGAGED_MS = 86400000L;

        /**
         * Runs before every insert/update. Repairs client-supplied times and derives a fallback
         * engaged time so no consumer ever reads a garbage (end_time - start_time) again:
         *  - Bug 2: a missing/epoch start_time is reset to the reliable server time.
         *  - Bug 4: an end_time before start_time is clamped up to start_time.
         *  - engaged_ms falls back to the clamped wall-clock window ONLY when it was not set
         *    explicitly. Passive-media rows overwrite it with the merged breadcrumb duration
         *    (see LearnerTrackingService#recomputeEngagedMsFromBreadcrumbs); interactive slides,
         *    which have no breadcrumbs, keep this fallback.
         */
        @PrePersist
        @PreUpdate
        private void sanitizeTimesAndDeriveEngaged() {
                if (startTime == null || startTime.getTime() < MIN_VALID_EPOCH_MS) {
                        startTime = (createdAt != null) ? createdAt : new Timestamp(System.currentTimeMillis());
                }
                if (endTime != null && endTime.before(startTime)) {
                        endTime = startTime;
                }
                if (engagedMs == null && endTime != null) {
                        engagedMs = Math.min(MAX_ENGAGED_MS, Math.max(0L, endTime.getTime() - startTime.getTime()));
                }
        }

        public ActivityLogDTO toActivityLogDTO() {
                ActivityLogDTO activityLogDTO = new ActivityLogDTO();

                activityLogDTO.setId(id);
                activityLogDTO.setSourceId(sourceId);
                activityLogDTO.setSourceType(sourceType);
                activityLogDTO.setUserId(userId);
                activityLogDTO.setSlideId(slideId);
                activityLogDTO.setStartTimeInMillis(startTime != null ? startTime.getTime() : null);
                activityLogDTO.setEndTimeInMillis(endTime != null ? endTime.getTime() : null);
                activityLogDTO.setPercentageWatched(percentageWatched != null ? percentageWatched : 0.0);

                activityLogDTO.setDocuments(documentTracked != null
                                ? documentTracked.stream()
                                                .map(DocumentTracked::documentActivityLogDTO)
                                                .toList()
                                : List.of());

                activityLogDTO.setVideos(videoTracked != null
                                ? videoTracked.stream()
                                                .map(VideoTracked::videoActivityLogDTO)
                                                .toList()
                                : List.of());

                activityLogDTO.setAssignmentSlides(assignmentSlideTracked != null
                                ? assignmentSlideTracked.stream()
                                                .map(AssignmentSlideTracked::toAssignmentSlideActivityLog)
                                                .toList()
                                : List.of());

                activityLogDTO.setAssessmentSlides(assessmentSlideTracked != null
                                ? assessmentSlideTracked.stream()
                                                .map(AssessmentSlideTracked::toAssessmentSlideActivityLog)
                                                .toList()
                                : List.of());

                activityLogDTO.setQuestionSlides(questionSlideTracked != null
                                ? questionSlideTracked.stream()
                                                .map(QuestionSlideTracked::toQuestionSlideActivityLogDTO)
                                                .toList()
                                : List.of());

                activityLogDTO.setVideoSlidesQuestions(videoSlideQuestionTracked != null
                                ? videoSlideQuestionTracked.stream()
                                                .map(VideoSlideQuestionTracked::toVideoSlideQuestionActivityLogDTO)
                                                .toList()
                                : List.of());

                // ---
                // Corrected line
                activityLogDTO.setQuizSides(quizSlideQuestionTracked != null
                                ? quizSlideQuestionTracked.stream() // Changed from 'questionSlideTracked'
                                                .map(QuizSlideQuestionTracked::toQuizSideActivityLogDTO)
                                                .toList()
                                : List.of());
                // ---

                activityLogDTO.setAudios(audioTracked != null
                                ? audioTracked.stream()
                                                .map(AudioTracked::toAudioActivityLogDTO)
                                                .toList()
                                : List.of());

                activityLogDTO.setConcentrationScore(concentrationScore != null
                                ? concentrationScore.toConcentrationScoreDTO()
                                : null);

                return activityLogDTO;
        }

}