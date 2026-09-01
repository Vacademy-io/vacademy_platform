package vacademy.io.admin_core_service.features.user_subscription.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vacademy.io.admin_core_service.features.user_subscription.dto.BillingSummaryProjection;
import vacademy.io.admin_core_service.features.user_subscription.dto.LearnerPlanBreakdownProjection;
import vacademy.io.admin_core_service.features.user_subscription.dto.OutstandingLearnerProjection;
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
        /**
         * Every enrolment one learner holds at an institute, priced individually — the Due side
         * view.
         *
         * Deliberately NOT filtered by status. {@link #findOutstandingLearners} answers "how much
         * is owed" and so bills only live plans; this answers "why", and an admin cannot check that
         * a cancelled enrolment was excluded if the row is missing entirely. The
         * counts_towards_due flag carries the same ACTIVE / PENDING_FOR_PAYMENT rule, so the rows
         * that DO count always re-add to the figure on the card.
         *
         * paid is per plan here, not per learner: the side view is a breakdown, so an invoice
         * payment that belongs to no plan is out of scope by construction.
         */
        @Query(value = """
                SELECT up.id AS userPlanId,
                       ei.name AS courseName,
                       up.status AS planStatus,
                       CASE WHEN po.type = 'CPO' THEN 'Custom Installment'
                            WHEN ei.tag = 'SUB_ORG' THEN 'Sub-Org Admin'
                            WHEN ei.tag = 'SUBORG_LEARNER' THEN 'Sub-Org Learner'
                            WHEN po.source = 'LIVE_SESSION' THEN 'Live Class'
                            WHEN po.source = 'PACKAGE_SESSION' THEN 'Course / Package'
                            ELSE 'Enroll Invite' END AS paymentType,
                       COALESCE(sfp_tot.expected, pp.actual_price, 0) AS billed,
                       COALESCE(paid_tot.amt, 0) AS paid,
                       (up.status IN ('ACTIVE', 'PENDING_FOR_PAYMENT')) AS countsTowardsDue,
                       UPPER(COALESCE(NULLIF(TRIM(pp.currency), ''),
                                      NULLIF(TRIM(ei.currency), ''))) AS currency
                  FROM user_plan up
                  JOIN enroll_invite ei ON ei.id = up.enroll_invite_id
                  LEFT JOIN payment_plan pp ON pp.id = up.plan_id
                  LEFT JOIN payment_option po ON po.id = up.payment_option_id
                  LEFT JOIN (
                    SELECT user_plan_id, SUM(amount_expected) AS expected
                      FROM student_fee_payment
                     GROUP BY user_plan_id
                  ) sfp_tot ON sfp_tot.user_plan_id = up.id
                  LEFT JOIN (
                    SELECT pl.user_plan_id, SUM(pl.payment_amount) AS amt
                      FROM payment_log pl
                     WHERE pl.payment_status = 'PAID'
                     GROUP BY pl.user_plan_id
                  ) paid_tot ON paid_tot.user_plan_id = up.id
                 WHERE ei.institute_id = :instituteId
                   AND up.user_id = :userId
                   -- Same window and course scope as billed_plans. The sheet claims to break down
                   -- ONE row of the Due list, so it has to see exactly the plans that row was
                   -- computed from; unfiltered, a learner who enrolled outside the window showed a
                   -- plan the row never counted and the sections stopped adding up to the header.
                   AND up.created_at >= :startDate
                   AND up.created_at <= :endDate
                   AND (:noPackageSessions = true OR EXISTS (
                         SELECT 1
                           FROM package_session_learner_invitation_to_payment_option psli
                          WHERE psli.enroll_invite_id = ei.id
                            AND psli.status = 'ACTIVE'
                            AND psli.package_session_id IN (:packageSessionIds)))
                 ORDER BY (up.status IN ('ACTIVE', 'PENDING_FOR_PAYMENT')) DESC,
                          COALESCE(sfp_tot.expected, pp.actual_price, 0) DESC,
                          up.created_at DESC
                """, nativeQuery = true)
        List<LearnerPlanBreakdownProjection> findLearnerPlanBreakdown(
                        @Param("instituteId") String instituteId,
                        @Param("userId") String userId,
                        @Param("startDate") LocalDateTime startDate,
                        @Param("endDate") LocalDateTime endDate,
                        @Param("noPackageSessions") boolean noPackageSessions,
                        @Param("packageSessionIds") List<String> packageSessionIds);

        @Query(value = """
                WITH billed_plans AS (
                  SELECT up.user_id AS user_id,
                         SUM(COALESCE(sfp_tot.expected, pp.actual_price, 0)) AS price,
                         COUNT(*) AS plans,
                         MAX(UPPER(COALESCE(NULLIF(TRIM(pp.currency), ''),
                                            NULLIF(TRIM(ei.currency), '')))) AS cur
                    FROM user_plan up
                    JOIN enroll_invite ei ON ei.id = up.enroll_invite_id
                    LEFT JOIN payment_plan pp ON pp.id = up.plan_id
                    -- Net obligation for plans that carry a fee schedule. amount_expected is
                    -- post-discount, so a discounted plan is billed at what the learner actually
                    -- owes. pp.actual_price is the undiscounted list price and would report the
                    -- discount itself as an outstanding due. Pre-aggregated rather than
                    -- correlated for the same reason the paid CTE is — see the note above.
                    LEFT JOIN (
                      SELECT user_plan_id, SUM(amount_expected) AS expected
                        FROM student_fee_payment
                       GROUP BY user_plan_id
                    ) sfp_tot ON sfp_tot.user_plan_id = up.id
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
                ), billed_invoices AS (
                  -- Invoices raised against the institute directly. These carry no user_plan, so
                  -- without this arm an invoice an admin raised was owed by nobody as far as this
                  -- card was concerned — it appeared in neither Total nor Due.
                  --
                  -- Scoped to invoices with no payment_log at all, which is exactly the set the
                  -- listing now surfaces as its own rows, so the table and these totals describe
                  -- the same money. REJECTED is excluded: a voided invoice stays visible in the
                  -- table (struck through) but is neither collected nor owed.
                  --
                  -- plans = 0 so the "N enrolments billed" caption keeps counting enrolments.
                  SELECT inv.user_id AS user_id,
                         SUM(COALESCE(inv.total_amount, 0)) AS price,
                         0 AS plans,
                         MAX(UPPER(NULLIF(TRIM(inv.currency), ''))) AS cur
                    FROM invoice inv
                   WHERE inv.institute_id = :instituteId
                     AND inv.created_at >= :startDate
                     AND inv.created_at <= :endDate
                     AND inv.status <> 'REJECTED'
                     -- An invoice has no package session, so it is counted only for the whole
                     -- institute, never leaked into a course-filtered view (mirrors `paid`).
                     AND :noPackageSessions = true
                     AND NOT EXISTS (SELECT 1 FROM invoice_payment_log_mapping um
                                      WHERE um.invoice_id = inv.id)
                   GROUP BY inv.user_id
                ), billed AS (
                  SELECT user_id, SUM(price) AS price, SUM(plans) AS plans, MAX(cur) AS cur
                    FROM (SELECT * FROM billed_plans
                          UNION ALL
                          SELECT * FROM billed_invoices) all_billed
                   GROUP BY user_id
                ), paid AS (
                  SELECT COALESCE(up.user_id, inv.user_id) AS user_id,
                         SUM(pl.payment_amount) AS amt,
                         COUNT(*) AS cnt
                    FROM payment_log pl
                    LEFT JOIN user_plan up ON up.id = pl.user_plan_id
                    LEFT JOIN enroll_invite ei ON ei.id = up.enroll_invite_id
                    -- ONE invoice per payment log. A single payment can be mapped to more than
                    -- one invoice (duplicate invoices do get generated for the same payment), and
                    -- joining the mapping table directly fanned that payment out into a row per
                    -- invoice, so SUM(payment_amount) counted the same money once per invoice —
                    -- Suchbliss reported ~2x collected off one such ₹7,200 payment. The lateral
                    -- collapses it back to a single row, preferring an invoice belonging to the
                    -- institute being queried so the scoping predicate below can never drop a
                    -- payment that is mapped to another institute's invoice as well.
                    LEFT JOIN LATERAL (
                      SELECT i2.institute_id, i2.user_id
                        FROM invoice_payment_log_mapping m
                        JOIN invoice i2 ON i2.id = m.invoice_id
                       WHERE m.payment_log_id = pl.id
                       -- CASE, not `(... = :instituteId) DESC`: in Postgres DESC means NULLS
                       -- FIRST, so a NULL institute_id would outrank the institute we want
                       -- and silently drop the payment from this institute's total. id is a
                       -- tie-break so the pick is deterministic.
                       ORDER BY CASE WHEN i2.institute_id = :instituteId THEN 0 ELSE 1 END,
                                i2.created_at, i2.id
                       LIMIT 1
                    ) inv ON true
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

        /**
         * The learners behind the "Due payment" card: who owes money, how much, and how their fee
         * is structured. Same billing rules as {@link #getBillingSummary} — billed is the plan
         * price, paid counts both enrolment and invoice payments, and the balance is per learner —
         * so the rows here always add up to the card above them.
         *
         * CPO learners additionally get their instalment position (how many instalments are still
         * unpaid and when the next one is due), read from student_fee_payment, which is the only
         * place a custom instalment schedule exists per learner.
         */
        @Query(value = """
                WITH billed_plans AS (
                  SELECT up.user_id AS user_id,
                         SUM(COALESCE(sfp_tot.expected, pp.actual_price, 0)) AS billed,
                         COUNT(*) AS plan_count,
                         MIN(ei.name) AS course_name,
                         MIN(up.status) AS plan_status,
                         MIN(CASE WHEN po.type = 'CPO' THEN 'Custom Installment'
                                  WHEN ei.tag = 'SUB_ORG' THEN 'Sub-Org Admin'
                                  WHEN ei.tag = 'SUBORG_LEARNER' THEN 'Sub-Org Learner'
                                  WHEN po.source = 'LIVE_SESSION' THEN 'Live Class'
                                  WHEN po.source = 'PACKAGE_SESSION' THEN 'Course / Package'
                                  ELSE 'Enroll Invite' END) AS payment_type,
                         MAX(UPPER(COALESCE(NULLIF(TRIM(pp.currency), ''),
                                            NULLIF(TRIM(ei.currency), '')))) AS currency
                    FROM user_plan up
                    JOIN enroll_invite ei ON ei.id = up.enroll_invite_id
                    LEFT JOIN payment_plan pp ON pp.id = up.plan_id
                    -- Net obligation for plans that carry a fee schedule. amount_expected is
                    -- post-discount, so a discounted plan is billed at what the learner actually
                    -- owes. pp.actual_price is the undiscounted list price and would report the
                    -- discount itself as an outstanding due. Pre-aggregated rather than
                    -- correlated for the same reason the paid CTE is — see the note above.
                    LEFT JOIN (
                      SELECT user_plan_id, SUM(amount_expected) AS expected
                        FROM student_fee_payment
                       GROUP BY user_plan_id
                    ) sfp_tot ON sfp_tot.user_plan_id = up.id
                    LEFT JOIN payment_option po ON po.id = up.payment_option_id
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
                ), billed_invoices AS (
                  -- Mirrors billed_invoices in getBillingSummary. Without it the Due CARD would
                  -- include invoice obligations while this LIST did not, and the rows would stop
                  -- adding up to the card above them.
                  SELECT inv.user_id AS user_id,
                         SUM(COALESCE(inv.total_amount, 0)) AS billed,
                         0 AS plan_count,
                         MIN('Invoice') AS course_name,
                         MIN('PENDING_PAYMENT') AS plan_status,
                         MIN('User Invoice') AS payment_type,
                         MAX(UPPER(NULLIF(TRIM(inv.currency), ''))) AS currency
                    FROM invoice inv
                   WHERE inv.institute_id = :instituteId
                     AND inv.created_at >= :startDate
                     AND inv.created_at <= :endDate
                     AND inv.status <> 'REJECTED'
                     AND :noPackageSessions = true
                     AND NOT EXISTS (SELECT 1 FROM invoice_payment_log_mapping um
                                      WHERE um.invoice_id = inv.id)
                   GROUP BY inv.user_id
                ), billed AS (
                  SELECT user_id, SUM(billed) AS billed, SUM(plan_count) AS plan_count,
                         MIN(course_name) AS course_name, MIN(plan_status) AS plan_status,
                         MIN(payment_type) AS payment_type, MAX(currency) AS currency
                    FROM (SELECT * FROM billed_plans
                          UNION ALL
                          SELECT * FROM billed_invoices) all_billed
                   GROUP BY user_id
                ), paid AS (
                  SELECT COALESCE(up.user_id, inv.user_id) AS user_id, SUM(pl.payment_amount) AS paid
                    FROM payment_log pl
                    LEFT JOIN user_plan up ON up.id = pl.user_plan_id
                    LEFT JOIN enroll_invite ei ON ei.id = up.enroll_invite_id
                    -- ONE invoice per payment log. A single payment can be mapped to more than
                    -- one invoice (duplicate invoices do get generated for the same payment), and
                    -- joining the mapping table directly fanned that payment out into a row per
                    -- invoice, so SUM(payment_amount) counted the same money once per invoice —
                    -- Suchbliss reported ~2x collected off one such ₹7,200 payment. The lateral
                    -- collapses it back to a single row, preferring an invoice belonging to the
                    -- institute being queried so the scoping predicate below can never drop a
                    -- payment that is mapped to another institute's invoice as well.
                    LEFT JOIN LATERAL (
                      SELECT i2.institute_id, i2.user_id
                        FROM invoice_payment_log_mapping m
                        JOIN invoice i2 ON i2.id = m.invoice_id
                       WHERE m.payment_log_id = pl.id
                       -- CASE, not `(... = :instituteId) DESC`: in Postgres DESC means NULLS
                       -- FIRST, so a NULL institute_id would outrank the institute we want
                       -- and silently drop the payment from this institute's total. id is a
                       -- tie-break so the pick is deterministic.
                       ORDER BY CASE WHEN i2.institute_id = :instituteId THEN 0 ELSE 1 END,
                                i2.created_at, i2.id
                       LIMIT 1
                    ) inv ON true
                   WHERE pl.payment_status = 'PAID'
                     AND pl.created_at >= :startDate
                     AND pl.created_at <= :endDate
                     AND (ei.institute_id = :instituteId
                       OR (:noPackageSessions = true AND inv.institute_id = :instituteId))
                   GROUP BY COALESCE(up.user_id, inv.user_id)
                ), fee AS (
                  SELECT sfp.user_id AS user_id,
                         COUNT(*) FILTER (WHERE COALESCE(sfp.amount_paid, 0) < sfp.amount_expected)
                           AS pending_installments,
                         MIN(sfp.due_date) FILTER (WHERE COALESCE(sfp.amount_paid, 0) < sfp.amount_expected)
                           AS next_due_date
                    FROM student_fee_payment sfp
                   WHERE sfp.institute_id = :instituteId
                   GROUP BY sfp.user_id
                )
                SELECT b.user_id AS userId,
                       b.course_name AS courseName,
                       b.payment_type AS paymentType,
                       b.plan_status AS planStatus,
                       b.billed AS billed,
                       COALESCE(p.paid, 0) AS paid,
                       GREATEST(b.billed - COALESCE(p.paid, 0), 0) AS due,
                       b.plan_count AS planCount,
                       COALESCE(f.pending_installments, 0) AS pendingInstallments,
                       f.next_due_date AS nextDueDate,
                       b.currency AS currency
                  FROM billed b
                  LEFT JOIN paid p ON p.user_id = b.user_id
                  LEFT JOIN fee f ON f.user_id = b.user_id
                 WHERE GREATEST(b.billed - COALESCE(p.paid, 0), 0) > 0
                 ORDER BY due DESC
                """, countQuery = """
                WITH billed_plans AS (
                  SELECT up.user_id AS user_id, SUM(COALESCE(sfp_tot.expected, pp.actual_price, 0)) AS billed
                    FROM user_plan up
                    JOIN enroll_invite ei ON ei.id = up.enroll_invite_id
                    LEFT JOIN payment_plan pp ON pp.id = up.plan_id
                    -- Net obligation for plans that carry a fee schedule. amount_expected is
                    -- post-discount, so a discounted plan is billed at what the learner actually
                    -- owes. pp.actual_price is the undiscounted list price and would report the
                    -- discount itself as an outstanding due. Pre-aggregated rather than
                    -- correlated for the same reason the paid CTE is — see the note above.
                    LEFT JOIN (
                      SELECT user_plan_id, SUM(amount_expected) AS expected
                        FROM student_fee_payment
                       GROUP BY user_plan_id
                    ) sfp_tot ON sfp_tot.user_plan_id = up.id
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
                ), billed_invoices AS (
                  -- Mirrors the main query so the page count matches the rows it pages over.
                  SELECT inv.user_id AS user_id, SUM(COALESCE(inv.total_amount, 0)) AS billed
                    FROM invoice inv
                   WHERE inv.institute_id = :instituteId
                     AND inv.created_at >= :startDate
                     AND inv.created_at <= :endDate
                     AND inv.status <> 'REJECTED'
                     AND :noPackageSessions = true
                     AND NOT EXISTS (SELECT 1 FROM invoice_payment_log_mapping um
                                      WHERE um.invoice_id = inv.id)
                   GROUP BY inv.user_id
                ), billed AS (
                  SELECT user_id, SUM(billed) AS billed
                    FROM (SELECT * FROM billed_plans
                          UNION ALL
                          SELECT * FROM billed_invoices) all_billed
                   GROUP BY user_id
                ), paid AS (
                  SELECT COALESCE(up.user_id, inv.user_id) AS user_id, SUM(pl.payment_amount) AS paid
                    FROM payment_log pl
                    LEFT JOIN user_plan up ON up.id = pl.user_plan_id
                    LEFT JOIN enroll_invite ei ON ei.id = up.enroll_invite_id
                    -- ONE invoice per payment log. A single payment can be mapped to more than
                    -- one invoice (duplicate invoices do get generated for the same payment), and
                    -- joining the mapping table directly fanned that payment out into a row per
                    -- invoice, so SUM(payment_amount) counted the same money once per invoice —
                    -- Suchbliss reported ~2x collected off one such ₹7,200 payment. The lateral
                    -- collapses it back to a single row, preferring an invoice belonging to the
                    -- institute being queried so the scoping predicate below can never drop a
                    -- payment that is mapped to another institute's invoice as well.
                    LEFT JOIN LATERAL (
                      SELECT i2.institute_id, i2.user_id
                        FROM invoice_payment_log_mapping m
                        JOIN invoice i2 ON i2.id = m.invoice_id
                       WHERE m.payment_log_id = pl.id
                       -- CASE, not `(... = :instituteId) DESC`: in Postgres DESC means NULLS
                       -- FIRST, so a NULL institute_id would outrank the institute we want
                       -- and silently drop the payment from this institute's total. id is a
                       -- tie-break so the pick is deterministic.
                       ORDER BY CASE WHEN i2.institute_id = :instituteId THEN 0 ELSE 1 END,
                                i2.created_at, i2.id
                       LIMIT 1
                    ) inv ON true
                   WHERE pl.payment_status = 'PAID'
                     AND pl.created_at >= :startDate
                     AND pl.created_at <= :endDate
                     AND (ei.institute_id = :instituteId
                       OR (:noPackageSessions = true AND inv.institute_id = :instituteId))
                   GROUP BY COALESCE(up.user_id, inv.user_id)
                )
                SELECT COUNT(*)
                  FROM billed b
                  LEFT JOIN paid p ON p.user_id = b.user_id
                 WHERE GREATEST(b.billed - COALESCE(p.paid, 0), 0) > 0
                """, nativeQuery = true)
        Page<OutstandingLearnerProjection> findOutstandingLearners(
                        @Param("instituteId") String instituteId,
                        @Param("startDate") LocalDateTime startDate,
                        @Param("endDate") LocalDateTime endDate,
                        @Param("noPackageSessions") boolean noPackageSessions,
                        @Param("packageSessionIds") List<String> packageSessionIds,
                        Pageable pageable);

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