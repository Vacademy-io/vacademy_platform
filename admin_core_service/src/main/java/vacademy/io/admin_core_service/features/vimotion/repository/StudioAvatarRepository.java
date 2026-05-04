package vacademy.io.admin_core_service.features.vimotion.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.vimotion.entity.StudioAvatar;

import java.util.List;
import java.util.Optional;

@Repository
public interface StudioAvatarRepository extends JpaRepository<StudioAvatar, String> {

    List<StudioAvatar> findByInstituteIdOrderByCreatedAtDesc(String instituteId);

    Optional<StudioAvatar> findByIdAndInstituteId(String id, String instituteId);
}
