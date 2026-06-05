package vacademy.io.admin_core_service.features.ai_usage.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.repository.Repository;
import vacademy.io.admin_core_service.features.ai_usage.entity.AiTokenUsage;

import java.sql.Timestamp;
import java.util.List;
import java.util.UUID;

/**
 * Native-query reader over the credit ledger (credit_transactions, which lives in
 * this admin_core DB) joined to the institute user directory (users/user_role/roles)
 * for the per-user AI-credit-usage views. Anchored to AiTokenUsage purely so Spring
 * can instantiate it — every method is a native query against credit_transactions.
 *
 * Credits are net of refunds: USAGE_DEDUCTION counts positive, REFUND negative.
 * Attribution uses COALESCE(subject_user_id, user_id) so work done ON a learner
 * (actor = teacher) is credited to the learner.
 */
public interface CreditUsageRepository extends Repository<AiTokenUsage, UUID> {

    String AGG = """
        SELECT COALESCE(ct.subject_user_id, ct.user_id) AS uid,
               SUM(CASE WHEN ct.transaction_type = 'USAGE_DEDUCTION' THEN ABS(ct.amount)
                        WHEN ct.transaction_type = 'REFUND' THEN -ABS(ct.amount)
                        ELSE 0 END) AS net_credits,
               COUNT(*) FILTER (WHERE ct.transaction_type = 'USAGE_DEDUCTION') AS req_count
        FROM credit_transactions ct
        WHERE ct.institute_id = :instituteId
          AND COALESCE(ct.subject_user_id, ct.user_id) IS NOT NULL
          AND ct.created_at >= :fromTs AND ct.created_at < :toTs
        GROUP BY COALESCE(ct.subject_user_id, ct.user_id)
        """;

    // Paginated per-user list. Returns Object[]{uid, name, email, roles, net_credits, req_count}.
    @Query(value = "SELECT agg.uid, u.full_name, u.email, " +
            " (SELECT string_agg(DISTINCT r.role_name, ',') FROM user_role ur JOIN roles r ON r.id = ur.role_id " +
            "    WHERE ur.user_id = u.id AND ur.institute_id = :instituteId AND ur.status IN ('ACTIVE','INVITED')) AS roles, " +
            " agg.net_credits, agg.req_count " +
            "FROM ( " + AGG + " ) agg " +
            "JOIN users u ON CAST(u.id AS text) = agg.uid " +
            "WHERE (CAST(:role AS text) IS NULL OR EXISTS ( " +
            "   SELECT 1 FROM user_role ur2 JOIN roles r2 ON r2.id = ur2.role_id " +
            "    WHERE ur2.user_id = u.id AND ur2.institute_id = :instituteId " +
            "      AND ur2.status IN ('ACTIVE','INVITED') AND r2.role_name = :role)) " +
            "ORDER BY agg.net_credits DESC",
            countQuery = "SELECT COUNT(*) FROM ( " + AGG + " ) agg " +
                    "JOIN users u ON CAST(u.id AS text) = agg.uid " +
                    "WHERE (CAST(:role AS text) IS NULL OR EXISTS ( " +
                    "   SELECT 1 FROM user_role ur2 JOIN roles r2 ON r2.id = ur2.role_id " +
                    "    WHERE ur2.user_id = u.id AND ur2.institute_id = :instituteId " +
                    "      AND ur2.status IN ('ACTIVE','INVITED') AND r2.role_name = :role))",
            nativeQuery = true)
    Page<Object[]> findUserUsage(@Param("instituteId") String instituteId,
                                 @Param("fromTs") Timestamp fromTs,
                                 @Param("toTs") Timestamp toTs,
                                 @Param("role") String role,
                                 Pageable pageable);

    // Per-role rollup for the sub-tabs. Object[]{role_name, user_count, total_credits}.
    @Query(value = "SELECT r.role_name, COUNT(DISTINCT agg.uid), COALESCE(SUM(agg.net_credits), 0) " +
            "FROM ( " + AGG + " ) agg " +
            "JOIN users u ON CAST(u.id AS text) = agg.uid " +
            "JOIN user_role ur ON ur.user_id = u.id AND ur.institute_id = :instituteId AND ur.status IN ('ACTIVE','INVITED') " +
            "JOIN roles r ON r.id = ur.role_id " +
            "GROUP BY r.role_name ORDER BY 3 DESC",
            nativeQuery = true)
    List<Object[]> roleSummary(@Param("instituteId") String instituteId,
                               @Param("fromTs") Timestamp fromTs,
                               @Param("toTs") Timestamp toTs);

    // Paginated per-user deduction log. Object[]{id, created_at, request_type, model_name, amount, description}.
    @Query(value = "SELECT ct.id, ct.created_at, ct.request_type, ct.model_name, ABS(ct.amount), ct.description " +
            "FROM credit_transactions ct " +
            "WHERE ct.institute_id = :instituteId " +
            "  AND COALESCE(ct.subject_user_id, ct.user_id) = :userId " +
            "  AND ct.transaction_type = 'USAGE_DEDUCTION' " +
            "  AND ct.created_at >= :fromTs AND ct.created_at < :toTs " +
            "ORDER BY ct.created_at DESC",
            countQuery = "SELECT COUNT(*) FROM credit_transactions ct " +
                    "WHERE ct.institute_id = :instituteId " +
                    "  AND COALESCE(ct.subject_user_id, ct.user_id) = :userId " +
                    "  AND ct.transaction_type = 'USAGE_DEDUCTION' " +
                    "  AND ct.created_at >= :fromTs AND ct.created_at < :toTs",
            nativeQuery = true)
    Page<Object[]> findUserLogs(@Param("instituteId") String instituteId,
                                @Param("userId") String userId,
                                @Param("fromTs") Timestamp fromTs,
                                @Param("toTs") Timestamp toTs,
                                Pageable pageable);
}
