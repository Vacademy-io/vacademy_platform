package vacademy.io.notification_service.features.combot.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.notification_service.features.combot.entity.ChannelToInstituteMapping;

@Repository
public interface ChannelToInstituteMappingRepository extends JpaRepository<ChannelToInstituteMapping, String> {
}