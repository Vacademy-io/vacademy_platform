package vacademy.io.notification_service.features.firebase_notifications.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.messaging.FirebaseMessaging;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.notification_service.features.announcements.entity.InstituteAnnouncementSettings;
import vacademy.io.notification_service.features.announcements.repository.InstituteAnnouncementSettingsRepository;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Manages FirebaseApp/FirebaseMessaging instances per institute based on
 * service account JSON stored in institute announcement settings under key path:
 * settings.firebase.serviceAccountJson (string) OR settings.firebase.serviceAccountJsonBase64 (base64 string)
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class MultiTenantFirebaseManager {

    private final InstituteAnnouncementSettingsRepository settingsRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    private final Map<String, FirebaseApp> instituteIdToApp = new ConcurrentHashMap<>();

    public Optional<FirebaseMessaging> getMessagingForInstitute(String instituteId) {
        try {
            FirebaseApp app = instituteIdToApp.computeIfAbsent(instituteId, this::initializeAppForInstituteQuietly);
            if (app == null) {
                return Optional.empty();
            }
            return Optional.of(FirebaseMessaging.getInstance(app));
        } catch (Exception e) {
            log.warn("Failed to get FirebaseMessaging for institute {}: {}", instituteId, e.getMessage());
            return Optional.empty();
        }
    }

    private FirebaseApp initializeAppForInstituteQuietly(String instituteId) {
        try {
            Optional<InstituteAnnouncementSettings> settingsOpt = settingsRepository.findByInstituteId(instituteId);
            if (settingsOpt.isEmpty()) {
                log.warn("No announcement settings found for institute {}. Firebase not initialized.", instituteId);
                return null;
            }

            Map<String, Object> settings = settingsOpt.get().getSettings();
            if (settings == null) {
                log.warn("Settings map is null for institute {}. Firebase not initialized.", instituteId);
                return null;
            }

            Object firebaseObj = settings.get("firebase");
            if (!(firebaseObj instanceof Map)) {
                log.warn("No firebase config found in settings for institute {}.", instituteId);
                return null;
            }

            @SuppressWarnings("unchecked")
            Map<String, Object> firebaseCfg = (Map<String, Object>) firebaseObj;

            String json = null;
            Object jsonRaw = firebaseCfg.get("serviceAccountJson");
            if (jsonRaw instanceof String s && !s.isBlank()) {
                json = s;
            } else {
                Object base64 = firebaseCfg.get("serviceAccountJsonBase64");
                if (base64 instanceof String b64 && !b64.isBlank()) {
                    byte[] decoded = java.util.Base64.getDecoder().decode(b64);
                    json = new String(decoded, StandardCharsets.UTF_8);
                }
            }

            if (json == null || json.isBlank()) {
                log.warn("Firebase service account JSON missing for institute {}.", instituteId);
                return null;
            }

            // Basic validation
            try {
                JsonNode node = objectMapper.readTree(json);
                if (!node.has("client_email") || !node.has("private_key")) {
                    log.warn("Invalid Firebase service account JSON for institute {}.", instituteId);
                    return null;
                }
            } catch (Exception e) {
                log.warn("Failed to parse Firebase JSON for institute {}: {}", instituteId, e.getMessage());
                return null;
            }

            InputStream jsonStream = new ByteArrayInputStream(json.getBytes(StandardCharsets.UTF_8));
            FirebaseOptions options = FirebaseOptions.builder()
                .setCredentials(GoogleCredentials.fromStream(jsonStream))
                .build();

            String appName = "institute-" + instituteId;
            // If an app with same name already exists (race), reuse it
            synchronized (MultiTenantFirebaseManager.class) {
                for (FirebaseApp existing : FirebaseApp.getApps()) {
                    if (existing.getName().equals(appName)) {
                        return existing;
                    }
                }
                return FirebaseApp.initializeApp(options, appName);
            }

        } catch (Exception e) {
            log.error("Error initializing Firebase for institute {}", instituteId, e);
            return null;
        }
    }
}


