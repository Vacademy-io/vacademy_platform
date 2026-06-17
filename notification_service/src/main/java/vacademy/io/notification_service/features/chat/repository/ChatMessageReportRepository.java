package vacademy.io.notification_service.features.chat.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.notification_service.features.chat.entity.ChatMessageReport;

import java.util.Optional;

@Repository
public interface ChatMessageReportRepository extends JpaRepository<ChatMessageReport, String> {

    Page<ChatMessageReport> findByInstituteIdOrderByCreatedAtDesc(String instituteId, Pageable pageable);

    Page<ChatMessageReport> findByInstituteIdAndStatusOrderByCreatedAtDesc(String instituteId, String status, Pageable pageable);

    boolean existsByMessageIdAndReporterId(String messageId, String reporterId);

    Optional<ChatMessageReport> findByMessageIdAndReporterId(String messageId, String reporterId);
}
