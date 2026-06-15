package vacademy.io.admin_core_service.features.user_subscription.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.user_subscription.dto.PaymentLogWithUserPlanProjection;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentLog;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface PaymentLogRepository extends JpaRepository<PaymentLog, String> {

  @Query(value = "SELECT * FROM payment_log WHERE CAST(payment_specific_data AS TEXT) LIKE CONCAT('%', :orderId, '%')", nativeQuery = true)
  List<PaymentLog> findAllByOrderIdInJson(@Param("orderId") String orderId);

  /**
   * Find all payment logs where the orderId matches within the
   * originalRequest JSON (order_id snake_case or orderId camelCase).
   * CASHFREE/PhonePe webhooks send order_id; we store originalRequest with
   * orderId (camelCase) after order creation, so we match both.
   */
  @Query(value = "SELECT * FROM payment_log WHERE CAST(payment_specific_data AS TEXT) LIKE CONCAT('%\"order_id\":\"', :orderId, '\"%') OR CAST(payment_specific_data AS TEXT) LIKE CONCAT('%\"orderId\":\"', :orderId, '\"%')", nativeQuery = true)
  List<PaymentLog> findAllByOrderIdInOriginalRequest(@Param("orderId") String orderId);

  @Query("SELECT pl FROM PaymentLog pl WHERE pl.userPlan.id = :userPlanId ORDER BY pl.createdAt DESC")
  List<PaymentLog> findByUserPlanIdOrderByCreatedAtDesc(@Param("userPlanId") String userPlanId);

  @Query(value = """
            SELECT DISTINCT pl FROM PaymentLog pl
            JOIN FETCH pl.userPlan up
            JOIN FETCH up.enrollInvite ei
            LEFT JOIN FETCH up.paymentOption po
            LEFT JOIN FETCH up.paymentPlan pp
            WHERE ei.instituteId = :instituteId
              AND pl.createdAt >= :startDate
              AND pl.createdAt <= :endDate

              AND (:#{#paymentStatuses == null || #paymentStatuses.isEmpty() ? 1 : 0} = 1 OR pl.paymentStatus IN (:paymentStatuses))

              AND (:#{#userPlanStatuses == null || #userPlanStatuses.isEmpty() ? 1 : 0} = 1 OR up.status IN (:userPlanStatuses))

              AND (:#{#sources == null || #sources.isEmpty() ? 1 : 0} = 1 OR up.source IN (:sources))

              AND (:#{#enrollInviteIds == null || #enrollInviteIds.isEmpty() ? 1 : 0} = 1 OR ei.id IN (:enrollInviteIds))

              AND (:#{#packageSessionIds == null || #packageSessionIds.isEmpty() ? 1 : 0} = 1 OR EXISTS (
                    SELECT 1
                    FROM PackageSessionLearnerInvitationToPaymentOption psli
                    WHERE psli.enrollInvite.id = ei.id
                      AND psli.status = 'ACTIVE'
                      AND psli.packageSession.id IN (:packageSessionIds)
                  ))
              AND (:#{#userId == null ? 1 : 0} = 1 OR up.userId = :userId)
              AND NOT EXISTS (
                    SELECT 1
                    FROM PackageSessionLearnerInvitationToPaymentOption psli_int
                    WHERE psli_int.enrollInvite.id = ei.id
                      AND psli_int.packageSession.packageEntity.packageType IN ('DELIVERY_CHARGE', 'SECURITY_DEPOSIT')
                  )
            ORDER BY pl.createdAt DESC
      """, countQuery = """
      SELECT COUNT(pl) FROM PaymentLog pl
      JOIN pl.userPlan up
      JOIN up.enrollInvite ei
      WHERE ei.instituteId = :instituteId
        AND pl.createdAt >= :startDate
        AND pl.createdAt <= :endDate
        AND (:#{#paymentStatuses == null || #paymentStatuses.isEmpty() ? 1 : 0} = 1 OR pl.paymentStatus IN (:paymentStatuses))
        AND (:#{#userPlanStatuses == null || #userPlanStatuses.isEmpty() ? 1 : 0} = 1 OR up.status IN (:userPlanStatuses))
        AND (:#{#sources == null || #sources.isEmpty() ? 1 : 0} = 1 OR up.source IN (:sources))
        AND (:#{#enrollInviteIds == null || #enrollInviteIds.isEmpty() ? 1 : 0} = 1 OR ei.id IN (:enrollInviteIds))
        AND (:#{#packageSessionIds == null || #packageSessionIds.isEmpty() ? 1 : 0} = 1 OR EXISTS (
              SELECT 1
              FROM PackageSessionLearnerInvitationToPaymentOption psli
              WHERE psli.enrollInvite.id = ei.id
                AND psli.status = 'ACTIVE'
                AND psli.packageSession.id IN (:packageSessionIds)
            ))
        AND (:#{#userId == null ? 1 : 0} = 1 OR up.userId = :userId)
        AND NOT EXISTS (
              SELECT 1
              FROM PackageSessionLearnerInvitationToPaymentOption psli_int
              WHERE psli_int.enrollInvite.id = ei.id
                AND psli_int.packageSession.packageEntity.packageType IN ('DELIVERY_CHARGE', 'SECURITY_DEPOSIT')
            )
      """)
  Page<PaymentLog> findPaymentLogIdsWithFilters(
      @Param("instituteId") String instituteId,
      @Param("startDate") LocalDateTime startDate,
      @Param("endDate") LocalDateTime endDate,
      @Param("paymentStatuses") List<String> paymentStatuses,
      @Param("userPlanStatuses") List<String> userPlanStatuses,
      @Param("sources") List<String> sources,
      @Param("enrollInviteIds") List<String> enrollInviteIds,
      @Param("packageSessionIds") List<String> packageSessionIds,
      @Param("userId") String userId,
      Pageable pageable);

  @Query("""
      SELECT DISTINCT pl FROM PaymentLog pl
      LEFT JOIN FETCH pl.userPlan up
      LEFT JOIN FETCH up.enrollInvite
      LEFT JOIN FETCH up.paymentOption po
      LEFT JOIN FETCH up.paymentPlan pp
      WHERE pl.id IN :ids
      ORDER BY pl.createdAt DESC
      """)
  List<PaymentLog> findPaymentLogsWithRelationshipsByIds(@Param("ids") List<String> ids);

  /**
   * Combined paginated query: returns payment log IDs from both regular (via user_plan/enroll_invite)
   * and admin-created invoice paths (via invoice_payment_log_mapping).
   *
   * PostgreSQL cannot determine the type of a NULL List parameter in "? IS NULL" checks, so we use
   * typed boolean flags instead: when a filter flag is true the corresponding IN clause is skipped,
   * and the list param is always a non-null sentinel (e.g. "__none__") so the JDBC binding succeeds.
   * includeInvoiceLogs is false whenever any user-plan-specific filter is active (those filters don't
   * apply to invoice-path logs).
   */
  @Query(value = """
      SELECT combined.id FROM (
        SELECT pl.id, pl.created_at
        FROM payment_log pl
        JOIN user_plan up ON pl.user_plan_id = up.id
        JOIN enroll_invite ei ON up.enroll_invite_id = ei.id
        WHERE ei.institute_id = :instituteId
          AND pl.created_at >= :startDate
          AND pl.created_at <= :endDate
          AND (:noPaymentStatusFilter = true OR pl.payment_status IN (:paymentStatuses))
          AND (:noUserPlanStatusFilter = true OR up.status IN (:userPlanStatuses))
          AND (:noSourceFilter = true OR up.source IN (:sources))
          AND (:noEnrollInviteFilter = true OR ei.id IN (:enrollInviteIds))
          AND (:noPackageSessionFilter = true OR EXISTS (
                SELECT 1 FROM package_session_learner_invitation_to_payment_option psli
                WHERE psli.enroll_invite_id = ei.id AND psli.status = 'ACTIVE'
                  AND psli.package_session_id IN (:packageSessionIds)))
          AND (:userId IS NULL OR up.user_id = :userId)
          AND NOT EXISTS (
                SELECT 1 FROM package_session_learner_invitation_to_payment_option psli_int
                WHERE psli_int.enroll_invite_id = ei.id
                  AND psli_int.package_session_id IN (
                    SELECT ps.id FROM package_session ps
                    JOIN package pe ON ps.package_id = pe.id
                    WHERE pe.package_type IN ('DELIVERY_CHARGE', 'SECURITY_DEPOSIT')))
        UNION
        SELECT pl.id, pl.created_at
        FROM payment_log pl
        JOIN invoice_payment_log_mapping iplm ON pl.id = iplm.payment_log_id
        JOIN invoice i ON iplm.invoice_id = i.id
        WHERE :includeInvoiceLogs = true
          AND i.institute_id = :instituteId
          AND pl.created_at >= :startDate
          AND pl.created_at <= :endDate
          AND (:noPaymentStatusFilter = true OR pl.payment_status IN (:paymentStatuses))
          AND (:userId IS NULL OR i.user_id = :userId)
      ) combined
      ORDER BY combined.created_at DESC
      """,
      countQuery = """
      SELECT COUNT(*) FROM (
        SELECT pl.id
        FROM payment_log pl
        JOIN user_plan up ON pl.user_plan_id = up.id
        JOIN enroll_invite ei ON up.enroll_invite_id = ei.id
        WHERE ei.institute_id = :instituteId
          AND pl.created_at >= :startDate
          AND pl.created_at <= :endDate
          AND (:noPaymentStatusFilter = true OR pl.payment_status IN (:paymentStatuses))
          AND (:noUserPlanStatusFilter = true OR up.status IN (:userPlanStatuses))
          AND (:noSourceFilter = true OR up.source IN (:sources))
          AND (:noEnrollInviteFilter = true OR ei.id IN (:enrollInviteIds))
          AND (:noPackageSessionFilter = true OR EXISTS (
                SELECT 1 FROM package_session_learner_invitation_to_payment_option psli
                WHERE psli.enroll_invite_id = ei.id AND psli.status = 'ACTIVE'
                  AND psli.package_session_id IN (:packageSessionIds)))
          AND (:userId IS NULL OR up.user_id = :userId)
          AND NOT EXISTS (
                SELECT 1 FROM package_session_learner_invitation_to_payment_option psli_int
                WHERE psli_int.enroll_invite_id = ei.id
                  AND psli_int.package_session_id IN (
                    SELECT ps.id FROM package_session ps
                    JOIN package pe ON ps.package_id = pe.id
                    WHERE pe.package_type IN ('DELIVERY_CHARGE', 'SECURITY_DEPOSIT')))
        UNION
        SELECT pl.id
        FROM payment_log pl
        JOIN invoice_payment_log_mapping iplm ON pl.id = iplm.payment_log_id
        JOIN invoice i ON iplm.invoice_id = i.id
        WHERE :includeInvoiceLogs = true
          AND i.institute_id = :instituteId
          AND pl.created_at >= :startDate
          AND pl.created_at <= :endDate
          AND (:noPaymentStatusFilter = true OR pl.payment_status IN (:paymentStatuses))
          AND (:userId IS NULL OR i.user_id = :userId)
      ) count_q
      """,
      nativeQuery = true)
  Page<String> findCombinedPaymentLogIdsPaginated(
      @Param("instituteId") String instituteId,
      @Param("startDate") LocalDateTime startDate,
      @Param("endDate") LocalDateTime endDate,
      @Param("paymentStatuses") List<String> paymentStatuses,
      @Param("noPaymentStatusFilter") boolean noPaymentStatusFilter,
      @Param("userPlanStatuses") List<String> userPlanStatuses,
      @Param("noUserPlanStatusFilter") boolean noUserPlanStatusFilter,
      @Param("sources") List<String> sources,
      @Param("noSourceFilter") boolean noSourceFilter,
      @Param("enrollInviteIds") List<String> enrollInviteIds,
      @Param("noEnrollInviteFilter") boolean noEnrollInviteFilter,
      @Param("packageSessionIds") List<String> packageSessionIds,
      @Param("noPackageSessionFilter") boolean noPackageSessionFilter,
      @Param("userId") String userId,
      @Param("includeInvoiceLogs") boolean includeInvoiceLogs,
      Pageable pageable);

  /**
   * NATIVE QUERY REPLACEMENT for the Specification
   * This query finds paginated payment logs based on a set of dynamic filters.
   */
  @Query(value = """
      SELECT
        pl.id AS id,
        pl.status AS status,
        pl.payment_status AS paymentStatus,
        pl.user_id AS userId,
        pl.vendor AS vendor,
        pl.vendor_id AS vendorId,
        pl.date AS date,
        pl.currency AS currency,
        pl.payment_amount AS paymentAmount,
        pl.created_at AS createdAt,
        pl.updated_at AS updatedAt,
        pl.payment_specific_data AS paymentSpecificData,

        -- UserPlan fields
        up.id AS userPlanId,
        up.user_id AS userPlanUserId,
        up.plan_id AS userPlanPaymentPlanId,
        up.applied_coupon_discount_id AS userPlanAppliedCouponDiscountId,
        up.enroll_invite_id AS userPlanEnrollInviteId,
        up.payment_option_id AS userPlanPaymentOptionId,
        up.status AS userPlanStatus,
        up.created_at AS userPlanCreatedAt,
        up.updated_at AS userPlanUpdatedAt,

        -- Derived field
        CASE
          WHEN pl.payment_status = 'PAID' THEN 'PAID'
          WHEN pl.payment_status IS NULL THEN 'NOT_INITIATED'

          -- *** LOGIC FIX: Handle 'FAILED' status *before* other statuses ***
          WHEN pl.payment_status = 'FAILED' THEN
            COALESCE(
              (
                -- First, check if a *subsequent* user plan for this enrollment is ACTIVE
                SELECT 'PAID'
                FROM user_plan next_up
                WHERE next_up.user_id = up.user_id
                  AND next_up.enroll_invite_id = up.enroll_invite_id
                  AND next_up.created_at > up.created_at -- Must be after the plan associated with this failed log
                  AND next_up.status = 'ACTIVE' -- Must be an active (i.e., paid) plan
                ORDER BY next_up.created_at ASC
                LIMIT 1
              ),

              -- *** SYNTAX FIX: Removed apostrophe from "it's" ***
              'FAILED' -- If no subsequent active plan is found, then it is truly FAILED
            )

          -- All other statuses (e.g., 'PENDING', 'PROCESSING') fall through here
          ELSE pl.payment_status
        END AS currentPaymentStatus

      FROM payment_log pl
      LEFT JOIN user_plan up ON pl.user_plan_id = up.id
      LEFT JOIN enroll_invite ei ON up.enroll_invite_id = ei.id
      WHERE
        ei.institute_id = :instituteId
        AND (pl.created_at >= :startDate)
        AND (pl.created_at <= :endDate)
        AND (:paymentStatuses IS NULL OR pl.payment_status IN (:paymentStatuses))
        AND (:userPlanStatuses IS NULL OR up.status IN (:userPlanStatuses))
        AND (:enrollInviteIds IS NULL OR ei.id IN (:enrollInviteIds))
        AND (:packageSessionIds IS NULL OR EXISTS (
              SELECT 1
              FROM package_session_learner_invitation_to_payment_option psli
              WHERE psli.enroll_invite_id = ei.id
                AND psli.status = 'ACTIVE'
                AND psli.package_session_id IN (:packageSessionIds)
            ))
      """, countQuery = """
      SELECT COUNT(DISTINCT pl.id)
      FROM payment_log pl
      LEFT JOIN user_plan up ON pl.user_plan_id = up.id
      LEFT JOIN enroll_invite ei ON up.enroll_invite_id = ei.id
      WHERE
        ei.institute_id = :instituteId
        AND (pl.created_at >= :startDate)
        AND (pl.created_at <= :endDate)
        AND (:paymentStatuses IS NULL OR pl.payment_status IN (:paymentStatuses))
        AND (:userPlanStatuses IS NULL OR up.status IN (:userPlanStatuses))
        AND (:enrollInviteIds IS NULL OR ei.id IN (:enrollInviteIds))
        AND (:packageSessionIds IS NULL OR EXISTS (
              SELECT 1
              FROM package_session_learner_invitation_to_payment_option psli
              WHERE psli.enroll_invite_id = ei.id
                AND psli.status = 'ACTIVE'
                AND psli.package_session_id IN (:packageSessionIds)
            ))
      """, nativeQuery = true)
  Page<PaymentLogWithUserPlanProjection> findPaymentLogsByFiltersNative(
      @Param("instituteId") String instituteId,
      @Param("startDate") LocalDateTime startDate,
      @Param("endDate") LocalDateTime endDate,
      @Param("paymentStatuses") List<String> paymentStatuses,
      @Param("userPlanStatuses") List<String> userPlanStatuses,
      @Param("enrollInviteIds") List<String> enrollInviteIds,
      @Param("packageSessionIds") List<String> packageSessionIds,
      Pageable pageable);

  /**
   * Atomically claims a payment log for "paid" processing: flips it to the given paid/success
   * statuses only if it is not already paid, returning the number of rows changed.
   *
   * <p>Returns {@code 1} for the caller that wins the claim and {@code 0} for any caller that
   * finds it already paid. Used to dedupe Razorpay's concurrent {@code payment.captured} /
   * {@code order.paid} webhook events (and cross-replica duplicates / retries) so that
   * fee allocation and receipt/invoice generation run at most once. The single-statement
   * conditional UPDATE is atomic at the DB row level — unlike a read-then-check guard, two
   * concurrent webhook deliveries cannot both observe "not paid" and both proceed.</p>
   */
  @Modifying
  @Query("UPDATE PaymentLog p SET p.paymentStatus = :paidStatus, p.status = :successStatus "
      + "WHERE p.id = :id AND (p.paymentStatus IS NULL OR p.paymentStatus <> :paidStatus)")
  int markPaidIfNotAlready(@Param("id") String id,
      @Param("paidStatus") String paidStatus,
      @Param("successStatus") String successStatus);

}