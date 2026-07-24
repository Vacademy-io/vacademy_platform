package vacademy.io.admin_core_service.features.user_account.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.user_account.entity.UserAccountLedger;

import java.math.BigDecimal;

@Repository
public interface UserAccountLedgerRepository extends JpaRepository<UserAccountLedger, String> {

    Page<UserAccountLedger> findByUserIdAndInstituteIdOrderByCreatedAtDesc(
            String userId, String instituteId, Pageable pageable);

    @Query("""
            SELECT COALESCE(SUM(l.amount), 0)
            FROM UserAccountLedger l
            WHERE l.userId = :userId AND l.instituteId = :instituteId
              AND l.eventType IN ('DEBIT_ACCRUAL', 'DEBIT_PENALTY')
            """)
    BigDecimal sumDebits(@Param("userId") String userId, @Param("instituteId") String instituteId);

    @Query("""
            SELECT COALESCE(SUM(l.amount), 0)
            FROM UserAccountLedger l
            WHERE l.userId = :userId AND l.instituteId = :instituteId
              AND l.eventType IN ('CREDIT_PAYMENT', 'CREDIT_WAIVER', 'CREDIT_ADJUSTMENT')
            """)
    BigDecimal sumCredits(@Param("userId") String userId, @Param("instituteId") String instituteId);

    @Query("""
            SELECT COALESCE(SUM(l.amount), 0)
            FROM UserAccountLedger l
            WHERE l.userId = :userId AND l.instituteId = :instituteId
              AND l.eventType IN ('DEBIT_ACCRUAL', 'DEBIT_PENALTY')
              AND l.dueDate < CURRENT_DATE
              AND NOT EXISTS (
                  SELECT 1 FROM UserAccountLedger c
                  WHERE c.userId = l.userId
                    AND c.instituteId = l.instituteId
                    AND c.sourceType = l.sourceType
                    AND c.sourceId   = l.sourceId
                    AND c.eventType IN ('CREDIT_PAYMENT', 'CREDIT_WAIVER', 'CREDIT_ADJUSTMENT')
              )
            """)
    BigDecimal sumOverdue(@Param("userId") String userId, @Param("instituteId") String instituteId);

    boolean existsBySourceTypeAndSourceIdAndEventType(String sourceType, String sourceId, String eventType);
}
