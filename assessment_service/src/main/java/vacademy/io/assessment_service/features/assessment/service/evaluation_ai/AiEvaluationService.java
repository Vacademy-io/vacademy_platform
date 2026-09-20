package vacademy.io.assessment_service.features.assessment.service.evaluation_ai;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import vacademy.io.assessment_service.features.assessment.dto.evaluation_ai.AiEvaluationTriggerRequest;
import vacademy.io.assessment_service.features.assessment.entity.AiEvaluationProcess;
import vacademy.io.assessment_service.features.assessment.entity.StudentAttempt;
import vacademy.io.assessment_service.features.assessment.enums.AiEvaluationStatusEnum;
import vacademy.io.assessment_service.features.assessment.repository.AiEvaluationProcessRepository;
import vacademy.io.assessment_service.features.assessment.repository.QuestionAssessmentSectionMappingRepository;
import vacademy.io.assessment_service.features.assessment.entity.QuestionAssessmentSectionMapping;
import vacademy.io.assessment_service.features.learner_assessment.entity.QuestionWiseMarks;
import vacademy.io.assessment_service.features.learner_assessment.repository.QuestionWiseMarksRepository;
import vacademy.io.assessment_service.features.assessment.entity.Assessment;
import vacademy.io.assessment_service.core.exception.VacademyException;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;

@Service
@Slf4j
@RequiredArgsConstructor
public class AiEvaluationService {

        // In-flight statuses for trigger idempotency: an attempt already in any of
        // these has a live run, so a re-trigger returns it instead of duplicating.
        private static final List<String> ACTIVE_STATUSES = List.of(
                        AiEvaluationStatusEnum.PENDING.name(),
                        AiEvaluationStatusEnum.STARTED.name(),
                        AiEvaluationStatusEnum.PROCESSING.name(),
                        AiEvaluationStatusEnum.EXTRACTING.name(),
                        AiEvaluationStatusEnum.EVALUATING.name());

        private final AiEvaluationProcessRepository aiEvaluationProcessRepository;
        private final AiEvaluationAsyncService aiEvaluationAsyncService;
        private final AiEvaluationCancellationService cancellationService;
        private final EvaluationAccessValidator accessValidator;
        private final QuestionAssessmentSectionMappingRepository questionMappingRepository;
        private final QuestionWiseMarksRepository questionWiseMarksRepository;

        /**
         * The question the slide-level "create assessment" form provisions when a
         * teacher attaches the paper as a PDF and grades by hand. It is a container
         * for the upload, not a question: grading a sheet against it would produce a
         * confident random score.
         */
        static final String PLACEHOLDER_QUESTION_TEXT = "Upload your answer sheet.";

        public static final String PLACEHOLDER_ONLY_MESSAGE =
                        "This test has no digitised questions - only the 'Upload your answer sheet' placeholder. "
                        + "Add the question paper's questions (recreate the test with AI checking on, or add "
                        + "them under Questions) before evaluating with AI.";

        @Transactional
        public List<String> triggerEvaluation(AiEvaluationTriggerRequest request, CustomUserDetails user,
                        String instituteId) {
                log.info("Triggering AI evaluation for {} attempts with model: {}", request.getAttemptIds().size(),
                                request.getPreferredModel());

                List<String> processIds = new ArrayList<>();

                for (String attemptId : request.getAttemptIds()) {
                        // Authorization is intentionally NOT caught below: a request that
                        // references an attempt outside the caller's institute (or an
                        // unauthenticated caller) fails the whole batch rather than being
                        // silently skipped.
                        StudentAttempt attempt = accessValidator.requireAttemptAccess(user, instituteId, attemptId);
                        // Outside the try below on purpose: a test the AI cannot grade must
                        // fail the request with the reason, not be skipped in silence. An
                        // attempt with no registration keeps its old fate (skipped inside the try).
                        if (attempt.getRegistration() != null) {
                                requireGradableQuestions(attempt.getRegistration().getAssessment());
                        }
                        try {
                                String processId = initiateEvaluationForAttempt(attempt, request.getPreferredModel(),
                                                false, user != null ? user.getUserId() : null);
                                processIds.add(processId);
                                log.info("Successfully initiated evaluation for attempt: {} with processId: {}",
                                                attemptId, processId);
                        } catch (Exception e) {
                                log.error("Failed to initiate evaluation for attempt {}", attemptId, e);
                        }
                }

                log.info("Completed triggering evaluation for {} attempts, generated {} process IDs",
                                request.getAttemptIds().size(), processIds.size());
                return processIds;
        }

