package vacademy.io.admin_core_service.features.parent_portal.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.core.security.GuardedChild;
import vacademy.io.admin_core_service.core.security.GuardianAccessGuard;
import vacademy.io.admin_core_service.features.agent.dto.ChatbotAiRequest;
import vacademy.io.admin_core_service.features.agent.dto.ChatbotAiResponse;
import vacademy.io.admin_core_service.features.agent.service.ChatbotAiService;
import vacademy.io.admin_core_service.features.invoice.dto.InvoiceDTO;
import vacademy.io.admin_core_service.features.invoice.service.InvoiceService;
import vacademy.io.admin_core_service.features.learner_badge.service.LearnerBadgeService;
import vacademy.io.admin_core_service.features.live_session.dto.ScheduleDetailDTO;
import vacademy.io.admin_core_service.features.live_session.dto.StudentAttendanceReportDTO;
import vacademy.io.admin_core_service.features.live_session.service.AttendanceReportService;
import vacademy.io.admin_core_service.features.student_analysis.client.AssessmentServiceClient;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * The parent AI assistant. Answers a free-form parent question about their
 * <em>guarded</em> child.
 *
 * <p><b>Reuses the existing chatbot path.</b> The LLM call itself goes through the
 * shared {@link ChatbotAiService} (the same OpenRouter/{@code LLMService} the rest
 * of the app uses) — this service only adds the parent-specific, safety-critical
 * part: run the guardian guard, then assemble a plain-text snapshot of ONLY that
 * one child's data and pass it as the system prompt. The LLM is given NO tools, so
 * it can never reach any other student's data.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ParentAssistantService {

    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_LOCAL_DATE;

    private static final String SYSTEM_PROMPT = """
            You are a warm, concise school assistant helping a parent understand their child's school life.
            Answer ONLY using the data provided below about the child. If the data does not contain the
            answer, say you don't have that detail yet and suggest which section (Attendance, Tests, Fees,
            Rewards, Progress) to open. Never invent facts, numbers, or events. Refer to the child by their
            first name. Keep answers to 1-3 short, plain-language sentences with no jargon.
            """;

    private final GuardianAccessGuard guard;
    private final ParentPortalSettingService settingService;
    private final AttendanceReportService attendanceReportService;
    private final InvoiceService invoiceService;
    private final LearnerBadgeService learnerBadgeService;
    private final AssessmentServiceClient assessmentServiceClient;
    private final ChatbotAiService chatbotAiService;

    @Value("${parent.assistant.model:google/gemini-2.5-flash}")
    private String model;

    @Value("${openrouter.api.key:#{null}}")
    private String openRouterApiKey;

    /**
     * @return the assistant's answer, or {@code null} if the LLM is unavailable
     *         (no API key / upstream error) — the caller then falls back to the
     *         on-device preset answers.
     */
    public String answer(CustomUserDetails caller, String childUserId, String question) {
        GuardedChild child = guard.requireLinkedChild(caller, childUserId);
        settingService.requireEnabled(child.instituteId());

        // No key configured -> let the client use its on-device answers.
        if (!StringUtils.hasText(openRouterApiKey)) {
            return null;
        }

        String context = buildContext(child);
        ChatbotAiRequest request = ChatbotAiRequest.builder()
                .instituteId(child.instituteId())
                .modelId(model)
                .systemPrompt(SYSTEM_PROMPT + "\nToday's date: " + LocalDate.now().format(ISO) + "\n\nDATA:\n" + context)
                .userMessage(question)
                .maxTokens(500)
                .temperature(0.4)
                .build();

        try {
            ChatbotAiResponse response = chatbotAiService.respond(request);
            return response != null ? response.getAssistantMessage() : null;
        } catch (Exception e) {
            log.warn("[ParentAssistant] assistant unavailable, falling back: {}", e.getMessage());
            return null;
        }
    }

    /** Assemble a compact, plain-text snapshot of the guarded child's data for the prompt. */
    private String buildContext(GuardedChild child) {
        StringBuilder sb = new StringBuilder();
        sb.append("Child first name: ").append(firstName(child.fullName())).append('\n');

        String primaryBatch = child.packageSessionIds().isEmpty() ? null : child.packageSessionIds().get(0);

        // Attendance (a full year) — % plus the recent classes with present/absent,
        // so "did my child attend today?" is answerable against today's date.
        if (primaryBatch != null) {
            try {
                StudentAttendanceReportDTO att = attendanceReportService.getStudentReport(
                        child.childUserId(), primaryBatch, LocalDate.now().minusDays(365), LocalDate.now());
                if (att != null) {
                    sb.append("Attendance: ").append(Math.round(att.getAttendancePercentage())).append("% present.\n");
                    List<ScheduleDetailDTO> schedules = att.getSchedules();
                    if (schedules != null && !schedules.isEmpty()) {
                        sb.append("Recent classes (most recent first):\n");
                        schedules.stream()
                                .sorted((a, b) -> nullSafe(b.getMeetingDate()).compareTo(nullSafe(a.getMeetingDate())))
                                .limit(15)
                                .forEach(s -> sb.append("- ")
                                        .append(s.getMeetingDate() != null ? s.getMeetingDate() : "?")
                                        .append(": ").append(s.getAttendanceStatus() != null ? s.getAttendanceStatus() : "Not marked")
                                        .append(s.getSessionTitle() != null ? " (" + s.getSessionTitle() + ")" : "")
                                        .append('\n'));
                    }
                }
            } catch (Exception e) {
                log.debug("[ParentAssistant] attendance context unavailable: {}", e.getMessage());
            }
        }

        // Fees
        try {
            List<InvoiceDTO> invoices = invoiceService.getInvoicesByUserId(child.childUserId(), child.instituteId());
            long pending = invoices.stream().filter(this::isPending).count();
            sb.append("Fees: ").append(pending).append(" payment(s) pending of ")
                    .append(invoices.size()).append(" total.\n");
        } catch (Exception e) {
            log.debug("[ParentAssistant] fees context unavailable: {}", e.getMessage());
        }

        // Rewards
        try {
            int badges = learnerBadgeService.getActiveAwardsForUser(child.childUserId(), child.instituteId()).size();
            sb.append("Rewards: ").append(badges).append(" badge(s) earned.\n");
        } catch (Exception e) {
            log.debug("[ParentAssistant] rewards context unavailable: {}", e.getMessage());
        }

        // Tests — recent scores
        try {
            AssessmentServiceClient.AssessmentHistoryResponse hist = assessmentServiceClient
                    .fetchStudentAssessmentHistory(child.childUserId(), child.instituteId(),
                            LocalDate.now().minusMonths(6).format(ISO), LocalDate.now().format(ISO));
            if (hist != null && hist.getAssessments() != null && !hist.getAssessments().isEmpty()) {
                sb.append("Tests taken: ").append(hist.getAssessments().size()).append(". Recent:\n");
                hist.getAssessments().stream().limit(10).forEach(a -> {
                    sb.append("- ").append(a.getName() != null ? a.getName() : "Test");
                    if (a.getDate() != null) sb.append(" (").append(a.getDate()).append(")");
                    sb.append(": ");
                    if (a.getMarks() != null && a.getTotalMarks() != null) {
                        sb.append(fmt(a.getMarks())).append('/').append(fmt(a.getTotalMarks()));
                    }
                    if (a.getPercentage() != null) sb.append(" (").append(Math.round(a.getPercentage())).append("%)");
                    sb.append('\n');
                });
            } else {
                sb.append("Tests taken: none recorded yet.\n");
            }
        } catch (Exception e) {
            log.debug("[ParentAssistant] tests context unavailable: {}", e.getMessage());
        }

        return sb.toString();
    }

    private boolean isPending(InvoiceDTO inv) {
        String s = inv.getStatus();
        return s != null && !s.equalsIgnoreCase("PAID") && !s.equalsIgnoreCase("CANCELLED")
                && !s.equalsIgnoreCase("VOID");
    }

    private String firstName(String full) {
        if (full == null || full.isBlank()) return "the child";
        return full.trim().split("\\s+")[0];
    }

    private String fmt(Double d) {
        if (d == null) return "";
        return d == Math.floor(d) ? String.valueOf(d.longValue()) : String.valueOf(d);
    }

    private String nullSafe(java.time.LocalDate d) {
        return d != null ? d.toString() : "";
    }
}
