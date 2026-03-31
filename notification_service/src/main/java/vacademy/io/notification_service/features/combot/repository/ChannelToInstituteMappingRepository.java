package vacademy.io.notification_service.features.combot.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.notification_service.features.combot.entity.ChannelToInstituteMapping;

import java.util.List;
import java.util.Optional;

@Repository
public interface ChannelToInstituteMappingRepository extends JpaRepository<ChannelToInstituteMapping, String> {

    /**
     * Find first channel mapping by institute ID (legacy, returns single)
     */
    Optional<ChannelToInstituteMapping> findByInstituteId(String instituteId);

    /**
     * Find ALL channel mappings for an institute (supports multi-channel)
     */
    List<ChannelToInstituteMapping> findAllByInstituteId(String instituteId);
}