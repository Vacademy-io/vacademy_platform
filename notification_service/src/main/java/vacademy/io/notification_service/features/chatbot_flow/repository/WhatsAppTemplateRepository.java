package vacademy.io.notification_service.features.chatbot_flow.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.notification_service.features.chatbot_flow.entity.WhatsAppTemplate;

import java.util.List;
import java.util.Optional;

@Repository
public interface WhatsAppTemplateRepository extends JpaRepository<WhatsAppTemplate, String> {

    List<WhatsAppTemplate> findByInstituteIdOrderByUpdatedAtDesc(String instituteId);

    List<WhatsAppTemplate> findByInstituteIdAndStatusOrderByUpdatedAtDesc(String instituteId, String status);

    Optional<WhatsAppTemplate> findByInstituteIdAndNameAndLanguage(String instituteId, String name, String language);

    List<WhatsAppTemplate> findByInstituteIdAndNameContainingIgnoreCaseOrInstituteIdAndBodyTextContainingIgnoreCase(
            String instituteId1, String name, String instituteId2, String bodyText);
}
