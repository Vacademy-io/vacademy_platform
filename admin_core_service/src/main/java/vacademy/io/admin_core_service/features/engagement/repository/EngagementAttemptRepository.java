package vacademy.io.admin_core_service.features.engagement.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.engagement.entity.EngagementAttempt;

import java.sql.Timestamp;
import java.util.List;
import java.util.Optional;

@Repository
public interface EngagementAttemptRepository extends JpaRepository<EngagementAttempt, String> {

    Optional<EngagementAttempt> findByItemIdAndUserId(String itemId, String userId);

    @Query("SELECT a FROM EngagementAttempt a WHERE a.userId = :userId AND a.itemId IN :itemIds")
    List<EngagementAttempt> findByUserAndItems(@Param("userId") String userId,
                                               @Param("itemIds") List<String> itemIds);

    /** All attempts on one item — used by the CSV export, which is not paged. */
    @Query("SELECT a FROM EngagementAttempt a WHERE a.itemId = :itemId ORDER BY a.createdAt DESC")
    List<EngagementAttempt> findByItem(@Param("itemId") String itemId);

    /** One page of attempts for the tracking table. */
    @Query("SELECT a FROM EngagementAttempt a WHERE a.itemId = :itemId ORDER BY a.createdAt DESC")
    Page<EngagementAttempt> findPageByItem(@Param("itemId") String itemId, Pageable pageable);

    /** Backs the "N people have attempted this" social-proof counter. */
    @Query("SELECT COUNT(a) FROM EngagementAttempt a WHERE a.itemId = :itemId AND a.status = 'COMPLETED'")
    long countCompletedForItem(@Param("itemId") String itemId);

    @Query("SELECT COUNT(a) FROM EngagementAttempt a WHERE a.itemId = :itemId " +
            "AND a.status = 'COMPLETED' AND a.isCorrect = true")
    long countCorrectForItem(@Param("itemId") String itemId);

    /** Rows: [itemId, completedCount] for a set of items, in one query. */
    @Query("SELECT a.itemId, COUNT(a) FROM EngagementAttempt a WHERE a.itemId IN :itemIds " +
            "AND a.status = 'COMPLETED' GROUP BY a.itemId")
    List<Object[]> countCompletedForItems(@Param("itemIds") List<String> itemIds);

    /** Completed attempts for a learner in an instant range — streak and history. */
    @Query("SELECT a FROM EngagementAttempt a WHERE a.userId = :userId AND a.instituteId = :instituteId " +
            "AND a.status = 'COMPLETED' AND a.completedAt >= :from AND a.completedAt < :to " +
            "ORDER BY a.completedAt DESC")
    List<EngagementAttempt> findCompletedBetween(@Param("userId") String userId,
                                                 @Param("instituteId") String instituteId,
                                                 @Param("from") Timestamp from,
                                                 @Param("to") Timestamp to);

    /**
     * Record that a learner opened an item, once. The server's own clock then measures
     * dwell and play time — the client's timeSpentMs is advisory and easy to forge.
     *
     * ON CONFLICT DO NOTHING because this runs inside the item read: a second open
     * (or a race with submit) must not fail the request or reset startedAt.
     */
    @Modifying
    @Query(value = "INSERT INTO engagement_attempt (id, item_id, item_version, user_id, institute_id, " +
            "package_session_id, status, started_at, created_at, updated_at) " +
            "VALUES (:id, :itemId, :itemVersion, :userId, :instituteId, :packageSessionId, 'STARTED', " +
            "CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) " +
            "ON CONFLICT (item_id, user_id) DO NOTHING", nativeQuery = true)
    int insertStartedIfAbsent(@Param("id") String id,
                              @Param("itemId") String itemId,
                              @Param("itemVersion") int itemVersion,
                              @Param("userId") String userId,
                              @Param("instituteId") String instituteId,
                              @Param("packageSessionId") String packageSessionId);
}
