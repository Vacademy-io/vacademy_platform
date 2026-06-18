package vacademy.io.admin_core_service.features.ai_usage.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.ai_usage.dto.CreditUsageDtos.ChatMessageRow;
import vacademy.io.admin_core_service.features.ai_usage.dto.CreditUsageDtos.ConversationRow;
import vacademy.io.admin_core_service.features.ai_usage.repository.ConversationRepository;

import java.sql.Timestamp;
import java.util.Date;
import java.util.List;

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
