package vacademy.io.common.payment.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.common.payment.entity.WebhookEventLog;
import vacademy.io.common.payment.repository.WebhookEventLogRepository;

@Service
public class WebhookEventLogService {

    @Autowired
    private WebhookEventLogRepository webhookEventLogRepository;

    public void logEvent(String requestPayload) {
        WebhookEventLog eventLog = new WebhookEventLog();
        eventLog.setRequestPayload(requestPayload);
        webhookEventLogRepository.save(eventLog);
    }
}