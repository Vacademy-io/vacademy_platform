package vacademy.io.admin_core_service.features.user_subscription.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vacademy.io.admin_core_service.features.user_subscription.dto.BillingSummaryProjection;
import vacademy.io.admin_core_service.features.user_subscription.entity.UserPlan;

import java.sql.Timestamp;
import java.util.List;
import java.util.Optional;
import java.time.LocalDateTime;

public interface UserPlanRepository extends JpaRepository<UserPlan, String> {

        @Query("SELECT ei.inviteCode FROM UserPlan up JOIN up.enrollInvite ei WHERE up.id = :userPlanId")
        Optional<String> findInviteCodeByUserPlanId(@Param("userPlanId") String userPlanId);

        /**
         * Used by {@code PackageSessionScheduler.emitMembershipExpiryReminders}
         * to find plans whose access is about to expire so the
         * MEMBERSHIP_EXPIRY workflow trigger can be fired. Filters:
         *   • status = 'ACTIVE'         — active plans only
         *   • end_date IS NOT NULL      — skip lifetime plans (validity=null)
         *   • end_date > :now           — not already expired
         *   • end_date <= :cutoff       — within the reminder window
         * Dedup (have we already notified this plan?) is handled at job time
         * by querying {@code workflow_execution.idempotency_key} — we do NOT
         * stamp a flag on the user_plan row.
         * Returns plans with their EnrollInvite eagerly fetched because the
         * job needs the institute_id off it to route the trigger correctly.
         */
        @Query("""
                SELECT up FROM UserPlan up
                LEFT JOIN FETCH up.enrollInvite ei
                WHERE up.status = 'ACTIVE'
                  AND up.endDate IS NOT NULL
                  AND up.endDate > :now
                  AND up.endDate <= :cutoff
                """)
        List<UserPlan> findActivePlansExpiringSoon(
                @Param("now") java.util.Date now,
                @Param("cutoff") java.util.Date cutoff);

        /**
         * Institute-scoped variant of {@link #findActivePlansExpiringSoon}, used by the
         * {@code fetch_expiring_memberships} workflow query. Scopes on ei.instituteId so a
         * workflow only ever sees its OWN institute's expiring plans (the un-scoped variant
         * above is safe only because its one caller reads institute_id off each row to route;
         * a workflow query must never see other tenants' plans).
         */
        @Query("""
                SELECT up FROM UserPlan up
                LEFT JOIN FETCH up.enrollInvite ei
                WHERE up.status = 'ACTIVE'
                  AND ei.instituteId = :instituteId
                  AND up.endDate IS NOT NULL
                  AND up.endDate > :now
                  AND up.endDate <= :cutoff
                """)
        List<UserPlan> findActivePlansExpiringSoonByInstitute(
                @Param("instituteId") String instituteId,
                @Param("now") java.util.Date now,
                @Param("cutoff") java.util.Date cutoff);

        @Query(value = """
                            SELECT DISTINCT up FROM UserPlan up
                            JOIN FETCH up.enrollInvite ei
                            LEFT JOIN FETCH up.paymentOption po
                            LEFT JOIN FETCH up.paymentPlan pp
                            WHERE up.userId = :userId
                              AND ei.instituteId = :instituteId
                              AND (:statuses IS NULL OR up.status IN :statuses)
                        """, countQuery = """
                            SELECT COUNT(up) FROM UserPlan up
                            JOIN up.enrollInvite ei
                            WHERE up.userId = :userId
                              AND ei.instituteId = :instituteId
                              AND (:statuses IS NULL OR up.status IN :statuses)
                        """)
        Page<UserPlan> findByUserIdAndInstituteIdWithFilters(
                        @Param("userId") String userId,
                        @Param("instituteId") String instituteId,
                        @Param("statuses") List<String> statuses,
                        Pageable pageable);

