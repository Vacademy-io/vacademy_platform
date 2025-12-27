package vacademy.io.notification_service.features.combot.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.notification_service.features.combot.entity.EngagementTriggerConfig;

import java.util.List;

@Repository
public interface EngagementTriggerConfigRepository extends JpaRepository<EngagementTriggerConfig, String> {
    
    /**
     * Find active trigger configs for a specific source
     */
    List<EngagementTriggerConfig> findBySourceTypeAndSourceIdentifierAndIsActiveTrue(
            String sourceType, 
            String sourceIdentifier
    );
    
    /**
     * Find all active trigger configs by institute
     */
    List<EngagementTriggerConfig> findByInstituteIdAndIsActiveTrue(String instituteId);
}
