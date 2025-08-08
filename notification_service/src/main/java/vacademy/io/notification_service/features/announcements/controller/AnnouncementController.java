package vacademy.io.notification_service.features.announcements.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.notification_service.features.announcements.dto.*;
import vacademy.io.notification_service.features.announcements.enums.AnnouncementStatus;
import vacademy.io.notification_service.features.announcements.service.AnnouncementService;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.validation.annotation.Validated;
import java.util.Map;

@RestController
@RequestMapping("/notification-service/v1/announcements")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = "*") // For internal service communication
@Validated
public class AnnouncementController {

    private final AnnouncementService announcementService;

    /**
     * Create a new announcement - Main API for other services
     */
    @PostMapping
    public ResponseEntity<AnnouncementResponse> createAnnouncement(@Valid @RequestBody CreateAnnouncementRequest request) {
        log.info("Creating announcement: {} for institute: {}", request.getTitle(), request.getInstituteId());
        
        try {
            AnnouncementResponse response = announcementService.createAnnouncement(request);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Error creating announcement", e);
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Get announcement by ID
     */
    @GetMapping("/{announcementId}")
    public ResponseEntity<AnnouncementResponse> getAnnouncement(
            @PathVariable @NotBlank(message = "Announcement ID is required") String announcementId) {
        try {
            AnnouncementResponse response = announcementService.getAnnouncement(announcementId);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Error getting announcement: {}", announcementId, e);
            return ResponseEntity.notFound().build();
        }
    }

    /**
     * Get announcements by institute with pagination
     */
    @GetMapping("/institute/{instituteId}")
    public ResponseEntity<Page<AnnouncementResponse>> getAnnouncementsByInstitute(
            @PathVariable String instituteId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String status) {
        
        try {
            Pageable pageable = PageRequest.of(page, size);
            Page<AnnouncementResponse> response;
            
            if (status != null) {
                AnnouncementStatus announcementStatus = AnnouncementStatus.valueOf(status.toUpperCase());
                response = announcementService.getAnnouncementsByInstituteAndStatus(instituteId, announcementStatus, pageable);
            } else {
                response = announcementService.getAnnouncementsByInstitute(instituteId, pageable);
            }
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Error getting announcements for institute: {}", instituteId, e);
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Update announcement status
     */
    @PutMapping("/{announcementId}/status")
    public ResponseEntity<AnnouncementResponse> updateAnnouncementStatus(
            @PathVariable String announcementId,
            @RequestBody Map<String, String> statusUpdate) {
        
        try {
            String statusValue = statusUpdate.get("status");
            AnnouncementStatus status = AnnouncementStatus.valueOf(statusValue.toUpperCase());
            
            AnnouncementResponse response = announcementService.updateAnnouncementStatus(announcementId, status);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Error updating announcement status: {}", announcementId, e);
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Delete announcement
     */
    @DeleteMapping("/{announcementId}")
    public ResponseEntity<Void> deleteAnnouncement(@PathVariable String announcementId) {
        try {
            announcementService.deleteAnnouncement(announcementId);
            return ResponseEntity.noContent().build();
        } catch (Exception e) {
            log.error("Error deleting announcement: {}", announcementId, e);
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Manually trigger announcement delivery (for testing/admin use)
     */
    @PostMapping("/{announcementId}/deliver")
    public ResponseEntity<Map<String, String>> deliverAnnouncement(@PathVariable String announcementId) {
        try {
            announcementService.processAnnouncementDelivery(announcementId);
            return ResponseEntity.ok(Map.of("message", "Announcement delivery initiated", "announcementId", announcementId));
        } catch (Exception e) {
            log.error("Error delivering announcement: {}", announcementId, e);
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Failed to deliver announcement", "message", e.getMessage()));
        }
    }

    /**
     * Get announcement delivery statistics
     */
    @GetMapping("/{announcementId}/stats")
    public ResponseEntity<AnnouncementResponse.AnnouncementStatsResponse> getAnnouncementStats(@PathVariable String announcementId) {
        try {
            // This would be implemented in AnnouncementService
            // For now, returning a placeholder response
            AnnouncementResponse.AnnouncementStatsResponse stats = new AnnouncementResponse.AnnouncementStatsResponse();
            stats.setTotalRecipients(0L);
            stats.setDeliveredCount(0L);
            stats.setReadCount(0L);
            stats.setFailedCount(0L);
            stats.setDeliveryRate(0.0);
            stats.setReadRate(0.0);
            
            return ResponseEntity.ok(stats);
        } catch (Exception e) {
            log.error("Error getting announcement stats: {}", announcementId, e);
            return ResponseEntity.badRequest().build();
        }
    }
}