        /**
         * Used by LearnerPaymentMethodService to rewrite the Stripe
         * paymentMethodId inside json_payment_details after a learner updates
         * their card. EnrollInvite is fetched for the vendor/currency needed
         * to normalize legacy snapshot shapes; PaymentPlan for the amount.
         */
        @Query("""
                        SELECT DISTINCT up FROM UserPlan up
                        JOIN FETCH up.enrollInvite ei
                        LEFT JOIN FETCH up.paymentPlan pp
                        WHERE up.userId = :userId
                          AND ei.instituteId = :instituteId
                          AND up.status IN :statuses
                        """)
        List<UserPlan> findAllByUserIdAndInstituteIdAndStatusIn(
                        @Param("userId") String userId,
                        @Param("instituteId") String instituteId,
                        @Param("statuses") List<String> statuses);

        /** Newest plan a user holds on a given invite — sub-org registration payment retry. */
        Optional<UserPlan> findFirstByUserIdAndEnrollInviteIdOrderByCreatedAtDesc(
                        String userId, String enrollInviteId);

        Optional<UserPlan> findFirstByUserIdAndEnrollInviteIdAndCreatedAtAfterOrderByCreatedAtAsc(
                        String userId,
                        String enrollInviteId,
                        LocalDateTime createdAt);

        @Query(value = """
                            SELECT DISTINCT up.id,
                                   CASE
                                       WHEN up.end_date IS NULL THEN 'LIFETIME'
                                       WHEN up.end_date < CURRENT_TIMESTAMP THEN 'ENDED'
                                       ELSE 'ABOUT_TO_END'
                                   END as computedStatus,
                                   up.end_date as actualEndDate
                            FROM user_plan up
                            JOIN enroll_invite ei ON ei.id = up.enroll_invite_id
                            LEFT JOIN package_session_learner_invitation_to_payment_option ps_link ON ps_link.enroll_invite_id = ei.id AND ps_link.status = 'ACTIVE' AND ps_link.payment_option_id = up.payment_option_id
                            WHERE ei.institute_id = :instituteId

                            -- Explicit CAST to TIMESTAMP is still good practice for dynamic null checks
                            AND (CAST(:startDate AS TIMESTAMP) IS NULL OR up.end_date >= CAST(:startDate AS TIMESTAMP))
                            AND (CAST(:endDate AS TIMESTAMP) IS NULL OR up.end_date <= CAST(:endDate AS TIMESTAMP))

                            AND (
                                :#{#packageSessionIds == null || #packageSessionIds.isEmpty() ? 1 : 0} = 1
                                OR ps_link.package_session_id IN (:packageSessionIds)
                            )

                            AND (
                                :#{#statuses == null || #statuses.isEmpty() ? 1 : 0} = 1
                                OR
                                CASE
                                   WHEN up.end_date IS NULL THEN 'LIFETIME'
                                   WHEN up.end_date < CURRENT_TIMESTAMP THEN 'ENDED'
                                   ELSE 'ABOUT_TO_END'
                                END IN (:statuses)
                            )
                        """, countQuery = """
                            SELECT COUNT(DISTINCT up.id)
                            FROM user_plan up
                            JOIN enroll_invite ei ON ei.id = up.enroll_invite_id
                            LEFT JOIN package_session_learner_invitation_to_payment_option ps_link ON ps_link.enroll_invite_id = ei.id AND ps_link.status = 'ACTIVE' AND ps_link.payment_option_id = up.payment_option_id
                            WHERE ei.institute_id = :instituteId
                            AND (CAST(:startDate AS TIMESTAMP) IS NULL OR up.end_date >= CAST(:startDate AS TIMESTAMP))
                            AND (CAST(:endDate AS TIMESTAMP) IS NULL OR up.end_date <= CAST(:endDate AS TIMESTAMP))
                            AND (
                                :#{#packageSessionIds == null || #packageSessionIds.isEmpty() ? 1 : 0} = 1
                                OR ps_link.package_session_id IN (:packageSessionIds)
                            )
                            AND (
                                :#{#statuses == null || #statuses.isEmpty() ? 1 : 0} = 1
                                OR
                                CASE
                                   WHEN up.end_date IS NULL THEN 'LIFETIME'
                                   WHEN up.end_date < CURRENT_TIMESTAMP THEN 'ENDED'
                                   ELSE 'ABOUT_TO_END'
                                END IN (:statuses)
                            )
                        """, nativeQuery = true)
        Page<Object[]> findMembershipDetailsWithDynamicStatus(
                        @Param("instituteId") String instituteId,
                        @Param("startDate") Timestamp startDate,
                        @Param("endDate") Timestamp endDate,
                        @Param("statuses") List<String> statuses,
                        @Param("packageSessionIds") List<String> packageSessionIds,
                        Pageable pageable);

