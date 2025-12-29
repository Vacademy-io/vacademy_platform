package vacademy.io.admin_core_service.features.audience.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.audience.dto.FieldMappingConfigDTO;
import vacademy.io.admin_core_service.features.audience.dto.FormWebhookRequestDTO;
import vacademy.io.admin_core_service.features.audience.dto.ProcessedFormDataDTO;
import vacademy.io.admin_core_service.features.audience.entity.Audience;
import vacademy.io.admin_core_service.features.audience.entity.FormWebhookConnector;
import vacademy.io.admin_core_service.features.audience.enums.FormProviderEnum;
import vacademy.io.admin_core_service.features.audience.repository.AudienceRepository;
import vacademy.io.admin_core_service.features.audience.repository.FormWebhookConnectorRepository;
import vacademy.io.admin_core_service.features.audience.strategy.FormWebhookStrategy;
import vacademy.io.admin_core_service.features.audience.strategy.GoogleFormWebhookStrategy;
import vacademy.io.admin_core_service.features.audience.strategy.MicrosoftFormWebhookStrategy;
import vacademy.io.admin_core_service.features.audience.strategy.ZohoFormWebhookStrategy;
import vacademy.io.common.exceptions.VacademyException;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/**
 * Service for handling form webhook submissions
 * Uses Strategy pattern to support different form providers
 * Now supports dynamic field mapping via FormWebhookConnector
 */
@Service
public class FormWebhookService {
    
    private static final Logger logger = LoggerFactory.getLogger(FormWebhookService.class);
    
    @Autowired
    private ZohoFormWebhookStrategy zohoFormWebhookStrategy;
    
    @Autowired
    private GoogleFormWebhookStrategy googleFormWebhookStrategy;
    
    @Autowired
    private MicrosoftFormWebhookStrategy microsoftFormWebhookStrategy;
    
    @Autowired
    private AudienceService audienceService;
    
    @Autowired
    private FormWebhookConnectorRepository connectorRepository;
    
    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private AudienceRepository audienceRepository;
    
    private final Map<String, FormWebhookStrategy> strategyMap = new HashMap<>();
    
    /**
     * Initialize strategy map after bean creation
     */
    @Autowired
    public void initStrategyMap() {
        strategyMap.put(FormProviderEnum.ZOHO_FORMS.getCode(), zohoFormWebhookStrategy);
        strategyMap.put(FormProviderEnum.GOOGLE_FORMS.getCode(), googleFormWebhookStrategy);
        strategyMap.put(FormProviderEnum.MICROSOFT_FORMS.getCode(), microsoftFormWebhookStrategy);
        logger.info("Initialized form webhook strategies: {}", strategyMap.keySet());
    }
    
    /**
     * Process form webhook submission using vendor_id approach
     * This is the NEW scalable approach that uses FormWebhookConnector
     *
     * @param vendorId Unique identifier from form provider
     * @param payload Raw webhook payload
     * @return Response ID from audience service
     */
    public String processFormWebhookByVendorId(String vendorId, Map<String, Object> payload) {
        logger.info("Processing form webhook | Vendor ID: {}", vendorId);
        
        // Step 1: Look up connector configuration
        FormWebhookConnector connector = connectorRepository.findByVendorIdAndIsActiveTrue(vendorId)
                .orElseThrow(() -> new VacademyException(
                        String.format("No active form webhook connector found for vendorId: %s",  vendorId)
                ));
        
        logger.info("Found connector | Institute: {} | Audience: {}", 
                connector.getInstituteId(), connector.getAudienceId());
        
        // Step 2: Parse field mapping configuration from sample_map_json
        FieldMappingConfigDTO fieldMapping = parseFieldMapping(connector.getSampleMapJson());
        
        // Step 3: Get appropriate strategy based on vendor
        FormWebhookStrategy strategy = getStrategy(connector.getVendor());
        
        // Step 4: Validate payload structure
        if (!strategy.validatePayload(payload)) {
            throw new VacademyException("Invalid webhook payload for vendor: " + connector.getVendor());
        }
        
        // Step 5: Process payload using strategy
        ProcessedFormDataDTO processedData = strategy.processWebhookPayload(payload);
        logger.info("Successfully processed webhook payload with {} fields", processedData.getFormFields().size());
        
        // Step 6: Apply field mapping to transform field names
        ProcessedFormDataDTO mappedData = applyFieldMapping(processedData, fieldMapping);

        addAudienceRelatedData(connector.getAudienceId(),mappedData);
        
        // Step 7: Submit to audience service
        String responseId = audienceService.submitLeadFromFormWebhook(
                connector.getAudienceId(),
                mappedData,
                connector.getVendor()
        );
        
        logger.info("Form webhook processed successfully | Connector: {} | Response ID: {}", 
                connector.getId(), responseId);
        return responseId;
    }
    
