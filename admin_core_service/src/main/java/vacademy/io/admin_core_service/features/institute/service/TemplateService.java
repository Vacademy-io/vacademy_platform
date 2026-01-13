package vacademy.io.admin_core_service.features.institute.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.institute.dto.template.*;
import vacademy.io.admin_core_service.features.institute.entity.Template;
import vacademy.io.admin_core_service.features.institute.repository.TemplateRepository;
import vacademy.io.admin_core_service.features.notification.entity.NotificationEventConfig;
import vacademy.io.admin_core_service.features.notification.repository.NotificationEventConfigRepository;
import vacademy.io.admin_core_service.features.notification.enums.NotificationEventType;
import vacademy.io.admin_core_service.features.notification.enums.NotificationSourceType;
import vacademy.io.admin_core_service.features.notification.enums.NotificationTemplateType;
import com.fasterxml.jackson.databind.JsonNode;

import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class TemplateService {

    private final TemplateRepository templateRepository;
    private final NotificationEventConfigRepository eventConfigRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * Create a new template
     */
    @Transactional
    public TemplateResponse createTemplate(TemplateRequest request) {
        log.info("Creating template: {} for institute: {}", request.getName(), request.getInstituteId());

        // Check if template name already exists for the institute
        if (templateRepository.existsByInstituteIdAndName(request.getInstituteId(), request.getName())) {
            throw new IllegalArgumentException(
                    "Template with name '" + request.getName() + "' already exists for this institute");
        }

        // Handle dynamic parameters based on contentType
        String dynamicParametersJson = null;
        if (request.getDynamicParameters() != null) {
            try {
                dynamicParametersJson = objectMapper.writeValueAsString(request.getDynamicParameters());
                log.info("Converted dynamic parameters to JSON for type {}: {}", request.getType(),
                        dynamicParametersJson);
            } catch (JsonProcessingException e) {
                log.error("Error converting dynamic parameters to JSON: {}", e.getMessage());
                throw new IllegalArgumentException("Invalid dynamic parameters format");
            }
        }

        // Handle settings JSON as Map
        String settingJsonString = null;
        if (request.getSettingJson() != null) {
            try {
                settingJsonString = objectMapper.writeValueAsString(request.getSettingJson());
                log.info("Converted settings to JSON for type {}: {}", request.getType(), settingJsonString);
            } catch (JsonProcessingException e) {
                log.error("Error converting settings to JSON: {}", e.getMessage());
                throw new IllegalArgumentException("Invalid settings format");
            }
        }

        Template template = Template.builder()
                .type(request.getType())
                .vendorId(request.getVendorId())
                .instituteId(request.getInstituteId())
                .name(request.getName())
                .subject(request.getSubject())
                .content(request.getContent())
                .contentType(request.getContentType())
                .settingJson(settingJsonString)
                .dynamicParameters(dynamicParametersJson)
                .canDelete(request.getCanDelete() != null ? request.getCanDelete() : true)
                .status(request.getStatus())
                .templateCategory(request.getTemplateCategory())
                .createdBy(request.getCreatedBy())
                .updatedBy(request.getUpdatedBy())
                .build();

        Template savedTemplate = templateRepository.save(template);
        log.info("Template created successfully with ID: {}", savedTemplate.getId());

        return convertToResponse(savedTemplate);
    }

    /**
     * Update an existing template
     */
    @Transactional
    public TemplateResponse updateTemplate(TemplateUpdateRequest request) {
        log.info("Updating template: {} for institute: {}", request.getId(), request.getName());

        Template existingTemplate = templateRepository.findById(request.getId())
                .orElseThrow(() -> new IllegalArgumentException("Template not found with ID: " + request.getId()));

        // Check if template name already exists for the institute (excluding current
        // template)
        if (request.getName() != null && !request.getName().equals(existingTemplate.getName())) {
            if (templateRepository.existsByInstituteIdAndNameAndIdNot(existingTemplate.getInstituteId(),
                    request.getName(), request.getId())) {
                throw new IllegalArgumentException(
                        "Template with name '" + request.getName() + "' already exists for this institute");
            }
        }

        // Update fields if provided
        if (request.getType() != null) {
            existingTemplate.setType(request.getType());
        }
        if (request.getVendorId() != null) {
            existingTemplate.setVendorId(request.getVendorId());
        }
        if (request.getName() != null) {
            existingTemplate.setName(request.getName());
        }
        if (request.getSubject() != null) {
            existingTemplate.setSubject(request.getSubject());
        }
        if (request.getContent() != null) {
            existingTemplate.setContent(request.getContent());
        }
        if (request.getContentType() != null) {
            existingTemplate.setContentType(request.getContentType());
        }
        // Handle settings JSON update
        if (request.getSettingJson() != null) {
            try {
                String settingJsonString = objectMapper.writeValueAsString(request.getSettingJson());
                existingTemplate.setSettingJson(settingJsonString);
                log.info("Updated settings to JSON for type {}: {}",
                        request.getType() != null ? request.getType() : existingTemplate.getType(), settingJsonString);
            } catch (JsonProcessingException e) {
                log.error("Error converting settings to JSON: {}", e.getMessage());
                throw new IllegalArgumentException("Invalid settings format");
            }
        }

        // Handle dynamic parameters update
        if (request.getDynamicParameters() != null) {
            try {
                String dynamicParametersJson = objectMapper.writeValueAsString(request.getDynamicParameters());
                existingTemplate.setDynamicParameters(dynamicParametersJson);
                log.info("Updated dynamic parameters to JSON for type {}: {}",
                        request.getType() != null ? request.getType() : existingTemplate.getType(),
                        dynamicParametersJson);
            } catch (JsonProcessingException e) {
                log.error("Error converting dynamic parameters to JSON: {}", e.getMessage());
                throw new IllegalArgumentException("Invalid dynamic parameters format");
            }
        }

        if (request.getCanDelete() != null) {
            existingTemplate.setCanDelete(request.getCanDelete());
        }
        if (request.getStatus() != null) {
            existingTemplate.setStatus(request.getStatus());
        }
        if (request.getTemplateCategory() != null) {
            existingTemplate.setTemplateCategory(request.getTemplateCategory());
        }
        if (request.getUpdatedBy() != null) {
            existingTemplate.setUpdatedBy(request.getUpdatedBy());
        }

        Template updatedTemplate = templateRepository.save(existingTemplate);
        log.info("Template updated successfully with ID: {}", updatedTemplate.getId());

        return convertToResponse(updatedTemplate);
    }

    /**
     * Get template by ID
     */
    public TemplateResponse getTemplateById(String id) {
        log.info("Getting template by ID: {}", id);

        Template template = templateRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Template not found with ID: " + id));

        return convertToResponse(template);
    }

    /**
     * Get all templates for an institute
     * 
     * @deprecated Use getTemplatesByInstitutePaginated instead to avoid memory
     *             issues
     */
    @Deprecated
    public List<TemplateResponse> getTemplatesByInstitute(String instituteId) {
        log.info("Getting all templates for institute: {}", instituteId);

        List<Template> templates = templateRepository.findByInstituteIdOrderByCreatedAtDesc(instituteId);
        return templates.stream()
                .map(this::convertToResponse)
                .collect(Collectors.toList());
    }

    /**
     * Get paginated templates for an institute (returns summary without content)
     * This method is optimized to prevent memory issues by excluding large fields
     */
    public PagedTemplateResponse getTemplatesByInstitutePaginated(String instituteId, int pageNo, int pageSize) {
        log.info("Getting paginated templates for institute: {}, page: {}, size: {}", instituteId, pageNo, pageSize);

        // Convert pageNo from 1-based to 0-based (if needed) or use as-is if already
        // 0-based
        // Based on PageConstants, DEFAULT_PAGE_NUMBER is "0", so we'll use it as-is
        Pageable pageable = PageRequest.of(pageNo, pageSize);
        Page<Template> templatePage = templateRepository.findByInstituteIdOrderByCreatedAtDescPageable(instituteId,
                pageable);

        List<TemplateSummaryResponse> summaryList = templatePage.getContent().stream()
                .map(this::convertToSummaryResponse)
                .collect(Collectors.toList());

        int totalPages = templatePage.getTotalPages();

        return PagedTemplateResponse.builder()
                .content(summaryList)
                .pageNumber(pageNo)
                .pageSize(pageSize)
                .totalElements(templatePage.getTotalElements())
                .totalPages(totalPages)
                .last(pageNo >= totalPages - 1)
                .first(pageNo == 0)
                .build();
    }

    /**
     * Get templates by institute and type
     */
    public List<TemplateResponse> getTemplatesByInstituteAndType(String instituteId, String type) {
        log.info("Getting templates for institute: {} and type: {}", instituteId, type);

        List<Template> templates = templateRepository.findByInstituteIdAndTypeOrderByCreatedAtDesc(instituteId, type);
        return templates.stream()
                .map(this::convertToResponse)
                .collect(Collectors.toList());
    }

    /**
     * Get templates by institute, type, and vendor
     */
    public List<TemplateResponse> getTemplatesByInstituteTypeAndVendor(String instituteId, String type,
            String vendorId) {
        log.info("Getting templates for institute: {}, type: {}, vendor: {}", instituteId, type, vendorId);

        List<Template> templates = templateRepository.findByInstituteIdAndTypeAndVendorId(instituteId, type, vendorId);
        return templates.stream()
                .map(this::convertToResponse)
                .collect(Collectors.toList());
    }

    /**
     * Search templates with filters
     */
    public List<TemplateResponse> searchTemplates(TemplateSearchRequest request) {
        log.info("Searching templates with filters: {}", request);

        List<Template> templates;

        if (request.getSearchText() != null && !request.getSearchText().trim().isEmpty()) {
            // Search by name, subject, or content
            List<Template> nameResults = templateRepository.findByNameContainingIgnoreCase(request.getInstituteId(),
                    request.getSearchText());
            List<Template> subjectResults = templateRepository
                    .findBySubjectContainingIgnoreCase(request.getInstituteId(), request.getSearchText());
            List<Template> contentResults = templateRepository
                    .findByContentContainingIgnoreCase(request.getInstituteId(), request.getSearchText());

            // Combine and deduplicate
            templates = nameResults.stream()
                    .distinct()
                    .collect(Collectors.toList());
            templates.addAll(subjectResults.stream()
                    .filter(t -> !templates.contains(t))
                    .collect(Collectors.toList()));
            templates.addAll(contentResults.stream()
                    .filter(t -> !templates.contains(t))
                    .collect(Collectors.toList()));
        } else {
            // Get all templates for institute
            templates = templateRepository.findByInstituteIdOrderByCreatedAtDesc(request.getInstituteId());
        }

        // Apply additional filters using stream chaining
        return templates.stream()
                .filter(t -> request.getType() == null || t.getType().equals(request.getType()))
                .filter(t -> request.getVendorId() == null || request.getVendorId().equals(t.getVendorId()))
                .filter(t -> request.getCanDelete() == null || t.getCanDelete().equals(request.getCanDelete()))
                .filter(t -> request.getContentType() == null || request.getContentType().equals(t.getContentType()))
                .filter(t -> request.getStatus() == null || request.getStatus().equals(t.getStatus()))
                .filter(t -> request.getTemplateCategory() == null
                        || request.getTemplateCategory().equals(t.getTemplateCategory()))
                .map(this::convertToResponse)
                .collect(Collectors.toList());
    }

    /**
     * Delete template by ID
     */
    @Transactional
    public void deleteTemplate(String id) {
        log.info("Deleting template with ID: {}", id);

        Template template = templateRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Template not found with ID: " + id));

        if (!template.getCanDelete()) {
            throw new IllegalArgumentException("This template cannot be deleted");
        }

        templateRepository.delete(template);
        log.info("Template deleted successfully with ID: {}", id);
    }

    /**
     * Get template count by institute and type
     */
    public long getTemplateCountByInstituteAndType(String instituteId, String type) {
        return templateRepository.countByInstituteIdAndType(instituteId, type);
    }

    /**
     * Get template count by institute
     */
    public long getTemplateCountByInstitute(String instituteId) {
        return templateRepository.countByInstituteId(instituteId);
    }

    /**
     * Check if template exists by name for institute
     */
    public boolean templateExistsByName(String instituteId, String name) {
        return templateRepository.existsByInstituteIdAndName(instituteId, name);
    }

    /**
     * Get WhatsApp template for a specific event and institute
     * Used by notification-service for WhatsApp OTP
     * Falls back to DEFAULT institute if no custom template found
     * 
     * @param eventName   Event name (e.g., "OTP_REQUEST")
     * @param instituteId Institute ID
     * @return Map containing template configuration
     */
    public Map<String, Object> getTemplateForEvent(String eventName, String instituteId) {
        log.info("Fetching WhatsApp template for event: {}, institute: {}", eventName, instituteId);

        try {
            // Step 1: Try to find institute-specific event configuration
            Optional<NotificationEventConfig> eventConfig = eventConfigRepository
                    .findFirstByEventNameAndSourceTypeAndSourceIdAndTemplateTypeAndIsActiveTrueOrderByUpdatedAtDesc(
                            NotificationEventType.valueOf(eventName),
                            NotificationSourceType.INSTITUTE,
                            instituteId,
                            NotificationTemplateType.WHATSAPP);

            // Step 2: Fallback to default event configuration
            if (eventConfig.isEmpty()) {
                log.info("No custom event config found for institute: {}, using DEFAULT", instituteId);
                eventConfig = eventConfigRepository
                        .findFirstByEventNameAndSourceTypeAndSourceIdAndTemplateTypeAndIsActiveTrueOrderByUpdatedAtDesc(
                                NotificationEventType.valueOf(eventName),
                                NotificationSourceType.INSTITUTE,
                                "DEFAULT",
                                NotificationTemplateType.WHATSAPP);
            }

            if (eventConfig.isEmpty()) {
                log.error("No event configuration found for event: {}", eventName);
                throw new RuntimeException("No template configuration found for event: " + eventName);
            }

            // Step 3: Fetch template by template_id
            String templateId = eventConfig.get().getTemplateId();
            Template template = templateRepository.findById(templateId)
                    .orElseThrow(() -> new RuntimeException("Template not found: " + templateId));

            // Step 4: Parse setting_json and return as Map
            Map<String, Object> result = new HashMap<>();
            result.put("templateName", template.getName());

            // Parse setting_json
            if (template.getSettingJson() != null && !template.getSettingJson().isBlank()) {
                JsonNode settingJson = objectMapper.readTree(template.getSettingJson());

                // Extract language code
                String languageCode = settingJson.path("language_code").asText("en");
                result.put("languageCode", languageCode);

                // Extract parameters - convert JsonNode to Map for proper JSON serialization
                if (settingJson.has("parameters")) {
                    // Convert JsonNode to Map so it can be properly serialized/deserialized
                    Map<String, Object> parameters = objectMapper.convertValue(
                            settingJson.get("parameters"),
                            new com.fasterxml.jackson.core.type.TypeReference<Map<String, Object>>() {
                            });
                    result.put("parameterConfig", parameters);
                }
            } else {
                result.put("languageCode", "en");
            }

            log.info("Successfully fetched template: {} for event: {}", template.getName(), eventName);
            return result;

        } catch (Exception e) {
            log.error("Error fetching template for event {}: {}", eventName, e.getMessage(), e);
            throw new RuntimeException("Failed to fetch template configuration", e);
        }
    }

    /**
     * Convert Template entity to TemplateResponse DTO
     */
    private TemplateResponse convertToResponse(Template template) {
        // Parse dynamic parameters from JSON if present
        Map<String, Object> dynamicParameters = null;
        if (template.getDynamicParameters() != null && !template.getDynamicParameters().trim().isEmpty()) {
            try {
                @SuppressWarnings("unchecked")
                Map<String, Object> parsedParams = objectMapper.readValue(template.getDynamicParameters(), Map.class);
                dynamicParameters = parsedParams;
            } catch (JsonProcessingException e) {
                log.warn("Error parsing dynamic parameters JSON for template {}: {}", template.getId(), e.getMessage());
            }
        }

        // Parse settings JSON if present
        Map<String, Object> settingJson = null;
        if (template.getSettingJson() != null && !template.getSettingJson().trim().isEmpty()) {
            try {
                @SuppressWarnings("unchecked")
                Map<String, Object> parsedSettings = objectMapper.readValue(template.getSettingJson(), Map.class);
                settingJson = parsedSettings;
            } catch (JsonProcessingException e) {
                log.warn("Error parsing settings JSON for template {}: {}", template.getId(), e.getMessage());
            }
        }

        return TemplateResponse.builder()
                .id(template.getId())
                .type(template.getType())
                .vendorId(template.getVendorId())
                .instituteId(template.getInstituteId())
                .name(template.getName())
                .subject(template.getSubject())
                .content(template.getContent())
                .contentType(template.getContentType())
                .settingJson(settingJson)
                .dynamicParameters(dynamicParameters)
                .canDelete(template.getCanDelete())
                .status(template.getStatus())
                .templateCategory(template.getTemplateCategory())
                .createdAt(template.getCreatedAt())
                .updatedAt(template.getUpdatedAt())
                .createdBy(template.getCreatedBy())
                .updatedBy(template.getUpdatedBy())
                .build();
    }

    /**
     * Convert Template entity to TemplateSummaryResponse DTO (excludes large
     * fields)
     */
    private TemplateSummaryResponse convertToSummaryResponse(Template template) {
        return TemplateSummaryResponse.builder()
                .id(template.getId())
                .type(template.getType())
                .vendorId(template.getVendorId())
                .instituteId(template.getInstituteId())
                .name(template.getName())
                .subject(template.getSubject())
                .contentType(template.getContentType())
                .canDelete(template.getCanDelete())
                .status(template.getStatus())
                .templateCategory(template.getTemplateCategory())
                .createdAt(template.getCreatedAt())
                .updatedAt(template.getUpdatedAt())
                .createdBy(template.getCreatedBy())
                .updatedBy(template.getUpdatedBy())
                .build();
    }
}
