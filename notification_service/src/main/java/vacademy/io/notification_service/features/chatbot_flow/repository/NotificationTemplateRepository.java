package vacademy.io.notification_service.features.chatbot_flow.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.notification_service.features.chatbot_flow.entity.NotificationTemplate;

import java.util.List;
import java.util.Optional;

@Repository
public interface NotificationTemplateRepository extends JpaRepository<NotificationTemplate, String> {

    List<NotificationTemplate> findByInstituteIdOrderByUpdatedAtDesc(String instituteId);

    List<NotificationTemplate> findByInstituteIdAndStatusOrderByUpdatedAtDesc(String instituteId, String status);

    Optional<NotificationTemplate> findByInstituteIdAndNameAndLanguage(String instituteId, String name, String language);

    List<NotificationTemplate> findByInstituteIdAndNameContainingIgnoreCaseOrInstituteIdAndBodyTextContainingIgnoreCase(
            String instituteId1, String name, String instituteId2, String bodyText);

    // New: filter by channel type
    List<NotificationTemplate> findByInstituteIdAndChannelTypeOrderByUpdatedAtDesc(String instituteId, String channelType);

    Optional<NotificationTemplate> findByInstituteIdAndNameAndChannelType(String instituteId, String name, String channelType);
}