        /**
         * Find UserPlan entities by IDs without loading payment logs (optimized for
         * membership details).
         * Uses EntityGraph to control which associations to fetch.
         */
        @EntityGraph(attributePaths = { "enrollInvite", "paymentOption", "paymentPlan" })
        @Query("SELECT up FROM UserPlan up WHERE up.id IN :ids")
        List<UserPlan> findByIdsWithoutPaymentLogs(@Param("ids") List<String> ids);

        Optional<UserPlan> findFirstByUserIdAndPaymentPlanIdAndStatus(String userId, String paymentPlanId,
                        String status);

        List<UserPlan> findAllByStatusIn(List<String> statuses);

        /**
         * Institute-scoped variant of {@link #findAllByStatusIn}, used by the
         * institute-gated renewal scheduler
         * ({@code PackageSessionScheduler.processPackageSessionRenewals}) so the
         * daily scan only ever loads plans belonging to institutes that opted in
         * via PAYMENT_SETTING — never the whole user_plan table. EnrollInvite is
         * fetched eagerly because downstream processing reads institute/invite
         * data off it.
         */
        @Query("""
                SELECT up FROM UserPlan up
                JOIN FETCH up.enrollInvite ei
                WHERE up.status IN :statuses
                  AND ei.instituteId IN :instituteIds
                """)
        List<UserPlan> findAllByStatusInAndInstituteIdIn(
                        @Param("statuses") List<String> statuses,
                        @Param("instituteIds") List<String> instituteIds);

        /**
         * Find active UserPlan for a sub-organization with payment plan loaded
         * Used to retrieve member count limits for sub-org enrollments
         */
        @EntityGraph(attributePaths = { "paymentPlan" })
        @Query("SELECT up FROM UserPlan up " +
                        "WHERE up.subOrgId = :subOrgId " +
                        "AND up.source = :source " +
                        "AND up.status = :status")
        Optional<UserPlan> findBySubOrgIdAndSourceAndStatus(
                        @Param("subOrgId") String subOrgId,
                        @Param("source") String source,
                        @Param("status") String status);

        /**
         * Find UserPlan for ROOT_ADMIN with payment plan loaded
         * Used to get member count limit from the ROOT_ADMIN who purchased the plan
         */
        @EntityGraph(attributePaths = { "paymentPlan" })
        @Query("SELECT up FROM UserPlan up " +
                        "WHERE up.userId = :userId " +
                        "AND up.subOrgId = :subOrgId " +
                        "AND up.source = :source " +
                        "AND up.status = :status")
        Optional<UserPlan> findByUserIdAndSubOrgIdAndSourceAndStatus(
                        @Param("userId") String userId,
                        @Param("subOrgId") String subOrgId,
                        @Param("source") String source,
                        @Param("status") String status);

        Optional<UserPlan> findTopByUserIdAndEnrollInviteIdAndStatusInOrderByEndDateDesc(
                        String userId,
                        String enrollInviteId,
                        List<String> statuses);

        // All of a user's plans for an enroll invite in the given statuses. Used to
        // reconcile abandoned duplicate checkout attempts (PENDING_FOR_PAYMENT siblings)
        // once one attempt is finally paid.
        List<UserPlan> findAllByUserIdAndEnrollInviteIdAndStatusIn(
                        String userId,
                        String enrollInviteId,
                        List<String> statuses);