    /**
     * Parse field mapping configuration from JSON string
     * @param sampleMapJson JSON string containing field mappings
     * @return FieldMappingConfigDTO or empty config if null/invalid
     */
    private FieldMappingConfigDTO parseFieldMapping(String sampleMapJson) {
        if (!StringUtils.hasText(sampleMapJson)) {
            logger.warn("No field mapping configuration found, using empty mapping");
            return FieldMappingConfigDTO.builder()
                    .fieldMapping(new HashMap<>())
                    .build();
        }
        
        try {
            Map<String, String> mapping = objectMapper.readValue(
                    sampleMapJson, 
                    new TypeReference<Map<String, String>>() {}
            );
            logger.debug("Parsed field mapping with {} entries", mapping.size());
            return FieldMappingConfigDTO.builder()
                    .fieldMapping(mapping)
                    .build();
        } catch (Exception e) {
            logger.error("Failed to parse field mapping JSON: {}", sampleMapJson, e);
            throw new VacademyException("Invalid field mapping configuration: " + e.getMessage());
        }
    }

    private ProcessedFormDataDTO applyFieldMapping(ProcessedFormDataDTO processedData, FieldMappingConfigDTO fieldMapping) {
        if (fieldMapping == null || fieldMapping.getFieldMapping() == null || fieldMapping.getFieldMapping().isEmpty()) {
            logger.debug("No field mapping to apply, returning original data");
            return processedData;
        }
        
        Map<String, String> originalFields = processedData.getFormFields();
        Map<String, String> mappedFields = new HashMap<>();
        
        int mappedCount = 0;
        int unmappedCount = 0;
        
        for (Map.Entry<String, String> entry : originalFields.entrySet()) {
            String originalFieldName = entry.getKey();
            String value = entry.getValue();
            
            // Check if this field has a mapping
            String mappedFieldName = fieldMapping.getMappedFieldName(originalFieldName);
            
            if (mappedFieldName != null) {
                // Use mapped name
                mappedFields.put(mappedFieldName, value);
                mappedCount++;
                logger.debug("Mapped field: '{}' -> '{}'", originalFieldName, mappedFieldName);
            } else {
                // Keep original name if no mapping
                mappedFields.put(originalFieldName, value);
                unmappedCount++;
                logger.debug("No mapping for field: '{}', keeping original name", originalFieldName);
            }
        }
        
        logger.info("Field mapping applied | Mapped: {} | Unmapped: {} | Total: {}", 
                mappedCount, unmappedCount, mappedFields.size());
        
        // Update email, fullName, phone if they were mapped
        String email = mappedFields.get("email");
        String fullName = mappedFields.get("fullName");
        String phone = mappedFields.get("phoneNumber");
        
        return ProcessedFormDataDTO.builder()
                .formFields(mappedFields)
                .email(StringUtils.hasText(email) ? email : processedData.getEmail())
                .fullName(StringUtils.hasText(fullName) ? fullName : processedData.getFullName())
                .phone(StringUtils.hasText(phone) ? phone : processedData.getPhone())
                .metadata(processedData.getMetadata())
                .build();
    }
    
