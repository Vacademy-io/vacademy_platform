package vacademy.io.admin_core_service.features.youtube.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.youtube.entity.YoutubeUploadDefaults;

@Repository
public interface YoutubeUploadDefaultsRepository
        extends JpaRepository<YoutubeUploadDefaults, String> {
}
