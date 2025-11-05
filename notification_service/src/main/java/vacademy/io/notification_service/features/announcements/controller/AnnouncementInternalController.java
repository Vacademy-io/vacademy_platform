package vacademy.io.notification_service.features.announcements.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import vacademy.io.notification_service.features.announcements.dto.AnnouncementResponse;
import vacademy.io.notification_service.features.announcements.dto.CreateAnnouncementRequest;
import vacademy.io.notification_service.features.announcements.service.AnnouncementService;

import java.util.List;

@RestController
@RequestMapping("/notification-service/internal/v1/announcements")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = "*") // For internal service communication
@Validated
public class AnnouncementInternalController {

    @Autowired
    private AnnouncementService announcementService;

    @PostMapping("/multiple")
    public ResponseEntity<String> createAnnouncements(@Valid @RequestBody List<CreateAnnouncementRequest> requests) {

        for(CreateAnnouncementRequest request:requests){
            try {
                AnnouncementResponse response = announcementService.createAnnouncement(request);
            } catch (Exception e) {
                log.error("Error creating announcement", e);
            }
        }
        return ResponseEntity.ok("");
    }
}
