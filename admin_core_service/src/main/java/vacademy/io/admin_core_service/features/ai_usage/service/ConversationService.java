package vacademy.io.admin_core_service.features.ai_usage.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.ai_usage.dto.CreditUsageDtos.ChatMessageRow;
import vacademy.io.admin_core_service.features.ai_usage.dto.CreditUsageDtos.ChatbotSessionRow;
import vacademy.io.admin_core_service.features.ai_usage.dto.CreditUsageDtos.ChatbotSummary;
import vacademy.io.admin_core_service.features.ai_usage.dto.CreditUsageDtos.ConversationRow;
import vacademy.io.admin_core_service.features.ai_usage.dto.CreditUsageDtos.CountByValue;
import vacademy.io.admin_core_service.features.ai_usage.dto.CreditUsageDtos.DailyActivityRow;
import vacademy.io.admin_core_service.features.ai_usage.dto.CreditUsageDtos.TopicCount;
import vacademy.io.admin_core_service.features.ai_usage.repository.ConversationRepository;

import java.sql.Timestamp;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Read side of the learner Student-AI conversation drill-down. Maps the native
 * chat_sessions / chat_messages rows into transcript DTOs for the admin usage
 * dashboard. All access is institute-scoped at the repository layer.
 */
@Service
public class ConversationService {

    /** Keep the session-list preview short; the full text is loaded per session. */
    private static final int PREVIEW_MAX = 160;

    @Autowired
    private ConversationRepository repository;

    public Page<ConversationRow> userConversations(String instituteId, String userId,
                                                   Timestamp from, Timestamp to, Pageable pageable) {
        return repository.findUserSessions(instituteId, userId, from, to, pageable).map(this::toConversationRow);
    }

    public List<ChatMessageRow> sessionMessages(String sessionId, String instituteId) {
        return repository.findSessionMessages(sessionId, instituteId).stream()
                .map(this::toMessageRow)
                .toList();
    }

    // ── Chatbot Analysis (LMS -> Student AI) ─────────────────────────────────

    /** Institute-wide recent chats, newest activity first. */
    public Page<ChatbotSessionRow> instituteSessions(String instituteId, Timestamp from, Timestamp to,
                                                     String status, String sessionMode, String search,
                                                     boolean onlyWithMessages, Pageable pageable) {
        return repository
                .findInstituteSessions(instituteId, from, to, blankToNull(status), blankToNull(sessionMode),
                        blankToNull(search), onlyWithMessages, pageable)
                .map(this::toChatbotSessionRow);
    }

    /** Aggregate data points for the summary cards. */
    public ChatbotSummary summary(String instituteId, Timestamp from, Timestamp to) {
        Object[] totals = firstRow(repository.sessionTotals(instituteId, from, to));
        Object[] allTime = firstRow(repository.sessionTotalsAllTime(instituteId));
        Object[] analytics = firstRow(repository.analyticsTotals(instituteId, from, to));

        Map<String, Long> byType = new HashMap<>();
        for (Object[] r : repository.messageCountsByType(instituteId, from, to)) {
            byType.put(str(r[0]), lng(r[1]));
        }
        long totalMessages = byType.values().stream().mapToLong(Long::longValue).sum();
        long sessions = totals == null ? 0L : lng(totals[0]);

        Double avgQuizPct = null;
        if (analytics != null && analytics[2] instanceof Number n) {
            avgQuizPct = round1(n.doubleValue());
        }

        return ChatbotSummary.builder()
                .sessions(sessions)
                .activeSessions(totals == null ? 0L : lng(totals[1]))
                .uniqueStudents(totals == null ? 0L : lng(totals[2]))
                .sessionsAllTime(allTime == null ? 0L : lng(allTime[0]))
                .uniqueStudentsAllTime(allTime == null ? 0L : lng(allTime[1]))
                .totalMessages(totalMessages)
                .studentMessages(byType.getOrDefault("user", 0L))
                .aiMessages(byType.getOrDefault("assistant", 0L))
                .quizzesGenerated(byType.getOrDefault("quiz", 0L))
                .quizzesSubmitted(byType.getOrDefault("quiz_feedback", 0L))
                .toolCalls(byType.getOrDefault("tool_call", 0L))
                .avgMessagesPerSession(sessions == 0 ? 0d : round1((double) totalMessages / sessions))
                .doubtsAsked(analytics == null ? 0L : lng(analytics[0]))
                .quizzesTaken(analytics == null ? 0L : lng(analytics[1]))
                .avgQuizScorePct(avgQuizPct)
                .modeBreakdown(countList(repository.sessionsByMode(instituteId, from, to), "text"))
                .contextBreakdown(countList(repository.sessionsByContext(instituteId, from, to), "general"))
                .topTopics(repository.topTopics(instituteId, from, to).stream()
                        .map(r -> TopicCount.builder()
                                .topic(str(r[0]))
                                .eventType(str(r[1]))
                                .count(lng(r[2]))
                                .build())
                        .toList())
                .dailyActivity(repository.dailyActivity(instituteId, from, to).stream()
                        .map(r -> DailyActivityRow.builder()
                                .date(str(r[0]))
                                .sessions(lng(r[1]))
                                .studentMessages(lng(r[2]))
                                .build())
                        .toList())
                .build();
    }

