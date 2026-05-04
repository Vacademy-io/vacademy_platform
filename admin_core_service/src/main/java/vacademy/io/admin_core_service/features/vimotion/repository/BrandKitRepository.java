package vacademy.io.admin_core_service.features.vimotion.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.vimotion.entity.BrandKit;

import java.util.List;
import java.util.Optional;

@Repository
public interface BrandKitRepository extends JpaRepository<BrandKit, String> {

    List<BrandKit> findByInstituteIdOrderByIsDefaultDescCreatedAtDesc(String instituteId);

    Optional<BrandKit> findByIdAndInstituteId(String id, String instituteId);

    Optional<BrandKit> findFirstByInstituteIdAndIsDefaultTrue(String instituteId);

    boolean existsByInstituteId(String instituteId);

    @Modifying
    @Query("UPDATE BrandKit b SET b.isDefault = false WHERE b.instituteId = :instituteId AND b.id <> :exceptId AND b.isDefault = true")
    int clearOtherDefaults(@Param("instituteId") String instituteId, @Param("exceptId") String exceptId);

    @Modifying
    @Query("UPDATE BrandKit b SET b.isDefault = false WHERE b.instituteId = :instituteId AND b.isDefault = true")
    int clearAllDefaults(@Param("instituteId") String instituteId);
}
