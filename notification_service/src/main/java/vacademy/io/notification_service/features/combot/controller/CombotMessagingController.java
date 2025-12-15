package vacademy.io.notification_service.features.combot.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.notification_service.features.combot.dto.WhatsAppTemplateRequest;
import vacademy.io.notification_service.features.combot.dto.WhatsAppTemplateResponse;
import vacademy.io.notification_service.features.combot.service.CombotMessagingService;

/**
 * Controller for sending WhatsApp messages via Com.bot
 * Called by admin_core_service with pre-built Meta API payloads
 */
@RestController
@RequestMapping("/notification-service/v1/combot")
@RequiredArgsConstructor
@Slf4j
public class CombotMessagingController {

    private final CombotMessagingService combotMessagingService;

    @PostMapping("/send-template")
    public ResponseEntity<WhatsAppTemplateResponse> sendTemplateMessage(
            @RequestBody WhatsAppTemplateRequest request) {
        return combotMessagingService.sendTemplateMessage(request);
    }
}
