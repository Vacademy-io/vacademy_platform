package vacademy.io.admin_core_service.features.live_session.provider.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.live_session.provider.entity.BbbServerPool;

import java.util.List;
import java.util.Optional;

@Repository
public interface BbbServerPoolRepository extends JpaRepository<BbbServerPool, String> {

    Optional<BbbServerPool> findBySlug(String slug);

    // ── Routing queries ─────────────────────────────────────────────

    /**
     * Find available servers: RUNNING, enabled, with capacity.
     * Ordered by priority ASC (fill lower-priority-number servers first).
     */
    @Query("SELECT s FROM BbbServerPool s " +
           "WHERE s.status = 'RUNNING' AND s.enabled = true " +
           "AND s.activeMeetings < s.maxMeetings " +
           "ORDER BY s.priority ASC")
    List<BbbServerPool> findAvailableOrderByPriority();

    // ── Pool management queries ─────────────────────────────────────

    /** All enabled servers, ordered by priority (for start/stop scheduling). */
    List<BbbServerPool> findByEnabledTrueOrderByPriorityAsc();

    /** All running servers (for health checks, stop operations). */
    List<BbbServerPool> findByStatusAndEnabledTrue(String status);

    // ── Active meeting count management ─────────────────────────────

    @Modifying
    @Query("UPDATE BbbServerPool s SET s.activeMeetings = s.activeMeetings + 1, " +
           "s.updatedAt = CURRENT_TIMESTAMP WHERE s.id = :serverId")
    void incrementActiveMeetings(@Param("serverId") String serverId);

    @Modifying
    @Query("UPDATE BbbServerPool s SET s.activeMeetings = CASE " +
           "WHEN s.activeMeetings > 0 THEN s.activeMeetings - 1 ELSE 0 END, " +
           "s.updatedAt = CURRENT_TIMESTAMP WHERE s.id = :serverId")
    void decrementActiveMeetings(@Param("serverId") String serverId);

    /** Reset active meetings to 0 (used when server stops). */
    @Modifying
    @Query("UPDATE BbbServerPool s SET s.activeMeetings = 0, " +
           "s.status = :status, s.updatedAt = CURRENT_TIMESTAMP WHERE s.id = :serverId")
    void resetAndSetStatus(@Param("serverId") String serverId, @Param("status") String status);
}
