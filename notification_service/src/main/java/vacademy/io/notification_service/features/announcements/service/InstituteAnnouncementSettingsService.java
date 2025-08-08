package vacademy.io.notification_service.features.announcements.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.notification_service.features.announcements.dto.InstituteAnnouncementSettingsRequest;
import vacademy.io.notification_service.features.announcements.dto.InstituteAnnouncementSettingsResponse;
import vacademy.io.notification_service.features.announcements.entity.InstituteAnnouncementSettings;
import vacademy.io.notification_service.features.announcements.exception.AnnouncementException;
import vacademy.io.notification_service.features.announcements.exception.AnnouncementNotFoundException;
import vacademy.io.notification_service.features.announcements.exception.ValidationException;
import vacademy.io.notification_service.features.announcements.repository.InstituteAnnouncementSettingsRepository;

import java.time.LocalDateTime;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class InstituteAnnouncementSettingsService {

    private final InstituteAnnouncementSettingsRepository settingsRepository;
    private final ObjectMapper objectMapper;

    /**
     * Create or update institute announcement settings
     */
    @Transactional
    public InstituteAnnouncementSettingsResponse createOrUpdateSettings(InstituteAnnouncementSettingsRequest request) {
        if (request == null || request.getInstituteId() == null || request.getInstituteId().trim().isEmpty()) {
            throw new ValidationException("Institute ID cannot be null or empty");
        }

        try {
            log.info("Creating/updating announcement settings for institute: {}", request.getInstituteId());

            // Check if settings already exist
            Optional<InstituteAnnouncementSettings> existingSettings = 
                settingsRepository.findByInstituteId(request.getInstituteId());

            InstituteAnnouncementSettings settings;
            if (existingSettings.isPresent()) {
                settings = existingSettings.get();
                log.debug("Updating existing settings for institute: {}", request.getInstituteId());
            } else {
                settings = new InstituteAnnouncementSettings();
                settings.setInstituteId(request.getInstituteId());
                settings.setCreatedAt(LocalDateTime.now());
                log.debug("Creating new settings for institute: {}", request.getInstituteId());
            }

            // Convert request settings to Map for JSON storage
            Map<String, Object> settingsMap = convertRequestToMap(request.getSettings());
            settings.setSettings(settingsMap);
            settings.setUpdatedAt(LocalDateTime.now());

            // Save to database
            InstituteAnnouncementSettings savedSettings = settingsRepository.save(settings);
            log.info("Successfully saved announcement settings for institute: {}", request.getInstituteId());

            return mapToResponse(savedSettings);

        } catch (ValidationException e) {
            throw e;
        } catch (Exception e) {
            log.error("Error creating/updating announcement settings for institute: {}", request.getInstituteId(), e);
            throw new AnnouncementException("Failed to create/update announcement settings", "SETTINGS_UPDATE_ERROR", e);
        }
    }

    /**
     * Get institute announcement settings by institute ID
     */
    @Transactional(readOnly = true)
    public InstituteAnnouncementSettingsResponse getSettingsByInstituteId(String instituteId) {
        if (instituteId == null || instituteId.trim().isEmpty()) {
            throw new ValidationException("Institute ID cannot be null or empty");
        }

        try {
            log.debug("Retrieving announcement settings for institute: {}", instituteId);

            Optional<InstituteAnnouncementSettings> settings = settingsRepository.findByInstituteId(instituteId);
            
            if (settings.isEmpty()) {
                log.debug("No settings found for institute: {}, returning default settings", instituteId);
                return createDefaultSettingsResponse(instituteId);
            }

            return mapToResponse(settings.get());

        } catch (ValidationException e) {
            throw e;
        } catch (Exception e) {
            log.error("Error retrieving announcement settings for institute: {}", instituteId, e);
            throw new AnnouncementException("Failed to retrieve announcement settings", "SETTINGS_RETRIEVAL_ERROR", e);
        }
    }

    /**
     * Get all institute settings (admin function)
     */
    @Transactional(readOnly = true)
    public List<InstituteAnnouncementSettingsResponse> getAllSettings() {
        try {
            log.debug("Retrieving all institute announcement settings");
            
            List<InstituteAnnouncementSettings> allSettings = settingsRepository.findAll();
            return allSettings.stream()
                    .map(this::mapToResponse)
                    .toList();

        } catch (Exception e) {
            log.error("Error retrieving all announcement settings", e);
            throw new AnnouncementException("Failed to retrieve all announcement settings", "SETTINGS_RETRIEVAL_ERROR", e);
        }
    }

    /**
     * Delete institute announcement settings
     */
    @Transactional
    public void deleteSettings(String instituteId) {
        if (instituteId == null || instituteId.trim().isEmpty()) {
            throw new ValidationException("Institute ID cannot be null or empty");
        }

        try {
            log.info("Deleting announcement settings for institute: {}", instituteId);

            Optional<InstituteAnnouncementSettings> settings = settingsRepository.findByInstituteId(instituteId);
            
            if (settings.isEmpty()) {
                throw new AnnouncementNotFoundException("Announcement settings not found for institute: " + instituteId);
            }

            settingsRepository.delete(settings.get());
            log.info("Successfully deleted announcement settings for institute: {}", instituteId);

        } catch (AnnouncementNotFoundException e) {
            throw e;
        } catch (ValidationException e) {
            throw e;
        } catch (Exception e) {
            log.error("Error deleting announcement settings for institute: {}", instituteId, e);
            throw new AnnouncementException("Failed to delete announcement settings", "SETTINGS_DELETE_ERROR", e);
        }
    }

    /**
     * Check if a user role can perform a specific action based on institute settings
     */
    public boolean canUserPerformAction(String instituteId, String userRole, String action, String modeType) {
        try {
            log.debug("Checking permission for user role {} to perform {} action for mode {} in institute {}", 
                    userRole, action, modeType, instituteId);

            InstituteAnnouncementSettingsResponse settings = getSettingsByInstituteId(instituteId);
            return checkPermission(settings, userRole, action, modeType);

        } catch (Exception e) {
            log.warn("Error checking user permission, defaulting to false. Institute: {}, Role: {}, Action: {}", 
                    instituteId, userRole, action, e);
            return false;
        }
    }

    /**
     * Get default settings for an institute
     */
    private InstituteAnnouncementSettingsResponse createDefaultSettingsResponse(String instituteId) {
        InstituteAnnouncementSettingsResponse response = new InstituteAnnouncementSettingsResponse();
        response.setInstituteId(instituteId);
        response.setCreatedAt(LocalDateTime.now());
        response.setUpdatedAt(LocalDateTime.now());
        
        // Create default settings
        InstituteAnnouncementSettingsResponse.AnnouncementSettings defaultSettings = 
            new InstituteAnnouncementSettingsResponse.AnnouncementSettings();
        
        // Community defaults
        InstituteAnnouncementSettingsResponse.CommunitySettings community = 
            new InstituteAnnouncementSettingsResponse.CommunitySettings();
        community.setStudentsCanSend(false);
        community.setTeachersCanSend(true);
        community.setAdminsCanSend(true);
        community.setAllowReplies(true);
        community.setModerationEnabled(false);
        defaultSettings.setCommunity(community);
        
        // Dashboard pin defaults
        InstituteAnnouncementSettingsResponse.DashboardPinSettings dashboardPins = 
            new InstituteAnnouncementSettingsResponse.DashboardPinSettings();
        dashboardPins.setStudentsCanCreate(false);
        dashboardPins.setTeachersCanCreate(true);
        dashboardPins.setAdminsCanCreate(true);
        dashboardPins.setMaxDurationHours(24);
        dashboardPins.setMaxPinsPerUser(5);
        dashboardPins.setRequireApproval(false);
        defaultSettings.setDashboardPins(dashboardPins);
        
        // System alert defaults
        InstituteAnnouncementSettingsResponse.SystemAlertSettings systemAlerts = 
            new InstituteAnnouncementSettingsResponse.SystemAlertSettings();
        systemAlerts.setStudentsCanSend(false);
        systemAlerts.setTeachersCanSend(true);
        systemAlerts.setAdminsCanSend(true);
        systemAlerts.setAutoDismissHours(72);
        defaultSettings.setSystemAlerts(systemAlerts);
        
        // Direct message defaults
        InstituteAnnouncementSettingsResponse.DirectMessageSettings directMessages = 
            new InstituteAnnouncementSettingsResponse.DirectMessageSettings();
        directMessages.setStudentsCanSend(true);
        directMessages.setTeachersCanSend(true);
        directMessages.setAdminsCanSend(true);
        directMessages.setAllowStudentToStudent(false);
        directMessages.setAllowReplies(true);
        directMessages.setModerationEnabled(false);
        defaultSettings.setDirectMessages(directMessages);
        
        // Stream defaults
        InstituteAnnouncementSettingsResponse.StreamSettings streams = 
            new InstituteAnnouncementSettingsResponse.StreamSettings();
        streams.setStudentsCanSend(false);
        streams.setTeachersCanSend(true);
        streams.setAdminsCanSend(true);
        streams.setAllowDuringClass(true);
        streams.setAutoArchiveHours(24);
        defaultSettings.setStreams(streams);
        
        // Resource defaults
        InstituteAnnouncementSettingsResponse.ResourceSettings resources = 
            new InstituteAnnouncementSettingsResponse.ResourceSettings();
        resources.setStudentsCanUpload(false);
        resources.setTeachersCanUpload(true);
        resources.setAdminsCanUpload(true);
        resources.setMaxFileSizeMb(50);
        defaultSettings.setResources(resources);
        
        // General defaults
        InstituteAnnouncementSettingsResponse.GeneralSettings general = 
            new InstituteAnnouncementSettingsResponse.GeneralSettings();
        general.setAnnouncementApprovalRequired(false);
        general.setMaxAnnouncementsPerDay(10);
        general.setDefaultTimezone("Asia/Kolkata");
        general.setRetentionDays(365);
        defaultSettings.setGeneral(general);
        
        response.setSettings(defaultSettings);
        return response;
    }

    /**
     * Convert request settings to Map for JSON storage
     */
    private Map<String, Object> convertRequestToMap(InstituteAnnouncementSettingsRequest.AnnouncementSettings settings) {
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> result = objectMapper.convertValue(settings, Map.class);
            return result;
        } catch (Exception e) {
            log.error("Error converting settings to map", e);
            throw new ValidationException("Invalid settings format");
        }
    }

    /**
     * Map entity to response DTO
     */
    private InstituteAnnouncementSettingsResponse mapToResponse(InstituteAnnouncementSettings entity) {
        try {
            InstituteAnnouncementSettingsResponse response = new InstituteAnnouncementSettingsResponse();
            response.setId(entity.getId());
            response.setInstituteId(entity.getInstituteId());
            response.setCreatedAt(entity.getCreatedAt());
            response.setUpdatedAt(entity.getUpdatedAt());
            
            // Convert Map to settings object
            InstituteAnnouncementSettingsResponse.AnnouncementSettings settings = 
                objectMapper.convertValue(entity.getSettings(), 
                    InstituteAnnouncementSettingsResponse.AnnouncementSettings.class);
            response.setSettings(settings);
            
            return response;
        } catch (Exception e) {
            log.error("Error mapping entity to response", e);
            throw new AnnouncementException("Error processing settings data", "MAPPING_ERROR", e);
        }
    }

    /**
     * Check if user has permission for specific action
     */
    private boolean checkPermission(InstituteAnnouncementSettingsResponse settings, String userRole, String action, String modeType) {
        if (settings == null || settings.getSettings() == null) {
            return false;
        }

        String roleKey = userRole.toLowerCase();
        InstituteAnnouncementSettingsResponse.AnnouncementSettings announcementSettings = settings.getSettings();
        
        switch (modeType.toUpperCase()) {
            case "COMMUNITY":
                return checkCommunityPermission(announcementSettings.getCommunity(), roleKey, action);
            case "DASHBOARD_PIN":
                return checkDashboardPinPermission(announcementSettings.getDashboardPins(), roleKey, action);
            case "SYSTEM_ALERT":
                return checkSystemAlertPermission(announcementSettings.getSystemAlerts(), roleKey, action);
            case "DM":
                return checkDirectMessagePermission(announcementSettings.getDirectMessages(), roleKey, action);
            case "STREAM":
                return checkStreamPermission(announcementSettings.getStreams(), roleKey, action);
            case "RESOURCES":
                return checkResourcePermission(announcementSettings.getResources(), roleKey, action);
            default:
                return false;
        }
    }

    private boolean checkCommunityPermission(InstituteAnnouncementSettingsResponse.CommunitySettings community, String role, String action) {
        if (community == null) return false;
        return switch (role) {
            case "student" -> Boolean.TRUE.equals(community.getStudentsCanSend());
            case "teacher", "faculty" -> Boolean.TRUE.equals(community.getTeachersCanSend());
            case "admin" -> Boolean.TRUE.equals(community.getAdminsCanSend());
            default -> false;
        };
    }

    private boolean checkDashboardPinPermission(InstituteAnnouncementSettingsResponse.DashboardPinSettings dashboardPins, String role, String action) {
        if (dashboardPins == null) return false;
        return switch (role) {
            case "student" -> Boolean.TRUE.equals(dashboardPins.getStudentsCanCreate());
            case "teacher", "faculty" -> Boolean.TRUE.equals(dashboardPins.getTeachersCanCreate());
            case "admin" -> Boolean.TRUE.equals(dashboardPins.getAdminsCanCreate());
            default -> false;
        };
    }

    private boolean checkSystemAlertPermission(InstituteAnnouncementSettingsResponse.SystemAlertSettings systemAlerts, String role, String action) {
        if (systemAlerts == null) return false;
        return switch (role) {
            case "student" -> Boolean.TRUE.equals(systemAlerts.getStudentsCanSend());
            case "teacher", "faculty" -> Boolean.TRUE.equals(systemAlerts.getTeachersCanSend());
            case "admin" -> Boolean.TRUE.equals(systemAlerts.getAdminsCanSend());
            default -> false;
        };
    }

    private boolean checkDirectMessagePermission(InstituteAnnouncementSettingsResponse.DirectMessageSettings directMessages, String role, String action) {
        if (directMessages == null) return false;
        return switch (role) {
            case "student" -> Boolean.TRUE.equals(directMessages.getStudentsCanSend());
            case "teacher", "faculty" -> Boolean.TRUE.equals(directMessages.getTeachersCanSend());
            case "admin" -> Boolean.TRUE.equals(directMessages.getAdminsCanSend());
            default -> false;
        };
    }

    private boolean checkStreamPermission(InstituteAnnouncementSettingsResponse.StreamSettings streams, String role, String action) {
        if (streams == null) return false;
        return switch (role) {
            case "student" -> Boolean.TRUE.equals(streams.getStudentsCanSend());
            case "teacher", "faculty" -> Boolean.TRUE.equals(streams.getTeachersCanSend());
            case "admin" -> Boolean.TRUE.equals(streams.getAdminsCanSend());
            default -> false;
        };
    }

    private boolean checkResourcePermission(InstituteAnnouncementSettingsResponse.ResourceSettings resources, String role, String action) {
        if (resources == null) return false;
        return switch (role) {
            case "student" -> Boolean.TRUE.equals(resources.getStudentsCanUpload());
            case "teacher", "faculty" -> Boolean.TRUE.equals(resources.getTeachersCanUpload());
            case "admin" -> Boolean.TRUE.equals(resources.getAdminsCanUpload());
            default -> false;
        };
    }
}