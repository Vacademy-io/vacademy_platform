package vacademy.io.assessment_service.features.assessment.service.evaluation_ai;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import vacademy.io.assessment_service.features.assessment.copy_intake.repository.AiCopyIntakeItemRepository;
import vacademy.io.assessment_service.features.assessment.entity.AiEvaluationProcess;
import vacademy.io.assessment_service.features.assessment.entity.Assessment;
import vacademy.io.assessment_service.features.assessment.entity.AssessmentInstituteMapping;
import vacademy.io.assessment_service.features.assessment.entity.StudentAttempt;
import vacademy.io.assessment_service.features.assessment.enums.AiEvaluationStatusEnum;
import vacademy.io.assessment_service.features.assessment.repository.AiEvaluationProcessRepository;
import vacademy.io.assessment_service.features.assessment.repository.AssessmentInstituteMappingRepository;
import vacademy.io.assessment_service.features.assessment.service.AssessmentWorkflowEventPublisher;
import vacademy.io.assessment_service.features.auth_service.service.AuthService;
import vacademy.io.assessment_service.features.notification.dto.NotificationDTO;
import vacademy.io.assessment_service.features.notification.dto.NotificationToUserDTO;
import vacademy.io.assessment_service.features.notification.service.NotificationService;
import vacademy.io.assessment_service.features.notification.service.StaffNoticeEmails;
import vacademy.io.common.auth.dto.UserWithRolesDTO;

/**
 * Tells the staff when the AI has finished checking copies — bell alert, email
 * and the ASSESSMENT_AI_EVALUATION_COMPLETED automation event — so the marks
 * do not sit unseen: a manual-result test shows nothing to learners until a
 * teacher reviews and presses Release Result.
 *
 * The bulk upload announces its own batch (CopyIntakeNotifier); this covers the
 * checks that used to finish in silence: the automatic check on every learner
 * upload, and "Evaluate with AI" pressed on one row.
 *
 * One notice per assessment, not one per copy. Uploads arrive in waves (a class
 * submits within the same hour), so a settled check waits a short settling
 * window — and while other checks for the same test are still running — and is
 * then announced together with everything that settled meanwhile: "12 copies
 * checked, 1 could not be. Review, then release." A cap stops a long-running
 * straggler from holding the notice back for ever.
 *
 * Replica-safe: the settled jobs of an assessment are claimed with one UPDATE
 * guarded by notified_at IS NULL; a second pod updates zero rows and stays quiet.
 */
@Component
@Slf4j
@RequiredArgsConstructor
public class AiEvaluationCompletionNotifier {

    static final List<String> TERMINAL = List.of(
            AiEvaluationStatusEnum.COMPLETED.name(), AiEvaluationStatusEnum.FAILED.name());
    static final List<String> ACTIVE = List.of(
            AiEvaluationStatusEnum.PENDING.name(), AiEvaluationStatusEnum.STARTED.name(),
            AiEvaluationStatusEnum.PROCESSING.name(), AiEvaluationStatusEnum.EXTRACTING.name(),
            AiEvaluationStatusEnum.EVALUATING.name());
    /** Who is told when nobody in particular asked for the check. */
    static final List<String> DEFAULT_STAFF_ROLES = List.of("ADMIN");

    private final AiEvaluationProcessRepository processRepository;
    private final AiCopyIntakeItemRepository intakeItemRepository;
    private final AssessmentInstituteMappingRepository instituteMappingRepository;
    private final AuthService authService;
    private final NotificationService notificationService;
    private final AssessmentWorkflowEventPublisher workflowEventPublisher;

    @Value("${assessment.ai-evaluation.notice-settle-minutes:2}")
    private long settleMinutes;

    @Value("${assessment.ai-evaluation.notice-max-wait-minutes:30}")
    private long maxWaitMinutes;

    @Value("${assessment.copy-intake.dashboard-base-url:https://dash.vacademy.io}")
    private String dashboardBaseUrl;

