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

    // ── Chatbot Analysis (LMS -> Student AI) ──────────────────────────────────
    // Institute-wide session list with the learner resolved, for the admin's
    // "recent chats" table. Optional filters are applied inline with the
    // `CAST(:p AS text) IS NULL OR ...` idiom because a native query cannot
    // infer the type of a null bind parameter on its own.
    //
    // The learner name/email comes from a LATERAL (not a plain JOIN): a learner
    // can hold several `student` rows (one per enrolment), and a plain join
    // would duplicate the session row once per enrolment.
    //
    // Object[]{ session_id, user_id, full_name, email, context_type, context_title,
    //           session_mode, status, created_at, last_active, message_count,
    //           student_message_count, last_student_message, quiz_count }.
    @Query(value = "SELECT cs.id, cs.user_id, st.full_name, st.email, cs.context_type, " +
            "       COALESCE(cs.context_meta->>'title', cs.context_meta->>'slide_title', " +
            "                cs.context_meta->>'name', cs.context_meta->>'course_name', " +
            "                cs.context_meta->>'question') AS context_title, " +
            "       cs.session_mode, cs.status, cs.created_at, cs.last_active, " +
            "       (SELECT COUNT(*) FROM chat_messages cm WHERE cm.session_id = cs.id) AS message_count, " +
            "       (SELECT COUNT(*) FROM chat_messages cm WHERE cm.session_id = cs.id " +
            "          AND cm.message_type = 'user') AS student_message_count, " +
            "       (SELECT cm2.content FROM chat_messages cm2 " +
            "          WHERE cm2.session_id = cs.id AND cm2.message_type = 'user' " +
            "          ORDER BY cm2.id DESC LIMIT 1) AS last_student_message, " +
            "       (SELECT COUNT(*) FROM chat_messages cm WHERE cm.session_id = cs.id " +
            "          AND cm.message_type = 'quiz_feedback') AS quiz_count " +
            "FROM chat_sessions cs " +
            "LEFT JOIN LATERAL (SELECT s.full_name, s.email FROM student s " +
            "                    WHERE s.user_id = cs.user_id LIMIT 1) st ON TRUE " +
            "WHERE cs.institute_id = :instituteId " +
            "  AND cs.created_at >= :fromTs AND cs.created_at < :toTs " +
            "  AND (CAST(:status AS text) IS NULL OR cs.status = CAST(:status AS text)) " +
            "  AND (CAST(:sessionMode AS text) IS NULL OR cs.session_mode = CAST(:sessionMode AS text)) " +
            "  AND (CAST(:search AS text) IS NULL " +
            "       OR st.full_name ILIKE CONCAT('%', CAST(:search AS text), '%') " +
            "       OR st.email ILIKE CONCAT('%', CAST(:search AS text), '%') " +
            "       OR cs.user_id = CAST(:search AS text)) " +
            "  AND (:onlyWithMessages = FALSE " +
            "       OR EXISTS (SELECT 1 FROM chat_messages cm WHERE cm.session_id = cs.id)) " +
            "ORDER BY cs.last_active DESC",
            countQuery = "SELECT COUNT(*) FROM chat_sessions cs " +
                    "LEFT JOIN LATERAL (SELECT s.full_name, s.email FROM student s " +
                    "                    WHERE s.user_id = cs.user_id LIMIT 1) st ON TRUE " +
                    "WHERE cs.institute_id = :instituteId " +
                    "  AND cs.created_at >= :fromTs AND cs.created_at < :toTs " +
                    "  AND (CAST(:status AS text) IS NULL OR cs.status = CAST(:status AS text)) " +
                    "  AND (CAST(:sessionMode AS text) IS NULL OR cs.session_mode = CAST(:sessionMode AS text)) " +
                    "  AND (CAST(:search AS text) IS NULL " +
                    "       OR st.full_name ILIKE CONCAT('%', CAST(:search AS text), '%') " +
                    "       OR st.email ILIKE CONCAT('%', CAST(:search AS text), '%') " +
                    "       OR cs.user_id = CAST(:search AS text)) " +
                    "  AND (:onlyWithMessages = FALSE " +
                    "       OR EXISTS (SELECT 1 FROM chat_messages cm WHERE cm.session_id = cs.id))",
            nativeQuery = true)
    Page<Object[]> findInstituteSessions(@Param("instituteId") String instituteId,
                                        @Param("fromTs") Timestamp fromTs,
                                        @Param("toTs") Timestamp toTs,
                                        @Param("status") String status,
                                        @Param("sessionMode") String sessionMode,
                                        @Param("search") String search,
                                        @Param("onlyWithMessages") boolean onlyWithMessages,
                                        Pageable pageable);

    // Headline session counters for the window.
    // Object[]{ sessions, active_sessions, unique_students }.
    @Query(value = "SELECT COUNT(*), " +
            "       COUNT(*) FILTER (WHERE cs.status = 'ACTIVE'), " +
            "       COUNT(DISTINCT cs.user_id) " +
            "FROM chat_sessions cs " +
            "WHERE cs.institute_id = :instituteId " +
            "  AND cs.created_at >= :fromTs AND cs.created_at < :toTs",
            nativeQuery = true)
    List<Object[]> sessionTotals(@Param("instituteId") String instituteId,
                                 @Param("fromTs") Timestamp fromTs,
                                 @Param("toTs") Timestamp toTs);

    // All-time counters, so the summary can show reach beyond the window.
    // Object[]{ sessions, unique_students }.
    @Query(value = "SELECT COUNT(*), COUNT(DISTINCT cs.user_id) FROM chat_sessions cs " +
            "WHERE cs.institute_id = :instituteId",
            nativeQuery = true)
    List<Object[]> sessionTotalsAllTime(@Param("instituteId") String instituteId);

    // Message volume split by type. Object[]{ message_type, count }.
    @Query(value = "SELECT cm.message_type, COUNT(*) " +
            "FROM chat_messages cm " +
            "JOIN chat_sessions cs ON cs.id = cm.session_id " +
            "WHERE cs.institute_id = :instituteId " +
            "  AND cm.created_at >= :fromTs AND cm.created_at < :toTs " +
            "GROUP BY cm.message_type",
            nativeQuery = true)
    List<Object[]> messageCountsByType(@Param("instituteId") String instituteId,
                                      @Param("fromTs") Timestamp fromTs,
                                      @Param("toTs") Timestamp toTs);

    // Session counts grouped by an enum column. Object[]{ value, count }.
    @Query(value = "SELECT cs.session_mode, COUNT(*) FROM chat_sessions cs " +
            "WHERE cs.institute_id = :instituteId " +
            "  AND cs.created_at >= :fromTs AND cs.created_at < :toTs " +
            "GROUP BY cs.session_mode ORDER BY 2 DESC",
            nativeQuery = true)
    List<Object[]> sessionsByMode(@Param("instituteId") String instituteId,
                                 @Param("fromTs") Timestamp fromTs,
                                 @Param("toTs") Timestamp toTs);

    @Query(value = "SELECT cs.context_type, COUNT(*) FROM chat_sessions cs " +
            "WHERE cs.institute_id = :instituteId " +
            "  AND cs.created_at >= :fromTs AND cs.created_at < :toTs " +
            "GROUP BY cs.context_type ORDER BY 2 DESC",
            nativeQuery = true)
    List<Object[]> sessionsByContext(@Param("instituteId") String instituteId,
                                    @Param("fromTs") Timestamp fromTs,
                                    @Param("toTs") Timestamp toTs);

    // Doubt / quiz events the tutor recorded. learning_analytics is written by
    // ai_service into this same database.
    // Object[]{ doubts, quizzes, avg_quiz_pct }.
    @Query(value = "SELECT COUNT(*) FILTER (WHERE la.event_type = 'doubt'), " +
            "       COUNT(*) FILTER (WHERE la.event_type = 'quiz_score'), " +
            "       AVG(la.score / NULLIF(la.total, 0) * 100) FILTER (WHERE la.event_type = 'quiz_score') " +
            "FROM learning_analytics la " +
            "WHERE la.institute_id = :instituteId " +
            "  AND la.created_at >= :fromTs AND la.created_at < :toTs",
            nativeQuery = true)
    List<Object[]> analyticsTotals(@Param("instituteId") String instituteId,
                                   @Param("fromTs") Timestamp fromTs,
                                   @Param("toTs") Timestamp toTs);

    // What students actually asked about. Object[]{ topic, event_type, count }.
    @Query(value = "SELECT la.topic, la.event_type, COUNT(*) AS c " +
            "FROM learning_analytics la " +
            "WHERE la.institute_id = :instituteId " +
            "  AND la.created_at >= :fromTs AND la.created_at < :toTs " +
            "  AND la.topic IS NOT NULL AND la.topic <> '' " +
            "GROUP BY la.topic, la.event_type " +
            "ORDER BY c DESC LIMIT 12",
            nativeQuery = true)
    List<Object[]> topTopics(@Param("instituteId") String instituteId,
                             @Param("fromTs") Timestamp fromTs,
                             @Param("toTs") Timestamp toTs);

    // Daily trend. Object[]{ day (yyyy-MM-dd), sessions, student_messages }.
    @Query(value = "SELECT to_char(gs.day_ts, 'YYYY-MM-DD') AS day, " +
            "       COALESCE(s.sessions, 0), " +
            "       COALESCE(m.msgs, 0) " +
            "FROM generate_series(CAST(:fromTs AS timestamp), CAST(:toTs AS timestamp), " +
            "                     INTERVAL '1 day') AS gs(day_ts) " +
            "LEFT JOIN (SELECT to_char(date_trunc('day', cs.created_at), 'YYYY-MM-DD') AS day, " +
            "                  COUNT(*) AS sessions " +
            "             FROM chat_sessions cs " +
            "             WHERE cs.institute_id = :instituteId " +
            "               AND cs.created_at >= :fromTs AND cs.created_at < :toTs " +
            "             GROUP BY 1) s ON s.day = to_char(gs.day_ts, 'YYYY-MM-DD') " +
            "LEFT JOIN (SELECT to_char(date_trunc('day', cm.created_at), 'YYYY-MM-DD') AS day, " +
            "                  COUNT(*) AS msgs " +
            "             FROM chat_messages cm " +
            "             JOIN chat_sessions cs2 ON cs2.id = cm.session_id " +
            "             WHERE cs2.institute_id = :instituteId " +
            "               AND cm.created_at >= :fromTs AND cm.created_at < :toTs " +
            "               AND cm.message_type = 'user' " +
            "             GROUP BY 1) m ON m.day = to_char(gs.day_ts, 'YYYY-MM-DD') " +
            "ORDER BY gs.day_ts",
            nativeQuery = true)
    List<Object[]> dailyActivity(@Param("instituteId") String instituteId,
                                @Param("fromTs") Timestamp fromTs,
                                @Param("toTs") Timestamp toTs);

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
