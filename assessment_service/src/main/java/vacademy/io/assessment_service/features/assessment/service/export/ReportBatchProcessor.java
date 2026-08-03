package vacademy.io.assessment_service.features.assessment.service.export;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.response.StudentReportOverallDetailDto;
import vacademy.io.assessment_service.features.assessment.dto.export.RenderPacket;
import vacademy.io.assessment_service.features.assessment.entity.StudentAttempt;
import vacademy.io.assessment_service.features.assessment.manager.AssessmentParticipantsManager;
import vacademy.io.assessment_service.features.assessment.repository.StudentAttemptRepository;
import vacademy.io.assessment_service.features.learner_assessment.dto.ReportClassContext;
import vacademy.io.assessment_service.features.learner_assessment.dto.StudentComparisonDto;
import vacademy.io.assessment_service.features.learner_assessment.service.LearnerReportService;

import java.util.Set;

/**
 * The only transactional read boundary in the bulk-export worker path. Must
 * be a separate bean from {@code ReportZipExportService} — {@code @Transactional}
 * does not apply to self-invocation, so if this logic lived as a private
 * method on the worker the annotation would be inert (ARCHITECTURE.md §8.2,
 * self-invocation trap #2).
 *
 * <p>Injects {@link AssessmentParticipantsManager} and {@link LearnerReportService}
 * plainly (not {@code @Lazy}) — this is a leaf consumer of the report stack
 * (Rule R2/R4), so there is no return edge and no cycle to break.
 */
@Slf4j
@Service
public class ReportBatchProcessor {

    private static final Set<String> SUBMITTED_STATUSES = Set.of("LIVE", "ENDED");

    @Autowired
    private StudentAttemptRepository studentAttemptRepository;

    @Autowired
    private AssessmentParticipantsManager assessmentParticipantsManager;

    @Autowired
    private LearnerReportService learnerReportService;

    @Transactional(readOnly = true, timeout = 15)
    public RenderPacket loadRenderPacket(String attemptId, ReportClassContext ctx) {
        StudentAttempt attempt = studentAttemptRepository.findByIdWithRegistration(attemptId).orElse(null);
        if (attempt == null) {
            return RenderPacket.builder().attemptId(attemptId).skipReason("Attempt not found").build();
        }

        String status = attempt.getStatus();
        if (status == null || !SUBMITTED_STATUSES.contains(status)) {
            return RenderPacket.builder()
                    .attemptId(attemptId)
                    .skipReason("Attempt not submitted (status=" + status + ")")
                    .build();
        }

        String userId = attempt.getRegistration() != null ? attempt.getRegistration().getUserId() : null;
        String studentName = attempt.getRegistration() != null ? attempt.getRegistration().getParticipantName() : null;
        String studentEmail = attempt.getRegistration() != null ? attempt.getRegistration().getUserEmail() : null;

        StudentReportOverallDetailDto detail = assessmentParticipantsManager
                .createStudentReportDetailResponse(ctx, attemptId, ctx.getInstituteId());
        StudentComparisonDto comparison = learnerReportService.buildComparisonFromContext(ctx, attemptId, userId);

        // Copy every field explicitly. If any of these ends up holding an
        // entity, projection proxy, or Hibernate collection instead of a
        // scalar/DTO, this design is broken — it will surface as a
        // LazyInitializationException a few lines later, outside this
        // transaction, on a different thread call stack (ARCHITECTURE.md §8.3).
        return RenderPacket.builder()
                .attemptId(attempt.getId())
                .userId(userId)
                .studentName(studentName)
                .studentEmail(studentEmail)
                .attemptUpdatedAt(attempt.getUpdatedAt())
                .existingReportPdfFileId(attempt.getReportPdfFileId())
                .detail(detail)
                .comparison(comparison)
                .build();
    }
}
