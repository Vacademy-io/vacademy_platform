package vacademy.io.common.payment.service;

import vacademy.io.common.payment.entity.WebhookEventLog;
import vacademy.io.common.payment.repository.WebhookEventLogRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

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