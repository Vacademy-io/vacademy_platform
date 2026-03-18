package vacademy.io.media_service.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.media_service.entity.InstituteShortLinkDomain;

import java.util.Optional;

@Repository
public interface InstituteShortLinkDomainRepository extends JpaRepository<InstituteShortLinkDomain, String> {
    Optional<InstituteShortLinkDomain> findByInstituteId(String instituteId);
}
