package vacademy.io.assessment_service.features.assessment.service.evaluation_ai;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.assessment_service.features.assessment.dto.evaluation_ai.AiEvaluationTriggerRequest;
import vacademy.io.assessment_service.features.assessment.entity.AiEvaluationProcess;
import vacademy.io.assessment_service.features.assessment.entity.StudentAttempt;
import vacademy.io.assessment_service.features.assessment.enums.AiEvaluationStatusEnum;
import vacademy.io.assessment_service.features.assessment.repository.AiEvaluationProcessRepository;
import vacademy.io.assessment_service.features.assessment.repository.StudentAttemptRepository;
import vacademy.io.assessment_service.core.exception.VacademyException;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;

@Service
@Slf4j
@RequiredArgsConstructor
public class AiEvaluationService {

        private final AiEvaluationProcessRepository aiEvaluationProcessRepository;
        private final StudentAttemptRepository studentAttemptRepository;
        private final AiEvaluationAsyncService aiEvaluationAsyncService;
        private final AiEvaluationCancellationService cancellationService;

        @Transactional
        public List<String> triggerEvaluation(AiEvaluationTriggerRequest request) {
                log.info("Triggering AI evaluation for {} attempts with model: {}", request.getAttemptIds().size(),
                                request.getPreferredModel());

                List<String> processIds = new ArrayList<>();

                for (String attemptId : request.getAttemptIds()) {
                        try {
                                String processId = initiateEvaluationForAttempt(attemptId, request.getPreferredModel());
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

        private String initiateEvaluationForAttempt(String attemptId, String preferredModel) {
                StudentAttempt attempt = studentAttemptRepository.findById(attemptId)
                                .orElseThrow(() -> new VacademyException("Student Attempt not found: " + attemptId));

                AiEvaluationProcess process = new AiEvaluationProcess();
                // Remove manual ID setting - let @UuidGenerator handle it
                process.setStudentAttempt(attempt);
                // Get assessment from registration instead of assessmentSetMapping (which can
                // be null)
                process.setAssessment(attempt.getRegistration().getAssessment());
                process.setStatus(AiEvaluationStatusEnum.PENDING.name());
                process.setStartedAt(new Date());

                AiEvaluationProcess savedProcess = aiEvaluationProcessRepository.save(process);
                aiEvaluationProcessRepository.flush(); // Ensure the process is inserted before async call
                log.info("Created AI evaluation process with ID: {} for attempt: {}", savedProcess.getId(), attemptId);

                // Clear any stale cancellation flags from previous runs
                cancellationService.clearFlag(savedProcess.getId());

                // Trigger Async Evaluation via separate service
                aiEvaluationAsyncService.evaluateAttemptAsync(savedProcess.getId(), attemptId, preferredModel);

                return savedProcess.getId();
        }
}
