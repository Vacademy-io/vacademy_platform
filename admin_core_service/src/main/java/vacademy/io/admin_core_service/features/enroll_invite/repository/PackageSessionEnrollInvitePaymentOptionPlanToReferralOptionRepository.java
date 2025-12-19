package vacademy.io.admin_core_service.features.enroll_invite.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.enroll_invite.entity.PackageSessionEnrollInvitePaymentOptionPlanToReferralOption;
import vacademy.io.admin_core_service.features.enroll_invite.entity.PackageSessionLearnerInvitationToPaymentOption;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentPlan;
import vacademy.io.admin_core_service.features.user_subscription.entity.ReferralOption;

import java.util.List;
import java.util.Optional;

@Repository
public interface PackageSessionEnrollInvitePaymentOptionPlanToReferralOptionRepository
        extends JpaRepository<PackageSessionEnrollInvitePaymentOptionPlanToReferralOption, String> {

    @Query(value = """
            SELECT inro.*
            FROM package_session_enroll_invite_payment_plan_to_referral_option inro
            JOIN package_session_learner_invitation_to_payment_option pslepo
              ON pslepo.id = inro.package_session_invite_payment_option_id
            JOIN enroll_invite ei
              ON ei.id = pslepo.enroll_invite_id
            JOIN package_session ps
              ON ps.id = pslepo.package_session_id
            JOIN package p
              ON p.id = ps.package_id
            WHERE inro.referral_option_id IN :referralOptionIds
              AND inro.status IN :referralOptionStatus
              AND pslepo.status IN :packageSessionLearnerInvitationPaymentOptionStatus
              AND ei.status IN :enrollInviteStatus
              AND ps.status != 'DELETED'
              AND p.status != 'DELETED'
            """, nativeQuery = true)
    List<PackageSessionEnrollInvitePaymentOptionPlanToReferralOption> findByReferralOptionIds(
            List<String> referralOptionIds,
            List<String> referralOptionStatus,
            List<String> packageSessionLearnerInvitationPaymentOptionStatus,
            List<String> enrollInviteStatus);

    @Query("SELECT psr FROM PackageSessionEnrollInvitePaymentOptionPlanToReferralOption psr " +
            "WHERE psr.packageSessionLearnerInvitationToPaymentOption = :mapping " +
            "AND psr.paymentPlan = :paymentPlan " +
            "AND psr.status IN :status")
    Optional<PackageSessionEnrollInvitePaymentOptionPlanToReferralOption> findByPackageSessionLearnerInvitationToPaymentOptionAndPaymentPlanAndStatusIn(
            @Param("mapping") PackageSessionLearnerInvitationToPaymentOption packageSessionLearnerInvitationToPaymentOption,
            @Param("paymentPlan") PaymentPlan paymentPlan,
            @Param("status") List<String> status);

    @Modifying
    @Query(value = """
            UPDATE package_session_enroll_invite_payment_plan_to_referral_option
            SET status = :status
            WHERE package_session_invite_payment_option_id IN (:packageSessionLearnerInvitationToPaymentOptionIds)
            """, nativeQuery = true)
    void updateStatusByPackageSessionLearnerInvitationToPaymentOptionIds(
            @Param("packageSessionLearnerInvitationToPaymentOptionIds") List<String> packageSessionLearnerInvitationToPaymentOptionIds,
            @Param("status") String status);

    @Query("SELECT psr FROM PackageSessionEnrollInvitePaymentOptionPlanToReferralOption psr " +
            "WHERE psr.packageSessionLearnerInvitationToPaymentOption = :mapping " +
            "AND psr.paymentPlan = :paymentPlan " +
            "AND psr.referralOption = :referralOption " +
            "AND psr.status IN :status")
    Optional<PackageSessionEnrollInvitePaymentOptionPlanToReferralOption> findByPackageSessionLearnerInvitationToPaymentOptionAndPaymentPlanAndReferralOptionAndStatusIn(
            @Param("mapping") PackageSessionLearnerInvitationToPaymentOption packageSessionLearnerInvitationToPaymentOption,
            @Param("paymentPlan") PaymentPlan paymentPlan,
            @Param("referralOption") ReferralOption referralOption,
            @Param("status") List<String> status);

}
