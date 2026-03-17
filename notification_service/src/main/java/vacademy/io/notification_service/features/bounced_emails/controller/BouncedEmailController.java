package vacademy.io.notification_service.features.bounced_emails.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.notification_service.features.bounced_emails.dto.BouncedEmailDTO;
import vacademy.io.notification_service.features.bounced_emails.dto.BouncedEmailStatsDTO;
import vacademy.io.notification_service.features.bounced_emails.dto.UnblockEmailRequest;
import vacademy.io.notification_service.features.bounced_emails.entity.BouncedEmail;
import vacademy.io.notification_service.features.bounced_emails.service.BouncedEmailService;

import java.util.List;

/**
 * Controller for managing bounced email blocklist.
 * Provides endpoints to view, search, and manage blocked email addresses.
 */
@RestController
@RequestMapping("/notification-service/internal/api/bounced-emails")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Bounced Email Management", description = "APIs for managing bounced email blocklist")
public class BouncedEmailController {

    private final BouncedEmailService bouncedEmailService;

    @Operation(summary = "Get all blocked emails", description = "Returns paginated list of all blocked email addresses")
    @GetMapping
    public ResponseEntity<Page<BouncedEmailDTO>> getBlockedEmails(
            @Parameter(description = "Page number (0-based)") @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "Page size") @RequestParam(defaultValue = "20") int size,
            @Parameter(description = "Sort by field") @RequestParam(defaultValue = "createdAt") String sortBy,
            @Parameter(description = "Sort direction") @RequestParam(defaultValue = "DESC") String sortDir) {
        
        Sort sort = sortDir.equalsIgnoreCase("ASC") ? Sort.by(sortBy).ascending() : Sort.by(sortBy).descending();
        Pageable pageable = PageRequest.of(page, size, sort);
        
        Page<BouncedEmail> blockedEmails = bouncedEmailService.getBlockedEmails(pageable);
        Page<BouncedEmailDTO> response = blockedEmails.map(this::toDTO);
        
        return ResponseEntity.ok(response);
    }

    @Operation(summary = "Search blocked emails", description = "Search blocked emails by email pattern")
    @GetMapping("/search")
    public ResponseEntity<Page<BouncedEmailDTO>> searchBlockedEmails(
            @Parameter(description = "Search term (email pattern)") @RequestParam String q,
            @Parameter(description = "Page number (0-based)") @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "Page size") @RequestParam(defaultValue = "20") int size) {
        
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        Page<BouncedEmail> results = bouncedEmailService.searchBlockedEmails(q, pageable);
        Page<BouncedEmailDTO> response = results.map(this::toDTO);
        
        return ResponseEntity.ok(response);
    }

    @Operation(summary = "Check if email is blocked", description = "Check if a specific email address is blocked")
    @GetMapping("/check")
    public ResponseEntity<CheckEmailResponse> checkEmail(
            @Parameter(description = "Email address to check") @RequestParam String email) {
        
        boolean isBlocked = bouncedEmailService.isEmailBlocked(email);
        var details = bouncedEmailService.getBouncedEmailDetails(email);
        
        CheckEmailResponse response = new CheckEmailResponse(
            email,
            isBlocked,
            details.map(this::toDTO).orElse(null)
        );
        
        return ResponseEntity.ok(response);
    }

    @Operation(summary = "Get blocklist statistics", description = "Get statistics about blocked emails")
    @GetMapping("/stats")
    public ResponseEntity<BouncedEmailStatsDTO> getStats() {
        BouncedEmailService.BlocklistStats stats = bouncedEmailService.getBlocklistStats();
        
        BouncedEmailStatsDTO response = new BouncedEmailStatsDTO(
            stats.totalBlocked(),
            stats.permanentBounces(),
            stats.transientBounces()
        );
        
        return ResponseEntity.ok(response);
    }

    @Operation(summary = "Unblock an email", description = "Remove an email address from the blocklist")
    @PostMapping("/unblock")
    public ResponseEntity<UnblockResponse> unblockEmail(@RequestBody UnblockEmailRequest request) {
        log.info("Request to unblock email: {}", request.getEmail());
        
        boolean success = bouncedEmailService.unblockEmail(request.getEmail());
        
        if (success) {
            return ResponseEntity.ok(new UnblockResponse(true, "Email unblocked successfully: " + request.getEmail()));
        } else {
            return ResponseEntity.ok(new UnblockResponse(false, "Email not found in blocklist: " + request.getEmail()));
        }
    }

    @Operation(summary = "Re-block an email", description = "Re-add a previously unblocked email to the blocklist")
    @PostMapping("/reblock")
    public ResponseEntity<UnblockResponse> reblockEmail(@RequestBody UnblockEmailRequest request) {
        log.info("Request to re-block email: {}", request.getEmail());
        
        boolean success = bouncedEmailService.reblockEmail(request.getEmail());
        
        if (success) {
            return ResponseEntity.ok(new UnblockResponse(true, "Email re-blocked successfully: " + request.getEmail()));
        } else {
            return ResponseEntity.ok(new UnblockResponse(false, "Email not found in blocklist history: " + request.getEmail()));
        }
    }

    @Operation(summary = "Check multiple emails", description = "Check which emails from a list are blocked")
    @PostMapping("/check-batch")
    public ResponseEntity<BatchCheckResponse> checkEmailsBatch(@RequestBody List<String> emails) {
        List<String> blockedEmails = bouncedEmailService.filterBlockedEmails(emails);
        
        return ResponseEntity.ok(new BatchCheckResponse(emails.size(), blockedEmails.size(), blockedEmails));
    }

    @Operation(summary = "Clear blocklist cache", description = "Clear the in-memory cache for blocked emails")
    @PostMapping("/clear-cache")
    public ResponseEntity<String> clearCache() {
        bouncedEmailService.clearCache();
        return ResponseEntity.ok("Blocklist cache cleared successfully");
    }

    /**
     * Convert entity to DTO
     */
    private BouncedEmailDTO toDTO(BouncedEmail entity) {
        return new BouncedEmailDTO(
            entity.getId(),
            entity.getEmail(),
            entity.getBounceType(),
            entity.getBounceSubType(),
            entity.getBounceReason(),
            entity.getSesMessageId(),
            entity.getOriginalNotificationLogId(),
            entity.getIsActive(),
            entity.getCreatedAt(),
            entity.getUpdatedAt()
        );
    }

    // Response record classes
    public record CheckEmailResponse(String email, boolean isBlocked, BouncedEmailDTO details) {}
    public record UnblockResponse(boolean success, String message) {}
    public record BatchCheckResponse(int totalChecked, int blockedCount, List<String> blockedEmails) {}
}

