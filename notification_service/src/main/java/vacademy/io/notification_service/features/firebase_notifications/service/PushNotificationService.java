package vacademy.io.notification_service.features.firebase_notifications.service;


import com.google.firebase.messaging.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.notification_service.features.firebase_notifications.repository.FcmTokenRepository;
import vacademy.io.notification_service.features.firebase_notifications.entity.FcmToken;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class PushNotificationService {

    private static final Logger logger = LoggerFactory.getLogger(PushNotificationService.class);

    @Autowired
    private MultiTenantFirebaseManager multiTenantFirebaseManager;

    @Autowired
    private FcmTokenRepository fcmTokenRepository;

    /**
     * Send push notification to a specific user
     */
    public void sendNotificationToUser(String instituteId, String userId, String title, String body, Map<String, String> data) {
        var messagingOpt = multiTenantFirebaseManager.getMessagingForInstitute(instituteId);
        if (messagingOpt.isEmpty()) {
            logger.warn("Firebase is not initialized for institute {}. Cannot send push notification to user: {}", instituteId, userId);
            return;
        }

        List<FcmToken> userTokens;
        if (instituteId != null && !instituteId.isBlank()) {
            userTokens = fcmTokenRepository.findByUserIdAndInstituteIdAndIsActiveTrue(userId, instituteId);
            if (userTokens.isEmpty()) {
                userTokens = fcmTokenRepository.findByUserIdAndIsActiveTrue(userId);
            }
        } else {
            userTokens = fcmTokenRepository.findByUserIdAndIsActiveTrue(userId);
        }
        
        if (userTokens.isEmpty()) {
            logger.warn("No active FCM tokens found for user: {}", userId);
            return;
        }

        for (FcmToken fcmToken : userTokens) {
            sendNotificationToToken(messagingOpt.get(), fcmToken.getToken(), title, body, data);
        }
    }

    /**
     * Send push notification to a specific FCM token
     */
    public void sendNotificationToToken(FirebaseMessaging firebaseMessaging, String fcmToken, String title, String body, Map<String, String> data) {
        
        try {
            Message.Builder messageBuilder = Message.builder()
                .setToken(fcmToken)
                .setNotification(Notification.builder()
                    .setTitle(title)
                    .setBody(body)
                    .build());

            // Add custom data if provided
            if (data != null && !data.isEmpty()) {
                messageBuilder.putAllData(data);
            }

            // Configure web push options
            messageBuilder.setWebpushConfig(WebpushConfig.builder()
                .setFcmOptions(WebpushFcmOptions.builder()
                    .setLink("https://your-app.com/dashboard") // Your app URL
                    .build())
                .build());

            Message message = messageBuilder.build();
            String response = firebaseMessaging.send(message);
            
            logger.info("Successfully sent message to token {}: {}", 
                fcmToken.substring(0, 20) + "...", response);
                
        } catch (FirebaseMessagingException e) {
            logger.error("Failed to send notification to token {}: {}", 
                fcmToken.substring(0, 20) + "...", e.getMessage());
                
            // If token is invalid, deactivate it
            if ("UNREGISTERED".equals(e.getErrorCode()) ||
                "INVALID_ARGUMENT".equals(e.getErrorCode())) {
                fcmTokenRepository.deactivateTokenByToken(fcmToken);
                logger.info("Deactivated invalid FCM token: {}", fcmToken.substring(0, 20) + "...");
            }
        }
    }

    /**
     * Send notification to multiple users
     */
    public void sendNotificationToUsers(String instituteId, List<String> userIds, String title, String body, Map<String, String> data) {
        for (String userId : userIds) {
            sendNotificationToUser(instituteId, userId, title, body, data);
        }
    }

    /**
     * Send broadcast notification to all active users
     */
    public void sendBroadcastNotification(String instituteId, String title, String body, Map<String, String> data) {
        var messagingOpt = multiTenantFirebaseManager.getMessagingForInstitute(instituteId);
        if (messagingOpt.isEmpty()) {
            logger.warn("Firebase is not initialized for institute {}. Cannot send broadcast.", instituteId);
            return;
        }

        List<FcmToken> allTokens = (instituteId == null || instituteId.isBlank())
            ? fcmTokenRepository.findByIsActiveTrue()
            : fcmTokenRepository.findByInstituteIdAndIsActiveTrue(instituteId);

        for (FcmToken fcmToken : allTokens) {
            sendNotificationToToken(messagingOpt.get(), fcmToken.getToken(), title, body, data);
        }
    }

    /**
     * Send assignment notification
     */
    public void sendAssignmentNotification(String userId, String assignmentTitle, String assignmentId) {
        Map<String, String> data = new HashMap<>();
        data.put("type", "assignment");
        data.put("assignmentId", assignmentId);
        data.put("action", "view_assignment");

        sendNotificationToUser(
            null,
            userId,
            "📚 New Assignment",
            "New assignment: " + assignmentTitle,
            data
        );
    }

    /**
     * Send live class notification
     */
    public void sendLiveClassNotification(String userId, String className, String sessionId, int minutesUntilStart) {
        Map<String, String> data = new HashMap<>();
        data.put("type", "live_class");
        data.put("sessionId", sessionId);
        data.put("action", "join_class");

        String title = minutesUntilStart <= 5 ? "🔴 Live Class Starting Now!" : "📅 Live Class Reminder";
        String body = minutesUntilStart <= 5 ? 
            className + " is starting now!" : 
            className + " starts in " + minutesUntilStart + " minutes";

        sendNotificationToUser(null, userId, title, body, data);
    }

    /**
     * Send achievement notification
     */
    public void sendAchievementNotification(String userId, String achievementTitle, String points) {
        Map<String, String> data = new HashMap<>();
        data.put("type", "achievement");
        data.put("points", points);
        data.put("action", "view_achievements");

        sendNotificationToUser(
            null,
            userId,
            "🏆 Achievement Unlocked!",
            achievementTitle + " (+" + points + " points)",
            data
        );
    }

    /**
     * Send announcement notification
     */
    public void sendAnnouncementNotification(String instituteId, List<String> userIds, String title, String message, String announcementId) {
        Map<String, String> data = new HashMap<>();
        data.put("type", "announcement");
        data.put("announcementId", announcementId);
        data.put("action", "view_announcement");

        sendNotificationToUsers(instituteId, userIds, "📢 " + title, message, data);
    }
}