        Optional<UserPlan> findTopByUserIdAndEnrollInviteIdAndStatusInAndIdNotInOrderByEndDateDesc(
                        String userId,
                        String enrollInviteId,
                        List<String> statuses,
                        List<String> userPlanIds);

        Optional<UserPlan> findTopByUserIdAndEnrollInviteIdAndStatusInAndIdNotInOrderByCreatedAtAsc(
                        String userId,
                        String enrollInviteId,
                        List<String> statuses,
                        List<String> userPlanIds);

        Optional<UserPlan> findTopByUserIdAndEnrollInviteIdAndStatusInOrderByCreatedAtAsc(
                        String userId,
                        String enrollInviteId,
                        List<String> statuses);

        Optional<UserPlan> findTopByUserIdAndPaymentOptionIdAndStatusInOrderByCreatedAtDesc(
                        String userId,
                        String paymentOptionId,
                        List<String> statuses);

        /**
         * Auto-charge scheduler due-query (V369 autopay). Returns ACTIVE plans
         * that have opted into autopay and whose next_charge_at has arrived.
         * Only plans with auto_renewal_enabled = true are ever selected, so
         * pre-existing (non-migrated) plans are never auto-charged. EnrollInvite +
         * PaymentPlan are fetched because the charge step needs the institute_id,
         * vendor and amount off them.
         */
        @Query("""
                SELECT up FROM UserPlan up
                LEFT JOIN FETCH up.enrollInvite ei
                LEFT JOIN FETCH up.paymentPlan pp
                WHERE up.status = 'ACTIVE'
                  AND up.autoRenewalEnabled = true
                  AND up.nextChargeAt IS NOT NULL
                  AND up.nextChargeAt <= :now
                """)
        List<UserPlan> findDueForRenewal(@Param("now") java.util.Date now);

