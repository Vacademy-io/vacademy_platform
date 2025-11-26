package vacademy.io.notification_service.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.common.notification.dto.EmailOTPRequest;
import vacademy.io.common.notification.dto.GenericEmailRequest;
import vacademy.io.notification_service.dto.EmailRequest;
import vacademy.io.notification_service.dto.NotificationDTO;
import vacademy.io.notification_service.dto.WhatsappRequest;
import vacademy.io.notification_service.features.email_otp.service.OTPService;
import vacademy.io.notification_service.service.EmailService;
import vacademy.io.notification_service.service.NotificationService;
import vacademy.io.notification_service.service.WhatsAppService;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("notification-service/whatsapp/v1")
public class WhatsappController {


    private final WhatsAppService whatsAppService;

    @Autowired
    public WhatsappController(WhatsAppService whatsAppService) {
        this.whatsAppService = whatsAppService;
    }

    @PostMapping("/send-template-whatsapp")
    public ResponseEntity<List<Map<String, Boolean>>> sendWhatsappMessages(@RequestBody WhatsappRequest request , @RequestParam(name="instituteId", required = false)String instituteId) {
        return ResponseEntity.ok(whatsAppService.sendWhatsappMessages(request.getTemplateName(), request.getUserDetails(), request.getHeaderParams(), request.getLanguageCode(), request.getHeaderType(),instituteId));
    }

    @PostMapping("/send-template-whatsapp/multiple")
    public ResponseEntity<String> sendWhatsappMessages(@RequestBody List<WhatsappRequest> requests , @RequestParam(name="instituteId", required = false)String instituteId) {
        for (WhatsappRequest whatsappRequest:requests){
            whatsAppService.sendWhatsappMessages(whatsappRequest.getTemplateName(), whatsappRequest.getUserDetails(), whatsappRequest.getHeaderParams(), whatsappRequest.getLanguageCode(), whatsappRequest.getHeaderType(),instituteId);
        }
        return ResponseEntity.ok("Ok!!!");
    }

}
