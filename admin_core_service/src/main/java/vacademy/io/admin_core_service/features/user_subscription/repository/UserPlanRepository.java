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
         * The obligations behind the Due / Upcoming cards, one row per enrolment plus one per
         * unpaid admin invoice. Shared by the summary, the Due learners list and the per-learner
         * breakdown so the three can never disagree about who owes what.
         *
         * The rule: <b>a learner owes money only when they have been granted access and an
         * obligation on that access is unpaid.</b> Which obligations exist depends on the plan:
         * <ul>
         *   <li><b>CPO</b> (custom instalments): each {@code student_fee_payment} row. Overdue once
         *       its due_date has passed; upcoming while it falls due within the horizon.</li>
         *   <li><b>SUBSCRIPTION</b>: the renewal. Overdue when the plan is still ACTIVE (access
         *       retained through dunning / grace) but its period end_date has passed — a failed
         *       autopay leaves exactly this state. Upcoming while the period ends within the
         *       horizon. The renewal charges the plan's list price, so that is the amount.</li>
         *   <li><b>Admin invoice</b>: unpaid and not REJECTED. Overdue past its due date.</li>
         *   <li><b>ONE_TIME</b> (and FREE / DONATION): never owed. A one-time purchase is binary —
         *       paid and enrolled, or not enrolled. There is no obligation to bill.</li>
         * </ul>
         *
         * What this deliberately leaves out, because each one used to be reported as debt:
         * <ul>
         *   <li>PENDING_FOR_PAYMENT plans — a checkout the learner opened and never finished. No
         *       access was granted, nothing is owed. ShikshaNation carried ₹5.9L of these, one
         *       learner alone holding 22 abandoned copies of the same plan.</li>
         *   <li>The coupon discount on a one-time plan — billing at {@code pp.actual_price} (the
         *       list price) reported the discount itself as outstanding on 47 fully paid learners.</li>
         *   <li>Cancelled / terminated / expired plans — access is gone, so is the obligation.</li>
         * </ul>
         *
         * Per-plan {@code paid} is what landed against that plan (CPO: the schedule's amount_paid;
         * one-time: PAID payment logs). It is informational — settlement is tracked by each source
         * itself (a paid instalment updates amount_paid, a settled renewal advances end_date, a paid
         * invoice gains a payment mapping), so nothing here nets learner-level payments against
         * learner-level bills the way the old query did.
         *
         * {@code activated_without_payment} flags a live, priced ONE_TIME plan with no PAID log: an
         * admin activated it by hand. That may be an offline payment nobody recorded or a free
         * grant; the card shows the count as a hygiene hint rather than guessing it is owed.
         * Sub-org learners are excluded — their practice pays at org level.
         */
        String DUE_OBLIGATION_CTES = """
                WITH cpo_sched AS (
                  SELECT sfp.user_plan_id,
                         SUM(sfp.amount_expected) AS expected,
                         SUM(COALESCE(sfp.amount_paid, 0)) AS paid,
                         COALESCE(SUM(GREATEST(sfp.amount_expected - COALESCE(sfp.amount_paid, 0), 0))
                           FILTER (WHERE sfp.due_date < CURRENT_DATE), 0) AS overdue,
                         COALESCE(SUM(GREATEST(sfp.amount_expected - COALESCE(sfp.amount_paid, 0), 0))
                           FILTER (WHERE sfp.due_date >= CURRENT_DATE
                                     AND sfp.due_date < CURRENT_DATE + (:upcomingDays * INTERVAL '1 day')), 0)
                           AS upcoming,
                         COUNT(*) FILTER (WHERE COALESCE(sfp.amount_paid, 0) < sfp.amount_expected)
                           AS pending_installments,
                         MIN(CAST(sfp.due_date AS date))
                           FILTER (WHERE COALESCE(sfp.amount_paid, 0) < sfp.amount_expected)
                           AS next_due_date
                    FROM student_fee_payment sfp
                   WHERE sfp.institute_id = :instituteId
                     AND sfp.status NOT IN ('DELETED', 'CANCELLED', 'DROPPED', 'WAIVED')
                   GROUP BY sfp.user_plan_id
                ), plan_paid AS (
                  SELECT pl.user_plan_id, SUM(pl.payment_amount) AS amt
                    FROM payment_log pl
                    JOIN user_plan up2 ON up2.id = pl.user_plan_id
                    JOIN enroll_invite ei2 ON ei2.id = up2.enroll_invite_id
                   WHERE pl.payment_status = 'PAID'
                     AND ei2.institute_id = :instituteId
                   GROUP BY pl.user_plan_id
                ), plan_obligations AS (
                  SELECT up.id AS user_plan_id,
                         up.user_id AS user_id,
                         ei.name AS course_name,
                         up.status AS plan_status,
                         CASE WHEN po.type = 'CPO' THEN 'CPO'
                              WHEN po.type = 'SUBSCRIPTION' THEN 'SUBSCRIPTION'
                              ELSE 'ONE_TIME' END AS kind,
                         CASE WHEN po.type = 'CPO' THEN 'Custom Installment'
                              WHEN ei.tag = 'SUB_ORG' THEN 'Sub-Org Admin'
                              WHEN ei.tag = 'SUBORG_LEARNER' THEN 'Sub-Org Learner'
                              WHEN po.type = 'SUBSCRIPTION' THEN 'Subscription'
                              WHEN po.source = 'LIVE_SESSION' THEN 'Live Class'
                              WHEN po.source = 'PACKAGE_SESSION' THEN 'Course / Package'
                              ELSE 'Enroll Invite' END AS payment_type,
                         (up.status = 'ACTIVE') AS is_live,
                         true AS is_plan,
                         CASE WHEN po.type = 'CPO' THEN COALESCE(cs.expected, 0)
                              ELSE COALESCE(pp.actual_price, 0) END AS billed,
                         CASE WHEN po.type = 'CPO' THEN COALESCE(cs.paid, 0)
                              WHEN po.type = 'SUBSCRIPTION' THEN 0
                              ELSE COALESCE(pd.amt, 0) END AS paid,
                         CASE WHEN up.status <> 'ACTIVE' THEN 0
                              WHEN po.type = 'CPO' THEN COALESCE(cs.overdue, 0)
                              WHEN po.type = 'SUBSCRIPTION'
                                   AND up.end_date IS NOT NULL
                                   AND up.end_date < CURRENT_TIMESTAMP THEN COALESCE(pp.actual_price, 0)
                              ELSE 0 END AS overdue,
                         CASE WHEN up.status <> 'ACTIVE' THEN 0
                              WHEN po.type = 'CPO' THEN COALESCE(cs.upcoming, 0)
                              WHEN po.type = 'SUBSCRIPTION'
                                   AND up.end_date >= CURRENT_TIMESTAMP
                                   AND up.end_date < CURRENT_TIMESTAMP + (:upcomingDays * INTERVAL '1 day')
                                   THEN COALESCE(pp.actual_price, 0)
                              ELSE 0 END AS upcoming,
                         (up.status = 'ACTIVE'
                            AND COALESCE(po.type, 'ONE_TIME') NOT IN ('CPO', 'SUBSCRIPTION', 'FREE', 'DONATION')
                            AND COALESCE(pp.actual_price, 0) > 0
                            AND COALESCE(pd.amt, 0) = 0
                            AND COALESCE(ei.tag, '') <> 'SUBORG_LEARNER'
                            AND COALESCE(up.source, 'USER') <> 'SUB_ORG') AS activated_without_payment,
                         COALESCE(cs.pending_installments, 0) AS pending_installments,
                         cs.next_due_date AS next_due_date,
                         UPPER(COALESCE(NULLIF(TRIM(pp.currency), ''),
                                        NULLIF(TRIM(ei.currency), ''))) AS currency,
                         up.created_at AS created_at
                    FROM user_plan up
                    JOIN enroll_invite ei ON ei.id = up.enroll_invite_id
                    LEFT JOIN payment_option po ON po.id = up.payment_option_id
                    LEFT JOIN payment_plan pp ON pp.id = up.plan_id
                    LEFT JOIN cpo_sched cs ON cs.user_plan_id = up.id
                    LEFT JOIN plan_paid pd ON pd.user_plan_id = up.id
                   WHERE ei.institute_id = :instituteId
                     AND up.created_at >= :startDate
                     AND up.created_at <= :endDate
                     AND (:noPackageSessions = true OR EXISTS (
                           SELECT 1
                             FROM package_session_learner_invitation_to_payment_option psli
                            WHERE psli.enroll_invite_id = ei.id
                              AND psli.status = 'ACTIVE'
                              AND psli.package_session_id IN (:packageSessionIds)))
                ), invoice_obligations AS (
                  -- Invoices raised against the institute directly. They carry no user_plan and no
                  -- package session, so they count only for the whole institute, never inside a
                  -- course-filtered view. REJECTED is a voided invoice: visible in the table
                  -- (struck through) but neither collected nor owed.
                  SELECT inv.id AS user_plan_id,
                         inv.user_id AS user_id,
                         'Invoice' AS course_name,
                         'PENDING_PAYMENT' AS plan_status,
                         'INVOICE' AS kind,
                         'User Invoice' AS payment_type,
                         true AS is_live,
                         false AS is_plan,
                         COALESCE(inv.total_amount, 0) AS billed,
                         0 AS paid,
                         CASE WHEN inv.due_date IS NULL OR inv.due_date < CURRENT_TIMESTAMP
                              THEN COALESCE(inv.total_amount, 0) ELSE 0 END AS overdue,
                         CASE WHEN inv.due_date >= CURRENT_TIMESTAMP
                                   AND inv.due_date < CURRENT_TIMESTAMP + (:upcomingDays * INTERVAL '1 day')
                              THEN COALESCE(inv.total_amount, 0) ELSE 0 END AS upcoming,
                         false AS activated_without_payment,
                         0 AS pending_installments,
                         CAST(inv.due_date AS date) AS next_due_date,
                         UPPER(NULLIF(TRIM(inv.currency), '')) AS currency,
                         inv.created_at AS created_at
                    FROM invoice inv
                   WHERE inv.institute_id = :instituteId
                     AND inv.created_at >= :startDate
                     AND inv.created_at <= :endDate
                     AND inv.status <> 'REJECTED'
                     AND :noPackageSessions = true
                     AND NOT EXISTS (SELECT 1 FROM invoice_payment_log_mapping um
                                      WHERE um.invoice_id = inv.id)
                ), obligations AS (
                  SELECT * FROM plan_obligations
                  UNION ALL
                  SELECT * FROM invoice_obligations
                )
                """;

        /**
         * Every enrolment one learner holds at an institute, priced individually — the Due side
         * view.
         *
         * Deliberately NOT filtered by status. {@link #findOutstandingLearners} answers "how much
         * is owed" and so bills only live plans; this answers "why", and an admin cannot check that
         * a cancelled enrolment was excluded if the row is missing entirely. {@code countsTowardsDue}
         * carries the same rule as the card — a live CPO or subscription plan (or invoice) — so the
         * rows that DO count always re-add to the figure on it. A one-time purchase is returned with
         * the flag off: it is shown so the admin sees what the learner holds, but it owes nothing.
         */
        @Query(value = DUE_OBLIGATION_CTES + """
                SELECT o.user_plan_id AS userPlanId,
                       o.course_name AS courseName,
                       o.plan_status AS planStatus,
                       o.payment_type AS paymentType,
                       o.billed AS billed,
                       o.paid AS paid,
                       o.overdue AS due,
                       o.upcoming AS upcoming,
                       (o.is_live AND o.kind IN ('CPO', 'SUBSCRIPTION', 'INVOICE')) AS countsTowardsDue,
                       o.currency AS currency
                  FROM obligations o
                 WHERE o.user_id = :userId
                 ORDER BY (o.is_live AND o.kind IN ('CPO', 'SUBSCRIPTION', 'INVOICE')) DESC,
                          o.overdue DESC, o.upcoming DESC, o.billed DESC, o.created_at DESC
                """, nativeQuery = true)
        List<LearnerPlanBreakdownProjection> findLearnerPlanBreakdown(
                        @Param("instituteId") String instituteId,
                        @Param("userId") String userId,
                        @Param("startDate") LocalDateTime startDate,
                        @Param("endDate") LocalDateTime endDate,
                        @Param("noPackageSessions") boolean noPackageSessions,
                        @Param("packageSessionIds") List<String> packageSessionIds,
                        @Param("upcomingDays") int upcomingDays);

        /**
         * Collected / Due / Upcoming for the KPI cards.
         *
         * Collected is the PAID payment logs in the window — money that actually arrived. Due and
         * Upcoming come from {@link #DUE_OBLIGATION_CTES}: what learners with access still owe now,
         * and what falls due within the horizon. The two halves are independent by design — a
         * payment settles an obligation at its source (instalment, renewal, invoice), so there is
         * nothing to net here, and Total is simply collected + due.
         *
         * The PAID side is pre-aggregated and joined rather than looked up per plan: as a
         * correlated subquery this took 33 s on an institute with 8,380 live plans, 172 ms this way.
         */
        @Query(value = DUE_OBLIGATION_CTES + """
                , paid AS (
                  SELECT SUM(pl.payment_amount) AS amt, COUNT(*) AS cnt
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
                ), live AS (
                  SELECT * FROM obligations WHERE is_live
                )
                SELECT (SELECT COALESCE(amt, 0) FROM paid) AS collected,
                       (SELECT COALESCE(SUM(overdue), 0) FROM live) AS due,
                       (SELECT COALESCE(SUM(upcoming), 0) FROM live) AS upcoming,
                       (SELECT COUNT(DISTINCT user_id) FROM live WHERE overdue > 0) AS learnersOwing,
                       (SELECT COUNT(DISTINCT user_id) FROM live WHERE upcoming > 0) AS learnersUpcoming,
                       (SELECT COUNT(*) FROM live WHERE is_plan) AS planCount,
                       (SELECT COUNT(*) FROM live WHERE activated_without_payment)
                         AS activatedWithoutPaymentCount,
                       (SELECT currency FROM live WHERE currency IS NOT NULL
                         GROUP BY currency ORDER BY COUNT(*) DESC LIMIT 1) AS currency
                """, nativeQuery = true)
        BillingSummaryProjection getBillingSummary(
                        @Param("instituteId") String instituteId,
                        @Param("startDate") LocalDateTime startDate,
                        @Param("endDate") LocalDateTime endDate,
                        @Param("noPackageSessions") boolean noPackageSessions,
                        @Param("packageSessionIds") List<String> packageSessionIds,
                        @Param("upcomingDays") int upcomingDays);

        /**
         * The learners behind the "Due payment" card: who owes money now, how much, what falls due
         * next, and (for CPO) their instalment position. Built on the same
         * {@link #DUE_OBLIGATION_CTES}, so these rows always add up to the card above them.
         *
         * A learner appears only while something is overdue; upcoming alone does not list them —
         * that is money expected, not money owed.
         */
        @Query(value = DUE_OBLIGATION_CTES + """
                SELECT o.user_id AS userId,
                       (array_agg(o.course_name ORDER BY o.overdue DESC, o.upcoming DESC))[1] AS courseName,
                       (array_agg(o.payment_type ORDER BY o.overdue DESC, o.upcoming DESC))[1] AS paymentType,
                       (array_agg(o.plan_status ORDER BY o.overdue DESC, o.upcoming DESC))[1] AS planStatus,
                       SUM(o.billed) AS billed,
                       SUM(o.paid) AS paid,
                       SUM(o.overdue) AS due,
                       SUM(o.upcoming) AS upcoming,
                       COUNT(*) FILTER (WHERE o.is_plan) AS planCount,
                       SUM(o.pending_installments) AS pendingInstallments,
                       MIN(o.next_due_date) AS nextDueDate,
                       MAX(o.currency) AS currency
                  FROM obligations o
                 WHERE o.is_live
                 GROUP BY o.user_id
                HAVING SUM(o.overdue) > 0
                 ORDER BY due DESC
                """, countQuery = DUE_OBLIGATION_CTES + """
                SELECT COUNT(*)
                  FROM (SELECT o.user_id
                          FROM obligations o
                         WHERE o.is_live
                         GROUP BY o.user_id
                        HAVING SUM(o.overdue) > 0) owing
                """, nativeQuery = true)
        Page<OutstandingLearnerProjection> findOutstandingLearners(
                        @Param("instituteId") String instituteId,
                        @Param("startDate") LocalDateTime startDate,
                        @Param("endDate") LocalDateTime endDate,
                        @Param("noPackageSessions") boolean noPackageSessions,
                        @Param("packageSessionIds") List<String> packageSessionIds,
                        @Param("upcomingDays") int upcomingDays,
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