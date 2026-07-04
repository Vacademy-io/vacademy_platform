package vacademy.io.assessment_service.features.assessment.manager;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.assessment_service.features.assessment.dto.internal.RegisterAssessmentBatchesRequest;
import vacademy.io.assessment_service.features.assessment.entity.Assessment;
import vacademy.io.assessment_service.features.assessment.entity.AssessmentBatchRegistration;
import vacademy.io.assessment_service.features.assessment.entity.AssessmentInstituteMapping;
import vacademy.io.assessment_service.features.assessment.repository.AssessmentBatchRegistrationRepository;
import vacademy.io.assessment_service.features.assessment.repository.AssessmentInstituteMappingRepository;
import vacademy.io.assessment_service.features.assessment.repository.AssessmentRepository;
import vacademy.io.common.auth.enums.CompanyStatus;

import java.util.ArrayList;
import java.util.Date;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Registers EXISTING assessments to additional batches (package_sessions).
 *
 * <p>Invoked by the internal endpoint that admin_core_service calls when a
 * chapter containing an assessment slide is copied / made visible to new
 * batches. The institute is resolved from the assessment's
 * {@link AssessmentInstituteMapping} so the caller doesn't have to supply it.
 *
 * <p>Idempotent: the {@code (assessment_id, batch_id, institute_id)} unique
 * constraint is honoured by checking existence before insert, so re-running a
 * copy never creates duplicates. Unknown assessments / batches are skipped with
 * a WARN rather than failing the whole request — a single bad id must not block
 * the other registrations.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class InternalAssessmentBatchRegistrationManager {

    private final AssessmentRepository assessmentRepository;
    private final AssessmentInstituteMappingRepository assessmentInstituteMappingRepository;
    private final AssessmentBatchRegistrationRepository assessmentBatchRegistrationRepository;

    @Transactional
    public void registerBatches(RegisterAssessmentBatchesRequest request) {
        if (request == null || request.getRegistrations() == null) {
            return;
        }
        for (RegisterAssessmentBatchesRequest.AssessmentBatchEntry entry : request.getRegistrations()) {
            try {
                registerSingleAssessment(entry);
            } catch (Exception e) {
                log.warn("[InternalAssessmentBatchRegistration] Failed to register batches for assessment {}: {}",
                        entry == null ? null : entry.getAssessmentId(), e.getMessage());
            }
        }
    }

    private void registerSingleAssessment(RegisterAssessmentBatchesRequest.AssessmentBatchEntry entry) {
        if (entry == null || entry.getAssessmentId() == null || entry.getAssessmentId().isBlank()
                || entry.getBatchIds() == null || entry.getBatchIds().isEmpty()) {
            return;
        }
        String assessmentId = entry.getAssessmentId();

        Assessment assessment = assessmentRepository.findById(assessmentId).orElse(null);
        if (assessment == null) {
            log.warn("[InternalAssessmentBatchRegistration] Assessment {} not found — skipping", assessmentId);
            return;
        }

        AssessmentInstituteMapping mapping = assessmentInstituteMappingRepository
                .findTopByAssessmentId(assessmentId).orElse(null);
        if (mapping == null || mapping.getInstituteId() == null) {
            log.warn("[InternalAssessmentBatchRegistration] No institute mapping for assessment {} — skipping",
                    assessmentId);
            return;
        }
        String instituteId = mapping.getInstituteId();

        List<AssessmentBatchRegistration> toSave = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        for (String batchId : entry.getBatchIds()) {
            if (batchId == null || batchId.isBlank() || !seen.add(batchId)) {
                continue;
            }
            if (assessmentBatchRegistrationRepository
                    .existsByInstituteIdAndAssessmentIdAndBatchId(instituteId, assessmentId, batchId)) {
                continue; // already registered — honour the unique constraint
            }
            AssessmentBatchRegistration registration = new AssessmentBatchRegistration();
            registration.setAssessment(assessment);
            registration.setBatchId(batchId);
            registration.setInstituteId(instituteId);
            registration.setStatus(CompanyStatus.ACTIVE.name());
            registration.setRegistrationTime(new Date());
            toSave.add(registration);
        }

        if (!toSave.isEmpty()) {
            assessmentBatchRegistrationRepository.saveAll(toSave);
            log.info("[InternalAssessmentBatchRegistration] Registered {} new batch(es) to assessment {} (institute {})",
                    toSave.size(), assessmentId, instituteId);
        }
    }
}
