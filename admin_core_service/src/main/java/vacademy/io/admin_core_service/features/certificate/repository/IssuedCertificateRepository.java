package vacademy.io.admin_core_service.features.certificate.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.certificate.entity.IssuedCertificate;

import java.util.Optional;

@Repository
public interface IssuedCertificateRepository extends JpaRepository<IssuedCertificate, String> {

    Optional<IssuedCertificate> findFirstByUserIdAndPackageSessionIdOrderByIssuedAtDesc(
            String userId, String packageSessionId);
}
