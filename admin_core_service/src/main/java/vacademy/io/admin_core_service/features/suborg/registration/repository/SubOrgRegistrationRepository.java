package vacademy.io.admin_core_service.features.suborg.registration.repository;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vacademy.io.admin_core_service.features.suborg.registration.entity.SubOrgRegistration;

import java.util.List;
import java.util.Optional;

public interface SubOrgRegistrationRepository
        extends JpaRepository<SubOrgRegistration, String>,
        JpaSpecificationExecutor<SubOrgRegistration> {

    long countByTemplateInviteIdAndStatus(String templateInviteId, String status);

    long countByTemplateInviteId(String templateInviteId);

    boolean existsByTemplateInviteIdAndAdminEmailIgnoreCaseAndStatusIn(
            String templateInviteId, String adminEmail, List<String> statuses);

    /** Webhook lookup: flip PENDING_PAYMENT → COMPLETED once the spawned sub-org's plan activates. */
    Optional<SubOrgRegistration> findFirstBySpawnedSubOrgIdAndStatus(String spawnedSubOrgId, String status);

    /** Newest resumable registration for (template, email) — resume entry point. */
    Optional<SubOrgRegistration> findFirstByTemplateInviteIdAndAdminEmailIgnoreCaseAndStatusInOrderByCreatedAtDesc(
            String templateInviteId, String adminEmail, List<String> statuses);

    /** All rows that currently block a fresh /start for (template, email). */
    List<SubOrgRegistration> findAllByTemplateInviteIdAndAdminEmailIgnoreCaseAndStatusIn(
            String templateInviteId, String adminEmail, List<String> statuses);

    /** KYC webhook lookup by the verification id we sent to Cashfree SecureID. */
    Optional<SubOrgRegistration> findFirstByKycVerificationId(String kycVerificationId);

    /** Pessimistic lock for the complete/spawn transition — guards double-submit. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT r FROM SubOrgRegistration r WHERE r.id = :id")
    Optional<SubOrgRegistration> findWithLockById(@Param("id") String id);
}
