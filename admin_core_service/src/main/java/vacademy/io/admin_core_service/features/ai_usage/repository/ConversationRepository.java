package vacademy.io.admin_core_service.features.ai_usage.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;
import vacademy.io.admin_core_service.features.ai_usage.entity.AiTokenUsage;

import java.sql.Timestamp;
import java.util.List;
import java.util.UUID;

// (institute-wide export queries appended below the per-user readers)

/**
 * Read-only native reader over the Student-AI chat tables (chat_sessions /
 * chat_messages). These are OWNED and written by the Python ai_service, but it
 * runs on the SAME database admin_core uses (ADMIN_CORE_SERVICE_DB_URL — the
 * same place ai_service writes credit_transactions), so we can read them here.
 *
 * Strictly read-only: no JPA entity is mapped to these tables (so Hibernate
 * never tries to manage/alter them), and every query is institute-scoped so an
 * admin can only ever see conversations belonging to their own institute.
 */
public interface ConversationRepository extends Repository<AiTokenUsage, UUID> {

    /**
     * One row per chat session a learner had in the window, newest activity
     * first. Object[]{ id, context_type, context_title, session_mode, status,
     * created_at, last_active, message_count, preview }. Both institute_id AND
     * user_id are constrained so this can never leak another tenant's chats.
     */
    @Query(value = "SELECT cs.id, " +
            "       cs.context_type, " +
            "       COALESCE(cs.context_meta->>'title', cs.context_meta->>'slide_title', " +
            "                cs.context_meta->>'name', cs.context_meta->>'course_name', " +
            "                cs.context_meta->>'question') AS context_title, " +
            "       cs.session_mode, " +
            "       cs.status, " +
            "       cs.created_at, " +
            "       cs.last_active, " +
            "       (SELECT COUNT(*) FROM chat_messages cm WHERE cm.session_id = cs.id) AS message_count, " +
            "       (SELECT cm2.content FROM chat_messages cm2 " +
            "          WHERE cm2.session_id = cs.id AND cm2.message_type = 'user' " +
            "          ORDER BY cm2.id ASC LIMIT 1) AS preview " +
            "FROM chat_sessions cs " +
            "WHERE cs.institute_id = :instituteId " +
            "  AND cs.user_id = :userId " +
            "  AND cs.created_at >= :fromTs AND cs.created_at < :toTs " +
            "ORDER BY cs.last_active DESC",
            countQuery = "SELECT COUNT(*) FROM chat_sessions cs " +
                    "WHERE cs.institute_id = :instituteId " +
                    "  AND cs.user_id = :userId " +
                    "  AND cs.created_at >= :fromTs AND cs.created_at < :toTs",
            nativeQuery = true)
    Page<Object[]> findUserSessions(@Param("instituteId") String instituteId,
                                    @Param("userId") String userId,
                                    @Param("fromTs") Timestamp fromTs,
                                    @Param("toTs") Timestamp toTs,
                                    Pageable pageable);

    /**
     * Full transcript of one session in chronological order. The JOIN to
     * chat_sessions enforces the institute scope — an admin passing a sessionId
     * from another institute gets an empty list.
     * Object[]{ id, message_type, content, metadata, created_at }.
     */
    @Query(value = "SELECT cm.id, cm.message_type, cm.content, cm.metadata, cm.created_at " +
            "FROM chat_messages cm " +
            "JOIN chat_sessions cs ON cs.id = cm.session_id " +
            "WHERE cm.session_id = :sessionId " +
            "  AND cs.institute_id = :instituteId " +
            "ORDER BY cm.id ASC",
            nativeQuery = true)
    List<Object[]> findSessionMessages(@Param("sessionId") String sessionId,
                                       @Param("instituteId") String instituteId);

    // ── institute-wide flat readers for the Excel export (capped via Pageable) ──

    // All sessions in the window across the institute, grouped by user.
    // Object[]{ created_at, last_active, uid, session_id, context_type, context_title,
    //           session_mode, status, message_count, preview }.
    @Query(value = "SELECT cs.created_at, cs.last_active, cs.user_id AS uid, cs.id AS session_id, " +
            "       cs.context_type, " +
            "       COALESCE(cs.context_meta->>'title', cs.context_meta->>'slide_title', " +
            "                cs.context_meta->>'name', cs.context_meta->>'course_name', " +
            "                cs.context_meta->>'question') AS context_title, " +
            "       cs.session_mode, cs.status, " +
            "       (SELECT COUNT(*) FROM chat_messages cm WHERE cm.session_id = cs.id) AS message_count, " +
            "       (SELECT cm2.content FROM chat_messages cm2 " +
            "          WHERE cm2.session_id = cs.id AND cm2.message_type = 'user' " +
            "          ORDER BY cm2.id ASC LIMIT 1) AS preview " +
            "FROM chat_sessions cs " +
            "WHERE cs.institute_id = :instituteId " +
            "  AND cs.created_at >= :fromTs AND cs.created_at < :toTs " +
            "ORDER BY cs.user_id, cs.last_active DESC",
            nativeQuery = true)
    Page<Object[]> findAllSessions(@Param("instituteId") String instituteId,
                                   @Param("fromTs") Timestamp fromTs,
                                   @Param("toTs") Timestamp toTs,
                                   Pageable pageable);

    // All messages whose session started in the window, grouped by user/session, chronological.
    // Object[]{ created_at, uid, session_id, context_type, context_title, session_mode,
    //           message_type, content }.
    @Query(value = "SELECT cm.created_at, cs.user_id AS uid, cs.id AS session_id, cs.context_type, " +
            "       COALESCE(cs.context_meta->>'title', cs.context_meta->>'slide_title', " +
            "                cs.context_meta->>'name', cs.context_meta->>'course_name', " +
            "                cs.context_meta->>'question') AS context_title, " +
            "       cs.session_mode, cm.message_type, cm.content " +
            "FROM chat_messages cm " +
            "JOIN chat_sessions cs ON cs.id = cm.session_id " +
            "WHERE cs.institute_id = :instituteId " +
            "  AND cs.created_at >= :fromTs AND cs.created_at < :toTs " +
            "ORDER BY cs.user_id, cs.id, cm.id ASC",
            nativeQuery = true)
    Page<Object[]> findAllMessages(@Param("instituteId") String instituteId,
                                   @Param("fromTs") Timestamp fromTs,
                                   @Param("toTs") Timestamp toTs,
                                   Pageable pageable);
}
