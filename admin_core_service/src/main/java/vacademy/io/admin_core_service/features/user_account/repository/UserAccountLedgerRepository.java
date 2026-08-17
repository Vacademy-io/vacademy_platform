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

    /**
     * Net obligation raised: accruals + penalties MINUS reversals.
     *
     * <p>A DEBIT_REVERSAL is posted when an obligation is voided (e.g. an admin invoice is
     * cancelled). It has to cancel the original DEBIT_ACCRUAL out of "total accrued" — booking
     * it as a credit instead (which is what the reject path used to do) left the accrual
     * standing at its full amount and simultaneously reported the void as money received.
     */
    @Query("""
            SELECT COALESCE(SUM(CASE WHEN l.eventType = 'DEBIT_REVERSAL' THEN -l.amount ELSE l.amount END), 0)
            FROM UserAccountLedger l
            WHERE l.userId = :userId AND l.instituteId = :instituteId
              AND l.eventType IN ('DEBIT_ACCRUAL', 'DEBIT_PENALTY', 'DEBIT_REVERSAL')
            """)
    BigDecimal sumDebits(@Param("userId") String userId, @Param("instituteId") String instituteId);

    @Query("""
            SELECT COALESCE(SUM(l.amount), 0)
            FROM UserAccountLedger l
            WHERE l.userId = :userId AND l.instituteId = :instituteId
              AND l.eventType IN ('CREDIT_PAYMENT', 'CREDIT_WAIVER', 'CREDIT_ADJUSTMENT')
            """)
    BigDecimal sumCredits(@Param("userId") String userId, @Param("instituteId") String instituteId);

    /**
     * Net obligation whose due date has already passed (reversals subtracted, same as
     * {@link #sumDebits}). The caller turns this into "Past Due" by subtracting the credits
     * collected so far — every allocation path in the product settles oldest-due-first
     * (FIFO), so credits consume past-due obligations before upcoming ones.
     *
     * <p>This replaced a per-source {@code NOT EXISTS} correlated subquery that only ever
     * worked when the credit happened to carry the SAME source_type/source_id as the debit.
     * It never did for fee installments (accruals are per STUDENT_FEE_PAYMENT, payments are
     * booked against the USER_PLAN), so Past Due never cleared; and where the sources DID
     * match, any payment — even ₹1 of a ₹10,000 bill — cleared the whole row.
     */
    @Query("""
            SELECT COALESCE(SUM(CASE WHEN l.eventType = 'DEBIT_REVERSAL' THEN -l.amount ELSE l.amount END), 0)
            FROM UserAccountLedger l
            WHERE l.userId = :userId AND l.instituteId = :instituteId
              AND l.eventType IN ('DEBIT_ACCRUAL', 'DEBIT_PENALTY', 'DEBIT_REVERSAL')
              AND l.dueDate IS NOT NULL
              AND l.dueDate < CURRENT_DATE
            """)
    BigDecimal sumPastDueDebits(@Param("userId") String userId, @Param("instituteId") String instituteId);

    boolean existsBySourceTypeAndSourceIdAndEventType(String sourceType, String sourceId, String eventType);

    /**
     * Idempotency probe for money events keyed on the originating PaymentLog. Both the
     * gateway webhook and the enrollment-confirmation path can fire for the same payment;
     * without this a single payment would be credited twice.
     */
    boolean existsByReferenceIdAndEventType(String referenceId, String eventType);

    /**
     * Total already booked for one (sourceType, sourceId, eventType) triple. Used by the CPO
     * discount sync to work out the DELTA it still owes the ledger: the discount recompute
     * runs from scratch on every edit, so posting the full discount each time would stack
     * duplicate reversals on an append-only table.
     */
    @Query("""
            SELECT COALESCE(SUM(l.amount), 0)
            FROM UserAccountLedger l
            WHERE l.sourceType = :sourceType AND l.sourceId = :sourceId AND l.eventType = :eventType
            """)
    BigDecimal sumBySourceAndEventType(@Param("sourceType") String sourceType,
                                      @Param("sourceId") String sourceId,
                                      @Param("eventType") String eventType);
}
