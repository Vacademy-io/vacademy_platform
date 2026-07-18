package vacademy.io.admin_core_service.features.certificate.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.certificate.entity.IssuedCertificate;

import java.util.List;
import java.util.Optional;

@Repository
public interface IssuedCertificateRepository extends JpaRepository<IssuedCertificate, String> {

    Optional<IssuedCertificate> findFirstByUserIdAndPackageSessionIdOrderByIssuedAtDesc(
            String userId, String packageSessionId);

    /** A learner's certificates in one institute, newest first (learner + parent read path). */
    List<IssuedCertificate> findByUserIdAndInstituteIdOrderByIssuedAtDesc(String userId, String instituteId);

    /**
     * A single certificate scoped to its owner — the sub-resource ownership check.
     * The guard proves parent&rarr;child; this proves certificate&rarr;child, so a parent
     * can't download a certificate that isn't their child's.
     */
    Optional<IssuedCertificate> findByIdAndUserId(String id, String userId);
}
