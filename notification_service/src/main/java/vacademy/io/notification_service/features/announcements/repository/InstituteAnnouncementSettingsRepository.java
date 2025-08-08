package vacademy.io.notification_service.features.announcements.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.notification_service.features.announcements.entity.InstituteAnnouncementSettings;

import java.util.Optional;

@Repository
public interface InstituteAnnouncementSettingsRepository extends JpaRepository<InstituteAnnouncementSettings, String> {
    
    Optional<InstituteAnnouncementSettings> findByInstituteId(String instituteId);
    
    boolean existsByInstituteId(String instituteId);
}