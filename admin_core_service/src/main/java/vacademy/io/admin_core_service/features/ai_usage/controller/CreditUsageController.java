package vacademy.io.admin_core_service.features.ai_usage.controller;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.ai_usage.dto.CreditUsageDtos.ChatMessageRow;
import vacademy.io.admin_core_service.features.ai_usage.dto.CreditUsageDtos.ConversationRow;
import vacademy.io.admin_core_service.features.ai_usage.dto.CreditUsageDtos.FlatLogRow;
import vacademy.io.admin_core_service.features.ai_usage.dto.CreditUsageDtos.FlatMessageRow;
import vacademy.io.admin_core_service.features.ai_usage.dto.CreditUsageDtos.FlatSessionRow;
import vacademy.io.admin_core_service.features.ai_usage.dto.CreditUsageDtos.RoleSummaryRow;
import vacademy.io.admin_core_service.features.ai_usage.dto.CreditUsageDtos.UsageLogRow;
import vacademy.io.admin_core_service.features.ai_usage.dto.CreditUsageDtos.UserUsageRow;
import vacademy.io.admin_core_service.features.ai_usage.service.ConversationService;
import vacademy.io.admin_core_service.features.ai_usage.service.CreditUsageService;
import vacademy.io.common.exceptions.VacademyException;

import java.sql.Timestamp;
import java.util.List;

/**
 * Per-user AI credit usage analytics for an institute (academy-credits).
 * Institute is scoped from the clientId header (same posture as the audit-log
 * controller); the dashboard surfaces this only to admins.
 *
 *   GET /ai-usage/v1/users                          paginated per-user list (role + name + date filter)
 *   GET /ai-usage/v1/summary                        per-role rollup for the sub-tabs
 *   GET /ai-usage/v1/logs                           flat institute-wide deduction log (Excel export)
 *   GET /ai-usage/v1/conversations/all              flat institute-wide chat sessions (Excel export)
 *   GET /ai-usage/v1/messages                       flat institute-wide chat messages (Excel export)
 *   GET /ai-usage/v1/users/{userId}/logs            one user's paginated deduction log
 *   GET /ai-usage/v1/users/{userId}/conversations   one learner's Student-AI chat sessions
 *   GET /ai-usage/v1/conversations/{id}/messages    full transcript (prompts + AI answers)
 *
 * Dates are epoch millis; default window is the last 30 days.
 */
@RestController
@RequestMapping("/admin-core-service/ai-usage/v1")
public class CreditUsageController {

    private static final long THIRTY_DAYS_MS = 30L * 24 * 60 * 60 * 1000;
    /** Hard ceiling on rows pulled for the flat-log export, to keep it bounded. */
    private static final int EXPORT_LOG_CAP = 50_000;

    @Autowired
    private CreditUsageService service;

    @Autowired
    private ConversationService conversationService;

    @GetMapping("/users")
    public ResponseEntity<Page<UserUsageRow>> listUsers(
            HttpServletRequest request,
            @RequestParam(required = false) String role,
            @RequestParam(required = false) String name,
            @RequestParam(required = false) Long startDate,
            @RequestParam(required = false) Long endDate,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        String instituteId = requireInstituteId(request);
        Timestamp from = from(startDate);
        Timestamp to = to(endDate);
        String roleFilter = (role == null || role.isBlank()) ? null : role;
        Pageable pageable = PageRequest.of(page, size);
        return ResponseEntity.ok(service.listUsers(instituteId, from, to, roleFilter, name, pageable));
    }

    @GetMapping("/summary")
    public ResponseEntity<List<RoleSummaryRow>> summary(
            HttpServletRequest request,
            @RequestParam(required = false) Long startDate,
            @RequestParam(required = false) Long endDate) {
        String instituteId = requireInstituteId(request);
        return ResponseEntity.ok(service.roleSummary(instituteId, from(startDate), to(endDate)));
    }

