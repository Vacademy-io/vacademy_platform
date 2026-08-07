package vacademy.io.admin_core_service.features.live_session.repository;

public interface LiveSessionLogsRepositoryCustom {

    /**
     * Attendance upsert that also reports what the row looked like before it ran.
     *
     * <p>The plain {@code @Modifying} upsert this replaces could not tell a first
     * mark apart from the fortieth: the learner waiting room re-marks on a 30s
     * poll, so callers had no way to avoid re-firing the "attendance marked"
     * notification on every tick. The write itself is byte-for-byte the same
     * INSERT ... ON CONFLICT DO UPDATE as before — it is only wrapped in a CTE
     * that captures the pre-existing status in the same round trip, so the
     * stampede-safety and single-statement properties are preserved.
     *
     * @return the status stored before this call, or {@code null} when this call
     *         created the row. Callers notify only when this differs from the
     *         status they just wrote.
     */
    String upsertAttendanceReturningPreviousStatus(
            String id,
            String sessionId,
            String scheduleId,
            String userSourceType,
            String userSourceId,
            String status,
            String statusType,
            String details);
}
