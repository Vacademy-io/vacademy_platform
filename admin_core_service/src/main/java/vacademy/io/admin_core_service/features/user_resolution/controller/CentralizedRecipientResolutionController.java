package vacademy.io.admin_core_service.features.user_resolution.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.user_resolution.dto.CentralizedRecipientResolutionRequest;
import vacademy.io.admin_core_service.features.user_resolution.dto.PaginatedUserIdResponse;
import vacademy.io.admin_core_service.features.user_resolution.service.CentralizedRecipientResolutionService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/admin-core-service/v1/recipient-resolution")
@RequiredArgsConstructor
@Slf4j
public class CentralizedRecipientResolutionController {

    private final CentralizedRecipientResolutionService centralizedRecipientResolutionService;

    /**
     * Centralized API for resolving multiple recipient types with inclusions, exclusions, and custom field filters
     * Handles pagination internally and returns deduplicated user IDs
     */
    @PostMapping("/centralized")
    public ResponseEntity<PaginatedUserIdResponse> resolveRecipientsCentralized(
            @Valid @RequestBody CentralizedRecipientResolutionRequest request) {

        log.info("Received centralized recipient resolution request for institute: {} with {} recipients",
                request.getInstituteId(), request.getRecipients().size());

        try {
            PaginatedUserIdResponse response = centralizedRecipientResolutionService.resolveRecipients(request);
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("Error in centralized recipient resolution for institute: {}", request.getInstituteId(), e);
            // Return empty response on error
            PaginatedUserIdResponse errorResponse = new PaginatedUserIdResponse();
            errorResponse.setUserIds(java.util.Collections.emptyList());
            errorResponse.setPageNumber(request.getPageNumber());
            errorResponse.setPageSize(request.getPageSize());
            errorResponse.setTotalElements(0);
            errorResponse.setTotalPages(0);
            errorResponse.setHasNext(false);
            errorResponse.setHasPrevious(request.getPageNumber() > 0);
            errorResponse.setFirst(request.getPageNumber() == 0);
            errorResponse.setLast(true);

            return ResponseEntity.ok(errorResponse);
        }
    }
}
