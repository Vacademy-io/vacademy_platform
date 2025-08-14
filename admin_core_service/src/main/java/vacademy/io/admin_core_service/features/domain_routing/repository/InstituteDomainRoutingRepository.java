package vacademy.io.admin_core_service.features.domain_routing.repository;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.CrudRepository;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.domain_routing.entity.InstituteDomainRouting;

import java.util.List;
import java.util.Optional;

@Repository
public interface InstituteDomainRoutingRepository extends CrudRepository<InstituteDomainRouting, String> {

    List<InstituteDomainRouting> findByInstituteId(String instituteId);

    @Query(value = """
            SELECT *
            FROM institute_domain_routing
            WHERE LOWER(domain) = LOWER(:domain)
              AND (LOWER(subdomain) = LOWER(:subdomain) OR subdomain = '*')
            ORDER BY CASE WHEN subdomain = '*' THEN 1 ELSE 0 END DESC
            LIMIT 1
            """, nativeQuery = true)
    Optional<InstituteDomainRouting> resolveMapping(@Param("domain") String domain,
                                                    @Param("subdomain") String subdomain);
}


