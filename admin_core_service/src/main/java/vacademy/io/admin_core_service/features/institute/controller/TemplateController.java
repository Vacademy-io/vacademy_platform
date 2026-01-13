package vacademy.io.admin_core_service.features.institute.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.institute.dto.template.*;
import vacademy.io.admin_core_service.features.institute.service.TemplateService;
import vacademy.io.common.auth.config.PageConstants;
import vacademy.io.common.auth.model.CustomUserDetails;

import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;

import static vacademy.io.common.auth.config.PageConstants.DEFAULT_PAGE_NUMBER;

@RestController
@RequestMapping("/admin-core-service/institute/template/v1")
@RequiredArgsConstructor
@Slf4j
public class TemplateController {

    private final TemplateService templateService;

    /**
     * Create a new template
     */
    @PostMapping("/create")
    public ResponseEntity<TemplateResponse> createTemplate(
            @RequestAttribute("user") CustomUserDetails userDetails,
            @Valid @RequestBody TemplateRequest request) {

        log.info("Creating template: {} for institute: {} by user: {}",
                request.getName(), request.getInstituteId(), userDetails.getUserId());

        try {
            // Set user information
            request.setCreatedBy(userDetails.getUserId());
            request.setUpdatedBy(userDetails.getUserId());

            TemplateResponse response = templateService.createTemplate(request);
            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (Exception e) {
            log.error("Error creating template: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(null);
        }
    }

    /**
     * Update an existing template
     */
    @PutMapping("/update")
    public ResponseEntity<TemplateResponse> updateTemplate(
            @RequestAttribute("user") CustomUserDetails userDetails,
            @Valid @RequestBody TemplateUpdateRequest request) {

        log.info("Updating template: {} by user: {}", request.getId(), userDetails.getUserId());

        try {
            // Set user information
            request.setUpdatedBy(userDetails.getUserId());

            TemplateResponse response = templateService.updateTemplate(request);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Error updating template: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(null);
        }
    }

    /**
     * Get template by ID
     */
    @GetMapping("/{id}")
    public ResponseEntity<TemplateResponse> getTemplateById(
            @RequestAttribute("user") CustomUserDetails userDetails,
            @PathVariable String id) {

        log.info("Getting template by ID: {} for user: {}", id, userDetails.getUserId());

        try {
            TemplateResponse response = templateService.getTemplateById(id);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Error getting template: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(null);
        }
    }

    /**
     * Get all templates for an institute (paginated)
     * Returns lightweight template summaries without content to prevent memory
     * issues
     */
    @GetMapping("/institute/{instituteId}")
    public ResponseEntity<PagedTemplateResponse> getTemplatesByInstitute(
            @RequestAttribute("user") CustomUserDetails userDetails,
            @PathVariable String instituteId,
            @RequestParam(value = "pageNo", defaultValue = DEFAULT_PAGE_NUMBER, required = false) int pageNo,
            @RequestParam(value = "pageSize", defaultValue = PageConstants.DEFAULT_PAGE_SIZE, required = false) int pageSize) {

        log.info("Getting paginated templates for institute: {} by user: {}, page: {}, size: {}",
                instituteId, userDetails.getUserId(), pageNo, pageSize);

        try {
            PagedTemplateResponse response = templateService.getTemplatesByInstitutePaginated(instituteId, pageNo,
                    pageSize);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Error getting templates for institute: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(null);
        }
    }

    /**
     * Get templates by institute and type
     */
    @GetMapping("/institute/{instituteId}/type/{type}")
    public ResponseEntity<List<TemplateResponse>> getTemplatesByInstituteAndType(
            @RequestAttribute("user") CustomUserDetails userDetails,
            @PathVariable String instituteId,
            @PathVariable String type) {

        log.info("Getting templates for institute: {} and type: {} by user: {}",
                instituteId, type, userDetails.getUserId());

        try {
            List<TemplateResponse> response = templateService.getTemplatesByInstituteAndType(instituteId, type);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Error getting templates by institute and type: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(null);
        }
    }

    /**
     * Get templates by institute, type, and vendor
     */
    @GetMapping("/institute/{instituteId}/type/{type}/vendor/{vendorId}")
    public ResponseEntity<List<TemplateResponse>> getTemplatesByInstituteTypeAndVendor(
            @RequestAttribute("user") CustomUserDetails userDetails,
            @PathVariable String instituteId,
            @PathVariable String type,
            @PathVariable String vendorId) {

        log.info("Getting templates for institute: {}, type: {}, vendor: {} by user: {}",
                instituteId, type, vendorId, userDetails.getUserId());

        try {
            List<TemplateResponse> response = templateService.getTemplatesByInstituteTypeAndVendor(instituteId, type,
                    vendorId);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Error getting templates by institute, type, and vendor: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(null);
        }
    }

    /**
     * Search templates with filters
     */
    @PostMapping("/search")
    public ResponseEntity<List<TemplateResponse>> searchTemplates(
            @RequestAttribute("user") CustomUserDetails userDetails,
            @RequestBody TemplateSearchRequest request) {

        log.info("Searching templates with filters: {} by user: {}", request, userDetails.getUserId());

        try {
            List<TemplateResponse> response = templateService.searchTemplates(request);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Error searching templates: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(null);
        }
    }

    /**
     * Delete template by ID
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, String>> deleteTemplate(
            @RequestAttribute("user") CustomUserDetails userDetails,
            @PathVariable String id) {

        log.info("Deleting template: {} by user: {}", id, userDetails.getUserId());

        try {
            templateService.deleteTemplate(id);
            return ResponseEntity.ok(Map.of("message", "Template deleted successfully", "id", id));
        } catch (Exception e) {
            log.error("Error deleting template: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Get template count by institute and type
     */
    @GetMapping("/count/institute/{instituteId}/type/{type}")
    public ResponseEntity<Map<String, Long>> getTemplateCountByInstituteAndType(
            @RequestAttribute("user") CustomUserDetails userDetails,
            @PathVariable String instituteId,
            @PathVariable String type) {

        log.info("Getting template count for institute: {} and type: {} by user: {}",
                instituteId, type, userDetails.getUserId());

        try {
            long count = templateService.getTemplateCountByInstituteAndType(instituteId, type);
            return ResponseEntity.ok(Map.of("count", count));
        } catch (Exception e) {
            log.error("Error getting template count: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", 0L));
        }
    }

    /**
     * Get template count by institute
     */
    @GetMapping("/count/institute/{instituteId}")
    public ResponseEntity<Map<String, Long>> getTemplateCountByInstitute(
            @RequestAttribute("user") CustomUserDetails userDetails,
            @PathVariable String instituteId) {

        log.info("Getting template count for institute: {} by user: {}", instituteId, userDetails.getUserId());

        try {
            long count = templateService.getTemplateCountByInstitute(instituteId);
            return ResponseEntity.ok(Map.of("count", count));
        } catch (Exception e) {
            log.error("Error getting template count: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", 0L));
        }
    }