    @Scheduled(fixedDelayString = "${assessment.ai-evaluation.notice-interval-ms:60000}",
            initialDelayString = "${assessment.ai-evaluation.notice-initial-delay-ms:90000}")
    @Transactional
    public void announceSettledChecks() {
        List<AiEvaluationProcess> settled = processRepository.findUnnotifiedSettled(TERMINAL);
        if (settled.isEmpty()) {
            return;
        }
        Date now = new Date();
        Date settleCutoff = Date.from(Instant.now().minus(settleMinutes, ChronoUnit.MINUTES));
        Date maxWaitCutoff = Date.from(Instant.now().minus(maxWaitMinutes, ChronoUnit.MINUTES));

        // Bulk-intake copies are announced by their batch; just mark them so they
        // never surface here again.
        List<String> bulkIds = new ArrayList<>();
        Map<String, List<AiEvaluationProcess>> byAssessment = new LinkedHashMap<>();
        for (AiEvaluationProcess process : settled) {
            if (intakeItemRepository.findFirstByProcessId(process.getId()).isPresent()) {
                bulkIds.add(process.getId());
                continue;
            }
            String assessmentId = process.getAssessment() != null ? process.getAssessment().getId() : null;
            if (assessmentId == null) {
                bulkIds.add(process.getId()); // nothing to announce against
                continue;
            }
            byAssessment.computeIfAbsent(assessmentId, k -> new ArrayList<>()).add(process);
        }
        if (!bulkIds.isEmpty()) {
            processRepository.claimForNotice(bulkIds, now);
        }

        for (Map.Entry<String, List<AiEvaluationProcess>> entry : byAssessment.entrySet()) {
            List<AiEvaluationProcess> group = entry.getValue();
            Date oldest = group.stream().map(this::settledAt).min(Date::compareTo).orElse(now);
            Date newest = group.stream().map(this::settledAt).max(Date::compareTo).orElse(now);
            boolean waitedLongEnough = oldest.before(maxWaitCutoff);
            boolean settledDown = newest.before(settleCutoff)
                    && processRepository.countActiveForAssessment(entry.getKey(), ACTIVE) == 0;
            if (!settledDown && !waitedLongEnough) {
                continue; // more copies are still coming; one notice later beats ten now
            }
            List<String> ids = group.stream().map(AiEvaluationProcess::getId).toList();
            int claimed = processRepository.claimForNotice(ids, now);
            if (claimed == 0) {
                continue; // another replica announced these
            }
            try {
                announce(group);
            } catch (Exception e) {
                // Claimed already, so this notice is lost rather than repeated — the
                // marks are still on the dashboard; a duplicate email would be worse.
                log.warn("[ai-notice] announcing checks for assessment {} failed: {}", entry.getKey(), e.getMessage());
            }
        }
    }

    private Date settledAt(AiEvaluationProcess p) {
        if (p.getCompletedAt() != null) return p.getCompletedAt();
        if (p.getUpdatedAt() != null) return p.getUpdatedAt();
        return p.getStartedAt() != null ? p.getStartedAt() : new Date(0);
    }

    /** One notice for everything that settled for this assessment. */
    void announce(List<AiEvaluationProcess> group) {
        AiEvaluationProcess first = group.get(0);
        Assessment assessment = first.getAssessment();
        String instituteId = instituteIdOf(first);
        if (assessment == null || instituteId == null) {
            return;
        }
        long checked = group.stream().filter(p -> AiEvaluationStatusEnum.COMPLETED.name().equals(p.getStatus())).count();
        long failed = group.size() - checked;
        Set<String> triggeredBy = new LinkedHashSet<>();
        group.forEach(p -> {
            if (StringUtils.hasText(p.getTriggeredBy())) triggeredBy.add(p.getTriggeredBy());
        });

        String name = assessment.getName() != null ? assessment.getName() : assessment.getId();
        String title = failed > 0
                ? "AI check finished for " + name + " - " + failed + (failed == 1 ? " copy needs" : " copies need") + " your attention"
                : "AI check finished for " + name;
        String summary = checked + (checked == 1 ? " copy" : " copies") + " checked by AI"
                + (failed > 0 ? ", " + failed + " could not be checked" : "")
                + ". Review the marks, then press Release Result - learners see nothing until you do.";
        String link = submissionsLink(assessment);

        List<Recipient> recipients = recipients(instituteId, assessment.getId(), triggeredBy);
        List<String> userIds = recipients.stream().map(Recipient::id).filter(StringUtils::hasText).toList();

        // 1. Bell.
        if (!userIds.isEmpty()) {
            try {
                notificationService.sendSystemAlertToUsers(instituteId, userIds, title, summary);
            } catch (Exception e) {
                log.warn("[ai-notice] system alert failed for assessment {}: {}", assessment.getId(), e.getMessage());
            }
        }
        // 2. Email.
        List<NotificationToUserDTO> mailTo = recipients.stream()
                .filter(u -> StringUtils.hasText(u.email()) && u.email().contains("@"))
                .map(u -> NotificationToUserDTO.builder()
                        .userId(u.id()).channelId(u.email())
                        .placeholders(Map.of("user_name", u.name() != null ? u.name() : ""))
                        .build())
                .toList();
        if (!mailTo.isEmpty()) {
            try {
                notificationService.sendEmailToUsersReporting(NotificationDTO.builder()
                        .subject(title)
                        .body(emailBody(name, checked, failed, link))
                        .notificationType("EMAIL")
                        .source("AI_COPY_CHECK")
                        .sourceId(assessment.getId())
                        .users(mailTo)
                        .build(), instituteId);
            } catch (Exception e) {
                log.warn("[ai-notice] email failed for assessment {}: {}", assessment.getId(), e.getMessage());
            }
        }
        // 3. Automations — same event the bulk batch fires, so one workflow serves both.
        Map<String, Object> payload = new HashMap<>();
        payload.put("totalCopies", group.size());
        payload.put("checkedCopies", checked);
        payload.put("failedCopies", failed);
        payload.put("skippedCopies", 0);
        payload.put("copiesNeedingReview", failed);
        payload.put("batchStatus", failed > 0 ? "NEEDS_REVIEW" : "COMPLETED");
        payload.put("mode", triggeredBy.isEmpty() ? "AUTO_ON_SUBMIT" : "TEACHER_TRIGGERED");
        payload.put("submissionsLink", link);
        try {
            workflowEventPublisher.publishAiEvaluationBatchCompleted(assessment, instituteId, null, payload);
        } catch (Exception e) {
            log.warn("[ai-notice] workflow event failed for assessment {}: {}", assessment.getId(), e.getMessage());
        }
        log.info("[ai-notice] assessment={} checked={} failed={} recipients={} mode={}",
                assessment.getId(), checked, failed, userIds.size(), payload.get("mode"));
    }

