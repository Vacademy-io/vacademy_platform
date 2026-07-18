package vacademy.io.admin_core_service.features.parent_portal.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.core.security.GuardedChild;
import vacademy.io.admin_core_service.core.security.GuardianAccessGuard;
import vacademy.io.admin_core_service.features.certificate.dto.IssuedCertificateDTO;
import vacademy.io.admin_core_service.features.certificate.service.CertificateReadService;
import vacademy.io.admin_core_service.features.invoice.dto.InvoiceDTO;
import vacademy.io.admin_core_service.features.invoice.service.InvoiceService;
import vacademy.io.admin_core_service.features.learner_badge.dto.LearnerBadgeDTO;
import vacademy.io.admin_core_service.features.learner_badge.service.LearnerBadgeService;
import vacademy.io.admin_core_service.features.live_session.dto.GroupedSessionsByDateDTO;
import vacademy.io.admin_core_service.features.live_session.dto.LearnerPastSessionsResponseDTO;
import vacademy.io.admin_core_service.features.live_session.dto.StudentAttendanceReportDTO;
import vacademy.io.admin_core_service.features.live_session.service.AttendanceReportService;
import vacademy.io.admin_core_service.features.live_session.service.GetLiveSessionService;
import vacademy.io.admin_core_service.features.live_session.service.LearnerPastSessionService;
import vacademy.io.admin_core_service.features.learner_reports.dto.LearnerSubjectWiseProgressReportDTO;
import vacademy.io.admin_core_service.features.learner_reports.service.LearnerReportService;
import vacademy.io.admin_core_service.features.parent_portal.dto.ChildReportListItemDTO;
import vacademy.io.admin_core_service.features.student_analysis.client.AssessmentServiceClient;
import vacademy.io.admin_core_service.features.student_analysis.entity.StudentAnalysisProcess;
import vacademy.io.admin_core_service.features.student_analysis.repository.StudentAnalysisProcessRepository;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.ForbiddenException;
import org.springframework.data.domain.PageRequest;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * Per-domain reads for one guarded child. Every method: (1) runs the guardian
 * guard on the token-derived caller + the child id, (2) enforces the institute's
 * per-module setting, then (3) delegates to the existing domain service in-process
 * with the child's id. The guard is the only place that decides access.
 *
 * <p>The underlying services accept an explicit userId (they're the same ones that
 * are IDOR-able when called directly); here they are only ever reached AFTER the
 * guard has proven the link, so the child id fed to them is always authorised.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ParentPortalDetailService {

    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_LOCAL_DATE;

    private final GuardianAccessGuard guard;
    private final ParentPortalSettingService settingService;
    private final AttendanceReportService attendanceReportService;
    private final InvoiceService invoiceService;
    private final LearnerBadgeService learnerBadgeService;
    private final CertificateReadService certificateReadService;
    private final GetLiveSessionService getLiveSessionService;
    private final LearnerPastSessionService learnerPastSessionService;
    private final LearnerReportService learnerReportService;
    private final AssessmentServiceClient assessmentServiceClient;
    private final StudentAnalysisProcessRepository processRepository;

    public StudentAttendanceReportDTO attendance(CustomUserDetails caller, String childUserId,
                                                 String packageSessionId, LocalDate start, LocalDate end) {
        GuardedChild child = guard.requireLinkedChild(caller, childUserId);
        settingService.requireModule(child.instituteId(), "attendance");
        String batchId = resolvePackageSession(child, packageSessionId);
        LocalDate from = start != null ? start : LocalDate.now().minusDays(30);
        LocalDate to = end != null ? end : LocalDate.now();
        return attendanceReportService.getStudentReport(child.childUserId(), batchId, from, to);
    }

    public List<InvoiceDTO> invoices(CustomUserDetails caller, String childUserId) {
        GuardedChild child = guard.requireLinkedChild(caller, childUserId);
        settingService.requireModule(child.instituteId(), "payments");
        return invoiceService.getInvoicesByUserId(child.childUserId(), child.instituteId());
    }

    public List<LearnerBadgeDTO> badges(CustomUserDetails caller, String childUserId) {
        GuardedChild child = guard.requireLinkedChild(caller, childUserId);
        settingService.requireModule(child.instituteId(), "badges");
        return learnerBadgeService.getActiveAwardsForUser(child.childUserId(), child.instituteId());
    }

    public List<IssuedCertificateDTO> certificates(CustomUserDetails caller, String childUserId) {
        GuardedChild child = guard.requireLinkedChild(caller, childUserId);
        settingService.requireModule(child.instituteId(), "certificates");
        return certificateReadService.listForUser(child.childUserId(), child.instituteId());
    }

    public List<GroupedSessionsByDateDTO> upcomingLiveSessions(CustomUserDetails caller, String childUserId,
                                                              String packageSessionId) {
        GuardedChild child = guard.requireLinkedChild(caller, childUserId);
        settingService.requireModule(child.instituteId(), "liveSessions");
        String batchId = resolvePackageSession(child, packageSessionId);
        return getLiveSessionService.getLiveAndUpcomingSessionsForUserAndBatch(
                batchId, child.childUserId(), 0, null, null, null, caller);
    }

    public LearnerPastSessionsResponseDTO pastLiveSessions(CustomUserDetails caller, String childUserId,
                                                           String packageSessionId, int page, Integer size) {
        GuardedChild child = guard.requireLinkedChild(caller, childUserId);
        settingService.requireModule(child.instituteId(), "liveSessions");
        String batchId = resolvePackageSession(child, packageSessionId);
        return learnerPastSessionService.getPastSessions(
                batchId, child.childUserId(), child.instituteId(), page, size, null, null);
    }

    public List<LearnerSubjectWiseProgressReportDTO> subjectProgress(CustomUserDetails caller, String childUserId,
                                                                     String packageSessionId) {
        GuardedChild child = guard.requireLinkedChild(caller, childUserId);
        settingService.requireModule(child.instituteId(), "progress");
        String batchId = resolvePackageSession(child, packageSessionId);
        return learnerReportService.getSubjectProgressReport(batchId, child.childUserId(), caller);
    }

    /**
     * Live assessment history for the child (marks/scores). Returns null on a
     * cross-service failure — the caller maps that to "unavailable", NEVER to an
     * empty list ("your child sat no exams" is a wrong answer, not a missing one).
     */
    public AssessmentServiceClient.AssessmentHistoryResponse assessments(CustomUserDetails caller, String childUserId,
                                                                         LocalDate start, LocalDate end) {
        GuardedChild child = guard.requireLinkedChild(caller, childUserId);
        settingService.requireModule(child.instituteId(), "assessments");
        LocalDate from = start != null ? start : LocalDate.now().minusMonths(6);
        LocalDate to = end != null ? end : LocalDate.now();
        return assessmentServiceClient.fetchStudentAssessmentHistory(
                child.childUserId(), child.instituteId(), from.format(ISO), to.format(ISO));
    }

    /**
     * Staff-generated AI reports for the child (metadata list only). Parents can't
     * generate; empty = none generated yet, and the frontend shows live scores anyway.
     */
    public List<ChildReportListItemDTO> reports(CustomUserDetails caller, String childUserId, int page, int size) {
        GuardedChild child = guard.requireLinkedChild(caller, childUserId);
        settingService.requireModule(child.instituteId(), "reports");
        return processRepository
                .findByUserIdAndStatusOrderByCreatedAtDesc(child.childUserId(), "COMPLETED", PageRequest.of(page, size))
                .stream()
                .map(this::toReportItem)
                .toList();
    }

    private ChildReportListItemDTO toReportItem(StudentAnalysisProcess p) {
        return ChildReportListItemDTO.builder()
                .processId(p.getId())
                .name(p.getName())
                .status(p.getStatus())
                .createdAt(p.getCreatedAt())
                .build();
    }

    /**
     * Sub-resource ownership: a supplied packageSessionId must be one of the child's
     * own enrolments (else the guard would prove parent&rarr;child but not batch&rarr;child).
     * Absent = the child's primary (first) enrolment.
     */
    private String resolvePackageSession(GuardedChild child, String packageSessionId) {
        if (!StringUtils.hasText(packageSessionId)) {
            return child.packageSessionIds().get(0);
        }
        if (!child.packageSessionIds().contains(packageSessionId)) {
            throw new ForbiddenException("Batch does not belong to this child");
        }
        return packageSessionId;
    }
}