        private String initiateEvaluationForAttempt(StudentAttempt attempt, String preferredModel) {
                return initiateEvaluationForAttempt(attempt, preferredModel, false);
        }

        /** True when the assessment's only live question is the manual-upload placeholder. */
        public boolean isPlaceholderOnly(Assessment assessment) {
                if (assessment == null) {
                        return false;
                }
                List<QuestionAssessmentSectionMapping> mappings = questionMappingRepository
                                .getQuestionAssessmentSectionMappingByAssessmentId(assessment.getId());
                List<QuestionAssessmentSectionMapping> live = mappings.stream()
                                .filter(m -> m.getStatus() == null || !"DELETED".equalsIgnoreCase(m.getStatus()))
                                .toList();
                if (live.size() != 1 || live.get(0).getQuestion() == null) {
                        return false;
                }
                var text = live.get(0).getQuestion().getTextData();
                String content = text != null && text.getContent() != null
                                ? text.getContent().replaceAll("<[^>]+>", "").trim()
                                : "";
                return PLACEHOLDER_QUESTION_TEXT.equalsIgnoreCase(content);
        }

        /**
         * The checker grades one {@code question_wise_marks} row per question, and a
         * learner's submit is what normally creates those rows. An attempt made by
         * staff — a single offline upload, a bulk-intake copy — never goes through a
         * submit, so it reached the checker with no rows and failed with "no
         * questions found for attempt" (every bulk copy, 2026-09-20). Give such an
         * attempt one PENDING zero-mark row per active question; an attempt that
         * already has rows (learner submit, retrofit backfill) is left exactly as is.
         */
        void ensureQuestionRows(StudentAttempt attempt) {
                if (attempt == null || attempt.getRegistration() == null
                                || attempt.getRegistration().getAssessment() == null) {
                        return;
                }
                if (!questionWiseMarksRepository.findByStudentAttemptId(attempt.getId()).isEmpty()) {
                        return;
                }
                Assessment assessment = attempt.getRegistration().getAssessment();
                List<QuestionWiseMarks> rows = new ArrayList<>();
                List<QuestionAssessmentSectionMapping> mappings = new ArrayList<>(questionMappingRepository
                                .getQuestionAssessmentSectionMappingByAssessmentId(assessment.getId()));
                // Paper order (section, then question): the checker numbers what it
                // gets in the order it gets it, and the student numbers as the paper does.
                mappings.sort(java.util.Comparator
                                .comparingInt((QuestionAssessmentSectionMapping m) -> m.getSection() != null
                                                && m.getSection().getSectionOrder() != null
                                                                ? m.getSection().getSectionOrder() : Integer.MAX_VALUE)
                                .thenComparingInt(m -> m.getQuestionOrder() != null ? m.getQuestionOrder() : Integer.MAX_VALUE));
                for (QuestionAssessmentSectionMapping mapping : mappings) {
                        if (mapping.getQuestion() == null || mapping.getSection() == null
                                        || "DELETED".equalsIgnoreCase(mapping.getStatus())
                                        || "DELETED".equalsIgnoreCase(mapping.getSection().getStatus())) {
                                continue;
                        }
                        rows.add(QuestionWiseMarks.builder()
                                        .assessment(assessment)
                                        .studentAttempt(attempt)
                                        .question(mapping.getQuestion())
                                        .section(mapping.getSection())
                                        .status("PENDING")
                                        .marks(0)
                                        .build());
                }
                if (!rows.isEmpty()) {
                        questionWiseMarksRepository.saveAll(rows);
                        log.info("Created {} pending question rows for attempt {} before its AI check",
                                        rows.size(), attempt.getId());
                }
        }