        /**
         * Atomically CLAIM a plan for a renewal charge (multi-replica safe). The
         * daily scheduler fires on every replica, so before charging, each replica
         * runs this — only the one whose UPDATE actually flips next_charge_at→null
         * (rows-affected = 1) proceeds to charge; the rest see 0 and skip. Also
         * bumps the attempt counter + timestamp in the same atomic write so the
         * claim and dunning bookkeeping can't diverge.
         */
        /**
         * Billing summary for the Total / Collected / Due cards.
         *
         * Due is what learners still owe — what their enrolments were billed at, minus what they
         * have actually paid — NOT a count of unpaid payment rows. A ₹35,000 course paid in one
         * ₹10,000 instalment leaves a single PAID row and no trace of the ₹25,000 outstanding, and
         * an enrolment that has never paid has no payment rows at all, so summing payment_log
         * reports institutes as fully collected while lakhs are owed.
         *
         * Matching is per LEARNER, not per plan. Money reaches an institute two ways — against an
         * enrolment, or against an admin-raised invoice, which carries no user_plan and hangs off
         * the institute directly. Crediting only plan-linked payments left learners who paid by
         * invoice showing their whole course fee as due while the table below listed the very
         * payment that settled part of it.
         *
         * GREATEST(billed - paid, 0) per learner keeps an over-payment, a free enrolment or a CPO
         * plan priced elsewhere from pushing due negative, and total is returned as collected + due
         * so the three cards always reconcile. The PAID totals are pre-aggregated and joined rather
         * than looked up per plan: as a correlated subquery this took 33 s on an institute with
         * 8,380 live plans, and 172 ms this way.
         */
        @Query(value = """
                WITH billed AS (
                  SELECT up.user_id AS user_id,
                         SUM(COALESCE(pp.actual_price, 0)) AS price,
                         COUNT(*) AS plans,
                         MAX(UPPER(COALESCE(NULLIF(TRIM(pp.currency), ''),
                                            NULLIF(TRIM(ei.currency), '')))) AS cur
                    FROM user_plan up
                    JOIN enroll_invite ei ON ei.id = up.enroll_invite_id
                    LEFT JOIN payment_plan pp ON pp.id = up.plan_id
                   WHERE ei.institute_id = :instituteId
                     AND up.status IN ('ACTIVE', 'PENDING_FOR_PAYMENT')
                     AND up.created_at >= :startDate
                     AND up.created_at <= :endDate
                     AND (:noPackageSessions = true OR EXISTS (
                           SELECT 1
                             FROM package_session_learner_invitation_to_payment_option psli
                            WHERE psli.enroll_invite_id = ei.id
                              AND psli.status = 'ACTIVE'
                              AND psli.package_session_id IN (:packageSessionIds)))
                   GROUP BY up.user_id
                ), paid AS (
                  SELECT COALESCE(up.user_id, inv.user_id) AS user_id,
                         SUM(pl.payment_amount) AS amt,
                         COUNT(*) AS cnt
                    FROM payment_log pl
                    LEFT JOIN user_plan up ON up.id = pl.user_plan_id
                    LEFT JOIN enroll_invite ei ON ei.id = up.enroll_invite_id
                    LEFT JOIN invoice_payment_log_mapping m ON m.payment_log_id = pl.id
                    LEFT JOIN invoice inv ON inv.id = m.invoice_id
                   WHERE pl.payment_status = 'PAID'
                     AND pl.created_at >= :startDate
                     AND pl.created_at <= :endDate
                     AND ((ei.institute_id = :instituteId
                           AND (:noPackageSessions = true OR EXISTS (
                                 SELECT 1
                                   FROM package_session_learner_invitation_to_payment_option psli
                                  WHERE psli.enroll_invite_id = ei.id
                                    AND psli.status = 'ACTIVE'
                                    AND psli.package_session_id IN (:packageSessionIds))))
                       -- An invoice carries no package session, so it is counted only for the
                       -- whole institute, never leaked into a course-filtered view.
                       OR (:noPackageSessions = true AND inv.institute_id = :instituteId))
                   GROUP BY COALESCE(up.user_id, inv.user_id)
                )
                SELECT COALESCE(SUM(p.amt), 0) AS collected,
                       COALESCE(SUM(GREATEST(COALESCE(b.price, 0) - COALESCE(p.amt, 0), 0)), 0) AS due,
                       COALESCE(SUM(p.amt), 0)
                         + COALESCE(SUM(GREATEST(COALESCE(b.price, 0) - COALESCE(p.amt, 0), 0)), 0)
                         AS totalBilled,
                       COALESCE(SUM(b.plans), 0) AS planCount,
                       COUNT(*) FILTER (WHERE COALESCE(b.price, 0) > 0
                                          AND COALESCE(p.amt, 0) >= b.price) AS settledPlanCount,
                       (SELECT cur FROM billed WHERE cur IS NOT NULL
                         GROUP BY cur ORDER BY COUNT(*) DESC LIMIT 1) AS currency
                  FROM billed b
                  FULL JOIN paid p ON p.user_id = b.user_id
                """, nativeQuery = true)
        BillingSummaryProjection getBillingSummary(
                        @Param("instituteId") String instituteId,
                        @Param("startDate") LocalDateTime startDate,
                        @Param("endDate") LocalDateTime endDate,
                        @Param("noPackageSessions") boolean noPackageSessions,
                        @Param("packageSessionIds") List<String> packageSessionIds);

        @org.springframework.transaction.annotation.Transactional
        @org.springframework.data.jpa.repository.Modifying(clearAutomatically = true)
        @Query("""
                UPDATE UserPlan up
                   SET up.nextChargeAt = null,
                       up.renewalAttemptCount = (CASE WHEN up.renewalAttemptCount IS NULL
                                                      THEN 0 ELSE up.renewalAttemptCount END) + 1,
                       up.lastRenewalAttemptAt = :now
                 WHERE up.id = :id AND up.nextChargeAt IS NOT NULL
                """)
        int claimForRenewal(@Param("id") String id, @Param("now") java.util.Date now);
}