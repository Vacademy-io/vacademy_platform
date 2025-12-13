package vacademy.io.notification_service.features.combot.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.notification_service.features.combot.entity.ChannelFlowConfig;

import java.util.Optional;

@Repository
public interface ChannelFlowConfigRepository extends JpaRepository<ChannelFlowConfig, String> {
    Optional<ChannelFlowConfig> findByInstituteIdAndCurrentTemplateNameAndChannelTypeAndIsActiveTrue(
            String instituteId, String currentTemplateName, String channelType
    );
}