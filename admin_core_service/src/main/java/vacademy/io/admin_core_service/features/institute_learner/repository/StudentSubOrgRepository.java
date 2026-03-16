package vacademy.io.admin_core_service.features.institute_learner.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.institute_learner.entity.StudentSubOrg;

import java.util.List;
import java.util.Optional;

@Repository
public interface StudentSubOrgRepository extends JpaRepository<StudentSubOrg, String> {

    Optional<StudentSubOrg> findByUserIdAndSubOrgId(String userId, String subOrgId);

    List<StudentSubOrg> findBySubOrgIdAndStatus(String subOrgId, String status);

    List<StudentSubOrg> findByUserIdAndStatus(String userId, String status);

    List<StudentSubOrg> findBySubOrgId(String subOrgId);

    List<StudentSubOrg> findByUserId(String userId);
}