    /** Flat activity log for the whole institute (role + name + date filtered) — for the Excel export. */
    @GetMapping("/logs")
    public ResponseEntity<List<FlatLogRow>> allLogs(
            HttpServletRequest request,
            @RequestParam(required = false) String role,
            @RequestParam(required = false) String name,
            @RequestParam(required = false) Long startDate,
            @RequestParam(required = false) Long endDate) {
        String instituteId = requireInstituteId(request);
        String roleFilter = (role == null || role.isBlank()) ? null : role;
        return ResponseEntity.ok(
                service.allLogs(instituteId, from(startDate), to(endDate), roleFilter, name, EXPORT_LOG_CAP));
    }

    /** Flat list of Student-AI chat sessions for the institute — for the Excel export's "Chat Sessions" sheet. */
    @GetMapping("/conversations/all")
    public ResponseEntity<List<FlatSessionRow>> allConversations(
            HttpServletRequest request,
            @RequestParam(required = false) String role,
            @RequestParam(required = false) String name,
            @RequestParam(required = false) Long startDate,
            @RequestParam(required = false) Long endDate) {
        String instituteId = requireInstituteId(request);
        String roleFilter = (role == null || role.isBlank()) ? null : role;
        return ResponseEntity.ok(
                service.allSessions(instituteId, from(startDate), to(endDate), roleFilter, name, EXPORT_LOG_CAP));
    }

    /** Flat list of chat messages (prompts + AI answers) for the institute — for the "Chat Messages" sheet. */
    @GetMapping("/messages")
    public ResponseEntity<List<FlatMessageRow>> allMessages(
            HttpServletRequest request,
            @RequestParam(required = false) String role,
            @RequestParam(required = false) String name,
            @RequestParam(required = false) Long startDate,
            @RequestParam(required = false) Long endDate) {
        String instituteId = requireInstituteId(request);
        String roleFilter = (role == null || role.isBlank()) ? null : role;
        return ResponseEntity.ok(
                service.allMessages(instituteId, from(startDate), to(endDate), roleFilter, name, EXPORT_LOG_CAP));
    }

    @GetMapping("/users/{userId}/logs")
    public ResponseEntity<Page<UsageLogRow>> userLogs(
            HttpServletRequest request,
            @PathVariable String userId,
            @RequestParam(required = false) Long startDate,
            @RequestParam(required = false) Long endDate,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        String instituteId = requireInstituteId(request);
        Pageable pageable = PageRequest.of(page, size);
        return ResponseEntity.ok(service.userLogs(instituteId, userId, from(startDate), to(endDate), pageable));
    }

    /** Student-AI chat sessions the learner had in the window (newest first). */
    @GetMapping("/users/{userId}/conversations")
    public ResponseEntity<Page<ConversationRow>> userConversations(
            HttpServletRequest request,
            @PathVariable String userId,
            @RequestParam(required = false) Long startDate,
            @RequestParam(required = false) Long endDate,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        String instituteId = requireInstituteId(request);
        Pageable pageable = PageRequest.of(page, size);
        return ResponseEntity.ok(
                conversationService.userConversations(instituteId, userId, from(startDate), to(endDate), pageable));
    }

    /** Full transcript (prompts + AI answers) of one session, institute-scoped. */
    @GetMapping("/conversations/{sessionId}/messages")
    public ResponseEntity<List<ChatMessageRow>> conversationMessages(
            HttpServletRequest request,
            @PathVariable String sessionId) {
        String instituteId = requireInstituteId(request);
        return ResponseEntity.ok(conversationService.sessionMessages(sessionId, instituteId));
    }

    private Timestamp from(Long startDate) {
        return new Timestamp(startDate != null ? startDate : System.currentTimeMillis() - THIRTY_DAYS_MS);
    }

    private Timestamp to(Long endDate) {
        return new Timestamp(endDate != null ? endDate : System.currentTimeMillis());
    }

    private String requireInstituteId(HttpServletRequest request) {
        String instituteId = request.getHeader("clientId");
        if (instituteId == null || instituteId.isBlank()) {
            throw new VacademyException("Missing clientId header");
        }
        return instituteId;
    }
}
