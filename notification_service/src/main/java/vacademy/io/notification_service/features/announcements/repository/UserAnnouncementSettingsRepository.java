package vacademy.io.notification_service.features.announcements.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.notification_service.features.announcements.entity.UserAnnouncementSetting;
import vacademy.io.notification_service.features.announcements.enums.AnnouncementChannel;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserAnnouncementSettingsRepository extends JpaRepository<UserAnnouncementSetting, String> {

    List<UserAnnouncementSetting> findByUserIdAndInstituteId(String userId, String instituteId);

    Optional<UserAnnouncementSetting> findByUserIdAndInstituteIdAndChannelAndSourceIdentifier(
            String userId,
            String instituteId,
            AnnouncementChannel channel,
            String sourceIdentifier
    );
}