    private ChatbotSessionRow toChatbotSessionRow(Object[] r) {
        String name = str(r[2]);
        String email = str(r[3]);
        return ChatbotSessionRow.builder()
                .sessionId(str(r[0]))
                .userId(str(r[1]))
                // Learners enrolled without a name still need a readable label.
                .studentName(name != null && !name.isBlank() ? name : fallbackName(email))
                .studentEmail(email)
                .contextType(str(r[4]))
                .contextTitle(str(r[5]))
                .sessionMode(str(r[6]))
                .status(str(r[7]))
                .createdAt(millis(r[8]))
                .lastActive(millis(r[9]))
                .messageCount(lng(r[10]))
                .studentMessageCount(lng(r[11]))
                .lastStudentMessage(preview(str(r[12])))
                .quizCount(lng(r[13]))
                .build();
    }

    private static List<CountByValue> countList(List<Object[]> rows, String nullLabel) {
        return rows.stream()
                .map(r -> CountByValue.builder()
                        .value(r[0] == null ? nullLabel : str(r[0]))
                        .count(lng(r[1]))
                        .build())
                .toList();
    }

    private static Object[] firstRow(List<Object[]> rows) {
        return (rows == null || rows.isEmpty()) ? null : rows.get(0);
    }

    private static String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }

    private static String fallbackName(String email) {
        if (email == null || email.isBlank()) return "Unknown";
        int at = email.indexOf('@');
        return at > 0 ? email.substring(0, at) : email;
    }

    private static double round1(double v) {
        return Math.round(v * 10d) / 10d;
    }

    private ConversationRow toConversationRow(Object[] r) {
        return ConversationRow.builder()
                .sessionId(str(r[0]))
                .contextType(str(r[1]))
                .contextTitle(str(r[2]))
                .sessionMode(str(r[3]))
                .status(str(r[4]))
                .createdAt(millis(r[5]))
                .lastActive(millis(r[6]))
                .messageCount(lng(r[7]))
                .preview(preview(str(r[8])))
                .build();
    }

    private ChatMessageRow toMessageRow(Object[] r) {
        return ChatMessageRow.builder()
                .id(str(r[0]))
                .type(str(r[1]))
                .content(str(r[2]))
                .metadata(str(r[3]))
                .createdAt(millis(r[4]))
                .build();
    }

    // ── helpers (native query returns JDBC types) ──
    private static String preview(String content) {
        if (content == null) return null;
        String flat = content.replaceAll("\\s+", " ").trim();
        return flat.length() <= PREVIEW_MAX ? flat : flat.substring(0, PREVIEW_MAX) + "…";
    }

    private static String str(Object o) {
        return o == null ? null : o.toString();
    }

    private static long lng(Object o) {
        if (o == null) return 0L;
        if (o instanceof Number n) return n.longValue();
        try {
            return Long.parseLong(o.toString());
        } catch (NumberFormatException e) {
            return 0L;
        }
    }

    private static Long millis(Object o) {
        if (o instanceof Timestamp ts) return ts.getTime();
        if (o instanceof Date d) return d.getTime();
        return null;
    }
}
