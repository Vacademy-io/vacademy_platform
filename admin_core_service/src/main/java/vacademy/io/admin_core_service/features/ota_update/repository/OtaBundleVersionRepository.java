package vacademy.io.admin_core_service.features.ota_update.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.ota_update.entity.OtaBundleVersion;

import java.util.List;
import java.util.Optional;

@Repository
public interface OtaBundleVersionRepository extends JpaRepository<OtaBundleVersion, String> {

    @Query("SELECT v FROM OtaBundleVersion v WHERE v.isActive = true " +
            "AND (v.platform = 'ALL' OR v.platform = :platform) " +
            "ORDER BY v.createdAt DESC")
    List<OtaBundleVersion> findActiveVersionsForPlatform(@Param("platform") String platform);

    Optional<OtaBundleVersion> findByVersion(String version);

    Page<OtaBundleVersion> findAllByOrderByCreatedAtDesc(Pageable pageable);
}
