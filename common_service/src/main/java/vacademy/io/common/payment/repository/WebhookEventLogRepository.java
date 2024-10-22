package vacademy.io.common.payment.repository;

import vacademy.io.common.payment.entity.WebhookEventLog;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WebhookEventLogRepository extends JpaRepository<WebhookEventLog, String> {
}