    /**
     * Who hears about it: the teacher(s) who pressed the button, the users named on
     * the test's creation/evaluation access, and the institute's admins. Deduped,
     * in that order.
     */
    /** Someone to tell: id for the bell, email (when known) for the mail. */
    record Recipient(String id, String email, String name) {}

    List<Recipient> recipients(String instituteId, String assessmentId, Set<String> triggeredBy) {
        Map<String, Recipient> byId = new LinkedHashMap<>();
        List<UserWithRolesDTO> admins = new ArrayList<>();
        try {
            List<UserWithRolesDTO> found = authService.getUsersByRoles(DEFAULT_STAFF_ROLES, instituteId);
            if (found != null) admins.addAll(found);
        } catch (Exception e) {
            log.warn("[ai-notice] could not list admins of institute {}: {}", instituteId, e.getMessage());
        }
        Set<String> named = new LinkedHashSet<>(triggeredBy);
        instituteMappingRepository.findByAssessmentIdAndInstituteId(assessmentId, instituteId)
                .ifPresent(m -> {
                    named.addAll(split(m.getCommaSeparatedEvaluationUserIds()));
                    named.addAll(split(m.getCommaSeparatedCreationUserIds()));
                });
        // Named users we know only by id: use the admin list to fill in email/name,
        // else an id-only recipient (the bell still works; email needs an address).
        for (String userId : named) {
            UserWithRolesDTO match = admins.stream()
                    .filter(a -> a != null && userId.equals(a.getId())).findFirst().orElse(null);
            byId.putIfAbsent(userId, match != null
                    ? new Recipient(match.getId(), match.getEmail(), match.getFullName())
                    : new Recipient(userId, null, null));
        }
        for (UserWithRolesDTO admin : admins) {
            if (admin != null && StringUtils.hasText(admin.getId())) {
                byId.putIfAbsent(admin.getId(), new Recipient(admin.getId(), admin.getEmail(), admin.getFullName()));
            }
        }
        return new ArrayList<>(byId.values());
    }

    private static List<String> split(String csv) {
        List<String> out = new ArrayList<>();
        if (!StringUtils.hasText(csv)) return out;
        for (String part : csv.split(",")) {
            if (StringUtils.hasText(part)) out.add(part.trim());
        }
        return out;
    }

    private static String instituteIdOf(AiEvaluationProcess p) {
        StudentAttempt attempt = p.getStudentAttempt();
        if (attempt != null && attempt.getRegistration() != null && StringUtils.hasText(attempt.getRegistration().getInstituteId())) {
            return attempt.getRegistration().getInstituteId();
        }
        return null;
    }

    private String submissionsLink(Assessment assessment) {
        String playMode = StringUtils.hasText(assessment.getPlayMode()) ? assessment.getPlayMode() : "EXAM";
        String visibility = StringUtils.hasText(assessment.getAssessmentVisibility()) ? assessment.getAssessmentVisibility() : "PRIVATE";
        return dashboardBaseUrl + "/assessment/assessment-list/assessment-details/" + assessment.getId()
                + "/" + playMode + "/" + visibility + "/submissions";
    }

    static String emailBody(String assessmentName, long checked, long failed, String link) {
        java.util.Map<String, Long> counts = StaffNoticeEmails.counts();
        counts.put("Copies checked", checked + failed);
        counts.put("Checked by AI", checked);
        counts.put("Could not be checked", failed);
        String note = failed > 0
                ? failed + (failed == 1 ? " copy" : " copies") + " could not be checked by the AI and need a teacher."
                : null;
        return StaffNoticeEmails.aiCheckFinished(null, assessmentName, counts, note, link);
    }

    private static String esc(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }
}
