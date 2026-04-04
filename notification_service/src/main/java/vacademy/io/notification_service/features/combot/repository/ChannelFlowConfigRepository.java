package vacademy.io.notification_service.features.combot.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.notification_service.features.combot.entity.ChannelFlowConfig;

import java.util.List;
import java.util.Optional;

@Repository
public interface ChannelFlowConfigRepository extends JpaRepository<ChannelFlowConfig, String> {
    Optional<ChannelFlowConfig> findByInstituteIdAndCurrentTemplateNameAndChannelTypeAndIsActiveTrue(
            String instituteId, String currentTemplateName, String channelType);

    /**
     * Find all flow configs by institute and channel type.
     * Used for action routing in webhook processing — caller picks the first
     * one with action_template_config set.
     */
    List<ChannelFlowConfig> findAllByInstituteIdAndChannelTypeAndIsActiveTrue(
            String instituteId, String channelType);
}