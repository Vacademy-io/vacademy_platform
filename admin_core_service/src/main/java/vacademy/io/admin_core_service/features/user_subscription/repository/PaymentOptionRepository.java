package vacademy.io.admin_core_service.features.user_subscription.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentOption;

import java.util.List;

@Repository
public interface PaymentOptionRepository extends JpaRepository<PaymentOption, String> {

    @Query(value = """
    SELECT po.*
    FROM payment_option po
    LEFT JOIN payment_plan pp ON po.id = pp.payment_option_id
    WHERE (:types IS NULL OR po.type IN (:types))
      AND (:source IS NULL OR po.source = :source)
      AND (:sourceId IS NULL OR po.source_id = :sourceId)
      AND (:paymentOptionStatuses IS NULL OR po.status IN (:paymentOptionStatuses))
      AND (
          -- This block now correctly includes payment options that have NO payment plans,
          -- even when filtering by payment plan status.
          :paymentPlanStatuses IS NULL
          OR NOT EXISTS (SELECT 1 FROM payment_plan pp_sub WHERE pp_sub.payment_option_id = po.id)
          OR EXISTS (
              SELECT 1
              FROM payment_plan pp2
              WHERE pp2.payment_option_id = po.id AND pp2.status IN (:paymentPlanStatuses)
          )
      )
      AND (
          (:requireApproval = true AND po.require_approval = true) OR
          (:notRequireApproval = true AND po.require_approval = false) OR
          (:requireApproval = false AND :notRequireApproval = false)
      )
    GROUP BY po.id, po.name, po.status, po.source, po.source_id, po.tag, po.type, po.require_approval, po.created_at, po.updated_at
    ORDER BY po.created_at DESC, MAX(pp.created_at) DESC NULLS LAST
""", nativeQuery = true)
    List<PaymentOption> findPaymentOptionsWithPaymentPlansNative(
            @Param("types") List<String> types,
            @Param("source") String source,
            @Param("sourceId") String sourceId,
            @Param("paymentOptionStatuses") List<String> paymentOptionStatuses,
            @Param("paymentPlanStatuses") List<String> paymentPlanStatuses,
            @Param("requireApproval") boolean requireApproval,
            @Param("notRequireApproval") boolean notRequireApproval
    );

}