package vacademy.io.admin_core_service.features.payments.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.payments.entity.WebHook;
import vacademy.io.admin_core_service.features.payments.enums.WebHookStatus;
import vacademy.io.admin_core_service.features.payments.repository.WebHookRepository;

import java.time.LocalDateTime;

@Service
public class WebHookService {
    @Autowired
    private WebHookRepository webHookRepository;

    public String saveWebhook(String vendor,String payload){
        WebHook webHook = new WebHook();
        webHook.setVendor(vendor);
        webHook.setPayload(payload);
        webHook.setStatus(WebHookStatus.RECEIVED);
        webHookRepository.save(webHook);
        return webHook.getId();
    }

    public void updateWebHookStatus(String id, WebHookStatus status) {
        WebHook webHook = webHookRepository.findById(id).get();
        webHook.setStatus(status);
        webHook.setProcessedAt(LocalDateTime.now());
        webHookRepository.save(webHook);
    }

    public void updateWebHook(String webHookId,String payload,String orderId,String eventType) {
        WebHook webHook = webHookRepository.findById(webHookId).get();
        webHook.setPayload(payload);
        webHook.setOrderId(orderId);
        webHook.setEventType(eventType);
        webHookRepository.save(webHook);
    }
}
