package vacademy.io.admin_core_service.features.enroll_invite.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.enroll_invite.entity.EnrollInvite;
import vacademy.io.admin_core_service.features.enroll_invite.entity.PackageSessionLearnerInvitationToPaymentOption;

import java.util.List;

@Repository
public interface PackageSessionLearnerInvitationToPaymentOptionRepository extends JpaRepository<PackageSessionLearnerInvitationToPaymentOption, String> {
    List<PackageSessionLearnerInvitationToPaymentOption> findByEnrollInviteAndStatusIn(
            EnrollInvite enrollInvite,
            List<String> statusList
    );

    @Query("SELECT psl " +
            "FROM PackageSessionLearnerInvitationToPaymentOption psl " +
            "JOIN psl.packageSession ps " +
            "JOIN ps.packageEntity p " +
            "WHERE psl.paymentOption.id IN :paymentOptionIds " +
            "AND psl.enrollInvite.status IN :enrollInviteStatuses " +
            "AND psl.status IN :invitationStatuses " +
            "AND ps.status != 'DELETED' " +
            "AND p.status != 'DELETED'")
    List<PackageSessionLearnerInvitationToPaymentOption> findByCriteria(
            @Param("paymentOptionIds") List<String> paymentOptionIds,
            @Param("enrollInviteStatuses") List<String> enrollInviteStatuses,
            @Param("invitationStatuses") List<String> invitationStatuses
    );

    List<PackageSessionLearnerInvitationToPaymentOption> findByEnrollInvite_IdInAndStatusIn(
            List<String> enrollInviteIds,
            List<String> statusList
    );

    @Modifying
    @Query("UPDATE PackageSessionLearnerInvitationToPaymentOption psl " +
            "SET psl.status = :status " +
            "WHERE psl.id IN :ids")
    void updateStatusByIds(List<String> ids, String status);

    List<PackageSessionLearnerInvitationToPaymentOption> findByEnrollInvite_IdInAndPaymentOption_IdInAndPackageSession_IdInAndStatusIn(List<String>enrollInviteIds,List<String>paymentOptionIds,List<String>packageSessionIds,List<String>status);

    @Query("SELECT p.packageSession.id FROM PackageSessionLearnerInvitationToPaymentOption p WHERE p.enrollInvite = :enrollInvite AND p.status IN :status")
    List<String> findPackageSessionIdsByEnrollInviteAndStatusIn(@Param("enrollInvite") EnrollInvite enrollInvite, @Param("status") List<String> status);
}