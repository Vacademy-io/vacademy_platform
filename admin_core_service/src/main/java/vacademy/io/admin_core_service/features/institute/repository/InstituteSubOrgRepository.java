package vacademy.io.admin_core_service.features.institute.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.institute.entity.InstituteSubOrg;

import java.util.List;

@Repository
public interface InstituteSubOrgRepository extends JpaRepository<InstituteSubOrg, String> {
    List<InstituteSubOrg> findByInstituteId(String instituteId);

    /** Paginated variant for the Manage VLEs listing (sort + page carried by Pageable). */
    Page<InstituteSubOrg> findByInstituteId(String instituteId, Pageable pageable);

    List<InstituteSubOrg> findBySuborgId(String suborgId);
}