    /**
     * DEPRECATED: Old method that uses audience_id directly in request
     * Use processFormWebhookByVendorId() instead for better scalability
     * 
     * @param requestDTO Webhook request containing form provider and payload
     * @return Response ID from audience service
     */
    @Deprecated
    public String processFormWebhook(FormWebhookRequestDTO requestDTO) {
        logger.info("[DEPRECATED] Processing form webhook for provider: {}, audienceId: {}", 
                requestDTO.getFormProvider(), requestDTO.getAudienceId());
        logger.warn("This method is deprecated. Use processFormWebhookByVendorId() instead.");
        
        // Validate request
        validateWebhookRequest(requestDTO);
        
        // Get appropriate strategy based on form provider
        FormWebhookStrategy strategy = getStrategy(requestDTO.getFormProvider());
        
        // Validate payload structure
        if (!strategy.validatePayload(requestDTO.getPayload())) {
            throw new VacademyException("Invalid webhook payload for provider: " + requestDTO.getFormProvider());
        }
        
        // Process payload using strategy
        ProcessedFormDataDTO processedData = strategy.processWebhookPayload(requestDTO.getPayload());
        logger.info("Successfully processed webhook payload with {} fields", processedData.getFormFields().size());
        
        // Submit to audience service using field names
        String responseId = audienceService.submitLeadFromFormWebhook(
                requestDTO.getAudienceId(),
                processedData,
                requestDTO.getFormProvider()
        );
        
        logger.info("Form webhook processed successfully. Response ID: {}", responseId);
        return responseId;
    }
    
    /**
     * Get the appropriate strategy for the given form provider
     */
    private FormWebhookStrategy getStrategy(String formProvider) {
        if (!StringUtils.hasText(formProvider)) {
            throw new VacademyException("Form provider is required");
        }
        
        // Validate form provider enum
        try {
            FormProviderEnum.fromCode(formProvider);
        } catch (IllegalArgumentException e) {
            throw new VacademyException("Invalid form provider: " + formProvider);
        }
        
        FormWebhookStrategy strategy = strategyMap.get(formProvider);
        if (strategy == null) {
            throw new VacademyException("No strategy found for form provider: " + formProvider);
        }
        
        return strategy;
    }
    
    /**
     * Validate webhook request
     */
    private void validateWebhookRequest(FormWebhookRequestDTO requestDTO) {
        if (requestDTO == null) {
            throw new VacademyException("Webhook request is null");
        }
        
        if (!StringUtils.hasText(requestDTO.getFormProvider())) {
            throw new VacademyException("Form provider is required");
        }
        
        if (!StringUtils.hasText(requestDTO.getAudienceId())) {
            throw new VacademyException("Audience ID is required");
        }
        
        if (requestDTO.getPayload() == null || requestDTO.getPayload().isEmpty()) {
            throw new VacademyException("Webhook payload is empty");
        }
    }
    private void addAudienceRelatedData(String audienceId, ProcessedFormDataDTO processData){
        Optional<Audience> audienceOptional=audienceRepository.findById(audienceId);
        if(audienceOptional.isEmpty()){
            logger.info("no audience campign found");
            return;
        }
        Audience audience=audienceOptional.get();
        processData.getFormFields().put("center name",audience.getCampaignName());
        
        // Construct full name from first name and last name if they exist
        String firstName = processData.getFormFields().get("first name");
        String lastName = processData.getFormFields().get("last name");
        
        if (StringUtils.hasText(firstName) && StringUtils.hasText(lastName)) {
            processData.getFormFields().put("full name", firstName + " " + lastName);
            logger.debug("Constructed full name from first and last name: {}", firstName + " " + lastName);
        } else if (StringUtils.hasText(firstName)) {
            processData.getFormFields().put("full name", firstName);
            logger.debug("Using first name as full name: {}", firstName);
        } else if (StringUtils.hasText(lastName)) {
            processData.getFormFields().put("full name", lastName);
            logger.debug("Using last name as full name: {}", lastName);
        }
    }
}
