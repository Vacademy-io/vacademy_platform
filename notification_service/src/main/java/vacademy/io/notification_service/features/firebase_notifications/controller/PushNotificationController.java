package vacademy.io.notification_service.features.firebase_notifications.controller;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.notification_service.features.firebase_notifications.service.PushNotificationService;
import vacademy.io.notification_service.features.firebase_notifications.repository.FcmTokenRepository;
import vacademy.io.notification_service.features.firebase_notifications.entity.FcmToken;
import vacademy.io.notification_service.features.firebase_notifications.dto.FcmTokenRequest;
import vacademy.io.notification_service.features.firebase_notifications.dto.FcmNotificationRequest;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;



@RestController
@RequestMapping("/notification-service/push-notifications")
@CrossOrigin(origins = "*")
public class PushNotificationController {

    @Autowired
    private PushNotificationService pushNotificationService;

    @Autowired
    private FcmTokenRepository fcmTokenRepository;

    /**
     * Register FCM token for a user
     */
    @PostMapping("/register")
    public ResponseEntity<Map<String, Object>> registerToken(@RequestBody FcmTokenRequest request) {
        Map<String, Object> response = new HashMap<>();
        
        try {
            // Check if token already exists for this user/device
            Optional<FcmToken> existingToken = fcmTokenRepository
                .findByUserIdAndDeviceIdAndIsActiveTrue(request.getUserId(), request.getDeviceId());

            if (existingToken.isPresent()) {
                // Update existing token
                FcmToken token = existingToken.get();
                token.setToken(request.getToken());
                token.setPlatform(request.getPlatform());
                fcmTokenRepository.save(token);
                
                response.put("success", true);
                response.put("message", "FCM token updated successfully");
                response.put("tokenId", token.getId());
            } else {
                // Create new token
                FcmToken newToken = new FcmToken(
                    request.getUserId(),
                    request.getToken(),
                    request.getPlatform(),
                    request.getDeviceId()
                );
                
                FcmToken savedToken = fcmTokenRepository.save(newToken);
                
                response.put("success", true);
                response.put("message", "FCM token registered successfully");
                response.put("tokenId", savedToken.getId());
            }

            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            response.put("success", false);
            response.put("message", "Failed to register FCM token: " + e.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }

    /**
     * Send test notification
     */
    @PostMapping("/send-test")
    public ResponseEntity<Map<String, Object>> sendTestNotification(@RequestBody FcmNotificationRequest request) {
        Map<String, Object> response = new HashMap<>();
        
        try {
            Map<String, String> data = new HashMap<>();
            data.put("type", "test");
            data.put("timestamp", String.valueOf(System.currentTimeMillis()));

            pushNotificationService.sendNotificationToUser(
                request.getUserId(),
                request.getTitle(),
                request.getBody(),
                data
            );

            response.put("success", true);
            response.put("message", "Test notification sent successfully");
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            response.put("success", false);
            response.put("message", "Failed to send test notification: " + e.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }

    /**
     * Deactivate FCM token
     */
    @PostMapping("/deactivate")
    public ResponseEntity<Map<String, Object>> deactivateToken(@RequestParam String token) {
        Map<String, Object> response = new HashMap<>();
        
        try {
            fcmTokenRepository.deactivateTokenByToken(token);
            
            response.put("success", true);
            response.put("message", "FCM token deactivated successfully");
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            response.put("success", false);
            response.put("message", "Failed to deactivate FCM token: " + e.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }
}