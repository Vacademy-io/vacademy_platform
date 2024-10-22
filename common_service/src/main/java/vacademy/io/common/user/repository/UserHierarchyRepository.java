package vacademy.io.common.user.repository;

import vacademy.io.common.user.entity.UserHierarchy;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;


@Repository
public interface UserHierarchyRepository extends JpaRepository<UserHierarchy, String> {
    Optional<UserHierarchy> findTopByParentUserIdIsNullAndSiteId(String siteId);

    List<UserHierarchy> findByParentUserIdAndSiteId(String parentUserId, String siteId);

    Optional<UserHierarchy> findTopByUserIdAndSiteId(String userId, String siteId);

    List<UserHierarchy> findBySiteId(String siteId);

    @Transactional
    @Modifying
    Integer deleteBySiteId(String siteId);
}

