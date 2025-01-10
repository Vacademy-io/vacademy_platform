package vacademy.io.common.payment.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vacademy.io.common.payment.entity.WebhookEventLog;

public interface WebhookEventLogRepository extends JpaRepository<WebhookEventLog, String> {
}
