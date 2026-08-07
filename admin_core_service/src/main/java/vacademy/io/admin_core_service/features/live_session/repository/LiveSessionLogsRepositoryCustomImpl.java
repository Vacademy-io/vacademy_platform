package vacademy.io.admin_core_service.features.live_session.repository;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.Query;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Repository
public class LiveSessionLogsRepositoryCustomImpl implements LiveSessionLogsRepositoryCustom {

    /**
     * {@code prev} is evaluated against the pre-statement snapshot, so it still
     * sees the old row even though {@code ups} overwrites it in the same
     * statement. The INSERT body, conflict target and SET list are unchanged
     * from the previous upsert — {@code updated_at} still refreshes on every
     * mark, {@code details} still falls back to the stored value — so nothing
     * about the persisted attendance row changes; the statement just also hands
     * back the status it replaced.
     */
    private static final String UPSERT_ATTENDANCE_SQL = """
            WITH prev AS (
                SELECT status
                FROM live_session_logs
                WHERE schedule_id = :scheduleId
                  AND user_source_id = :userSourceId
                  AND log_type = 'ATTENDANCE_RECORDED'
                LIMIT 1
            ),
            ups AS (
                INSERT INTO live_session_logs
                    (id, session_id, schedule_id, user_source_type, user_source_id,
                     log_type, status, status_type, details, updated_at)
                VALUES (:id, :sessionId, :scheduleId, :userSourceType, :userSourceId,
                        'ATTENDANCE_RECORDED', :status, :statusType, :details, now())
                ON CONFLICT (schedule_id, user_source_id) WHERE log_type = 'ATTENDANCE_RECORDED'
                DO UPDATE SET status      = EXCLUDED.status,
                              status_type = EXCLUDED.status_type,
                              details     = COALESCE(EXCLUDED.details, live_session_logs.details),
                              updated_at  = now()
                RETURNING id
            )
            SELECT (SELECT status FROM prev) AS previous_status
            FROM ups
            """;

    @PersistenceContext
    private EntityManager entityManager;

    @Override
    @Transactional
    public String upsertAttendanceReturningPreviousStatus(
            String id,
            String sessionId,
            String scheduleId,
            String userSourceType,
            String userSourceId,
            String status,
            String statusType,
            String details) {

        Query query = entityManager.createNativeQuery(UPSERT_ATTENDANCE_SQL)
                .setParameter("id", id)
                .setParameter("sessionId", sessionId)
                .setParameter("scheduleId", scheduleId)
                .setParameter("userSourceType", userSourceType)
                .setParameter("userSourceId", userSourceId)
                .setParameter("status", status)
                .setParameter("statusType", statusType)
                .setParameter("details", details);

        List<?> rows = query.getResultList();
        if (rows.isEmpty() || rows.get(0) == null) {
            // No prior row: this call created it.
            return null;
        }
        return String.valueOf(rows.get(0));
    }
}
