package vacademy.io.notification_service.features.announcements.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.notification_service.features.announcements.entity.RichTextData;

@Repository
public interface RichTextDataRepository extends JpaRepository<RichTextData, String> {
}