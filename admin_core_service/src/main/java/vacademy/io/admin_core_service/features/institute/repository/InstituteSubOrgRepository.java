package vacademy.io.admin_core_service.features.institute.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.institute.entity.InstituteSubOrg;

import java.util.Collection;
import java.util.List;

@Repository
public interface InstituteSubOrgRepository extends JpaRepository<InstituteSubOrg, String> {
    List<InstituteSubOrg> findByInstituteId(String instituteId);

    /** Paginated variant for the Manage VLEs listing (sort + page carried by Pageable). */
    Page<InstituteSubOrg> findByInstituteId(String instituteId, Pageable pageable);

    /**
     * Assignment-scoped variant of the listing: only the sub-orgs whose ids are in
     * {@code suborgIds}. Used for callers whose sub-org visibility is limited to the
     * channel partners assigned to them (see {@code SubOrgAccessScopeService}), so
     * paging + total counts are computed over the scoped set — never the full network.
     * Never call with an empty collection; short-circuit to an empty page instead.
     */
    Page<InstituteSubOrg> findByInstituteIdAndSuborgIdIn(
            String instituteId, Collection<String> suborgIds, Pageable pageable);

    List<InstituteSubOrg> findByInstituteIdAndSuborgIdIn(
            String instituteId, Collection<String> suborgIds);

    List<InstituteSubOrg> findBySuborgId(String suborgId);
}