    /**
     * Check if template exists by name for institute
     */
    @GetMapping("/exists/institute/{instituteId}/name/{name}")
    public ResponseEntity<Map<String, Boolean>> templateExistsByName(
            @RequestAttribute("user") CustomUserDetails userDetails,
            @PathVariable String instituteId,
            @PathVariable String name) {

        log.info("Checking if template exists by name: {} for institute: {} by user: {}",
                name, instituteId, userDetails.getUserId());

        try {
            boolean exists = templateService.templateExistsByName(instituteId, name);
            return ResponseEntity.ok(Map.of("exists", exists));
        } catch (Exception e) {
            log.error("Error checking template existence: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("exists", false));
        }
    }

    /**
     * Get WhatsApp template for event (internal endpoint for notification-service)
     * This endpoint is called by notification-service to fetch WhatsApp templates
     * for specific events like OTP_REQUEST
     * 
     * @param eventName   Event name (e.g., "OTP_REQUEST")
     * @param instituteId Institute ID
     * @return WhatsApp template configuration
     */
    @GetMapping("/internal/whatsapp-template")
    public ResponseEntity<Map<String, Object>> getWhatsAppTemplate(
            @RequestParam String eventName,
            @RequestParam String instituteId) {

        log.info("Internal request for WhatsApp template: event={}, institute={}", eventName, instituteId);

        try {
            Map<String, Object> template = templateService.getTemplateForEvent(eventName, instituteId);
            return ResponseEntity.ok(template);
        } catch (Exception e) {
            log.error("Error fetching WhatsApp template for event {}: {}", eventName, e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }
}
