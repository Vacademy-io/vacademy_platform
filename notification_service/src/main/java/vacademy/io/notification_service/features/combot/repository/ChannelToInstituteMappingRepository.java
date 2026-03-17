package vacademy.io.notification_service.features.combot.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.notification_service.features.combot.entity.ChannelToInstituteMapping;

import java.util.Optional;

@Repository
public interface ChannelToInstituteMappingRepository extends JpaRepository<ChannelToInstituteMapping, String> {
    
    /**
     * Find channel mapping by institute ID
     */
    Optional<ChannelToInstituteMapping> findByInstituteId(String instituteId);
}