        /** Refuse to queue an AI check that has nothing real to grade against. */
        public void requireGradableQuestions(Assessment assessment) {
                if (isPlaceholderOnly(assessment)) {
                        throw new VacademyException(PLACEHOLDER_ONLY_MESSAGE);
                }
        }

        /**
         * @param queueOnly create the row as PENDING and let {@link AiEvaluationQueuePoller}
         *                  dispatch it under the in-flight cap, instead of starting it now.
         *                  Bulk runs must use this: dispatching 200 copies at once floods
         *                  the single AI pod. A teacher's one-off check keeps the
         *                  immediate path, so the page it opens shows progress at once.
         */
        public String initiateEvaluationForAttempt(StudentAttempt attempt, String preferredModel, boolean queueOnly) {
                return initiateEvaluationForAttempt(attempt, preferredModel, queueOnly, null);
        }

        /**
         * @param triggeredBy the teacher who asked for this check, so the completion
         *                    notice reaches them; null for automatic and bulk checks.
         */
        public String initiateEvaluationForAttempt(StudentAttempt attempt, String preferredModel, boolean queueOnly,
                        String triggeredBy) {
                String attemptId = attempt.getId();

                // Idempotency: reuse an already-running evaluation for this attempt
                // instead of spawning a second concurrent (full-cost) run.
                List<AiEvaluationProcess> active = aiEvaluationProcessRepository
                                .findActiveByAttemptId(attemptId, ACTIVE_STATUSES);
                if (!active.isEmpty()) {
                        String existingId = active.get(0).getId();
                        log.info("Active evaluation {} already exists for attempt {}; returning it (idempotent)",
                                        existingId, attemptId);
                        return existingId;
                }

                ensureQuestionRows(attempt);

                AiEvaluationProcess process = new AiEvaluationProcess();
                // Remove manual ID setting - let @UuidGenerator handle it
                process.setStudentAttempt(attempt);
                // Get assessment from registration instead of assessmentSetMapping (which can
                // be null)
                process.setAssessment(attempt.getRegistration().getAssessment());
                process.setStatus(AiEvaluationStatusEnum.PENDING.name());
                process.setStartedAt(new Date());
                process.setTriggeredBy(triggeredBy);

                AiEvaluationProcess savedProcess = aiEvaluationProcessRepository.save(process);
                aiEvaluationProcessRepository.flush(); // Ensure the process is inserted before async call
                log.info("Created AI evaluation process with ID: {} for attempt: {}", savedProcess.getId(), attemptId);

                // Clear any stale cancellation flags from previous runs
                cancellationService.clearFlag(savedProcess.getId());

                if (queueOnly) {
                        log.info("Queued AI evaluation {} for attempt {} (poller will dispatch)", savedProcess.getId(), attemptId);
                        return savedProcess.getId();
                }

                // Defer the @Async dispatch until AFTER the parent transaction
                // commits. Without this, the async thread starts in parallel and
                // can call findById(processId) before the INSERT becomes visible
                // to other connections, surfacing as "Process not found" in logs.
                final String processId = savedProcess.getId();
                if (TransactionSynchronizationManager.isSynchronizationActive()) {
                        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                                @Override
                                public void afterCommit() {
                                        aiEvaluationAsyncService.evaluateAttemptAsync(processId, attemptId, preferredModel);
                                }
                        });
                } else {
                        aiEvaluationAsyncService.evaluateAttemptAsync(processId, attemptId, preferredModel);
                }

                return processId;
        }
}
