package vacademy.io.admin_core_service.features.user_subscription.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
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
   * originalRequest.order_id JSON path.
   * This is more specific than findAllByOrderIdInJson and ensures exact matching
   * of the order_id field.
   * Note: Using CAST() instead of ::text because JPA interprets : as named
   * parameter prefix.
   */
  @Query(value = "SELECT * FROM payment_log WHERE CAST(payment_specific_data AS TEXT) LIKE CONCAT('%\"order_id\":\"', :orderId, '\"%')", nativeQuery = true)
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
      LEFT JOIN FETCH up.paymentOption po
      LEFT JOIN FETCH up.paymentPlan pp
      WHERE pl.id IN :ids
      ORDER BY pl.createdAt DESC
      """)
  List<PaymentLog> findPaymentLogsWithRelationshipsByIds(@Param("ids") List<String> ids);

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

}