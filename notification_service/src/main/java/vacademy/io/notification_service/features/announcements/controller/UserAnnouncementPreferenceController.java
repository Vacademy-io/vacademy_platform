package vacademy.io.notification_service.features.announcements.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.notification_service.features.announcements.dto.UserAnnouncementPreferenceResponse;
import vacademy.io.notification_service.features.announcements.dto.UserAnnouncementPreferenceUpdateRequest;
import vacademy.io.notification_service.features.announcements.service.UserAnnouncementPreferenceService;

@RestController
@RequestMapping("/notification-service/public/v1/user-announcement-preferences")
@RequiredArgsConstructor
@Slf4j
@Validated
@Tag(name = "User Announcement Preferences", description = "Public APIs for managing user announcement channel preferences")
@CrossOrigin(origins = "*")
public class UserAnnouncementPreferenceController {

    private final UserAnnouncementPreferenceService preferenceService;

    @Operation(summary = "Get current announcement preferences for a user")
    @GetMapping("/{username}")
    public ResponseEntity<UserAnnouncementPreferenceResponse> getPreferences(
            @PathVariable @NotBlank(message = "Username cannot be blank") String username,
            @RequestParam @NotBlank(message = "Institute ID cannot be blank") String instituteId) {

        log.info("Fetching user announcement preferences for username: {} and institute: {}", username, instituteId);
        UserAnnouncementPreferenceResponse response = preferenceService.getPreferences(username, instituteId);
        return ResponseEntity.ok(response);
    }

    @Operation(summary = "Update announcement preferences for a user")
    @PutMapping("/{username}")
    public ResponseEntity<UserAnnouncementPreferenceResponse> updatePreferences(
            @PathVariable @NotBlank(message = "Username cannot be blank") String username,
            @RequestParam @NotBlank(message = "Institute ID cannot be blank") String instituteId,
            @Valid @RequestBody(required = false) UserAnnouncementPreferenceUpdateRequest request) {

        UserAnnouncementPreferenceUpdateRequest payload =
                request != null ? request : new UserAnnouncementPreferenceUpdateRequest();
        payload.setUsername(username);
        payload.setInstituteId(instituteId);

        log.info("Updating user announcement preferences for username: {} and institute: {}", username, instituteId);
        UserAnnouncementPreferenceResponse response = preferenceService.updatePreferences(
                payload.getUsername(), instituteId, payload);
        return ResponseEntity.ok(response);
    }
}

