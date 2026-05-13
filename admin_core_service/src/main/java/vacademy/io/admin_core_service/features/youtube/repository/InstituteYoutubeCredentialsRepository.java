package vacademy.io.admin_core_service.features.youtube.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.youtube.entity.InstituteYoutubeCredentials;

import java.util.Optional;

@Repository
public interface InstituteYoutubeCredentialsRepository
        extends JpaRepository<InstituteYoutubeCredentials, String> {

    Optional<InstituteYoutubeCredentials> findByInstituteIdAndStatus(String instituteId, String status);
}
