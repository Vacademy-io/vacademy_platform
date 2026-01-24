package vacademy.io.admin_core_service.features.common.manager;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.common.dto.SystemFieldCustomFieldMappingDTO;
import vacademy.io.admin_core_service.features.common.dto.SystemFieldInfoDTO;
import vacademy.io.admin_core_service.features.common.entity.CustomFields;
import vacademy.io.admin_core_service.features.common.entity.SystemFieldCustomFieldMapping;
import vacademy.io.admin_core_service.features.common.enums.SyncDirectionEnum;
import vacademy.io.admin_core_service.features.common.repository.CustomFieldRepository;
import vacademy.io.admin_core_service.features.common.repository.SystemFieldCustomFieldMappingRepository;
import vacademy.io.admin_core_service.features.common.service.SystemFieldMetadataService;
import vacademy.io.common.exceptions.VacademyException;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * Manager for handling system field ↔ custom field mappings.
 */
@Component
public class FieldMappingManager {

    @Autowired
    private SystemFieldCustomFieldMappingRepository mappingRepository;

    @Autowired
    private CustomFieldRepository customFieldRepository;

    @Autowired
    private SystemFieldMetadataService metadataService;

    /**
     * Create a new mapping between a system field and custom field.
     */
    @Transactional
    public SystemFieldCustomFieldMappingDTO createMapping(SystemFieldCustomFieldMappingDTO dto) {
        // Validate inputs
        if (!StringUtils.hasText(dto.getInstituteId())) {
            throw new VacademyException("Institute ID is required");
        }
        if (!StringUtils.hasText(dto.getEntityType())) {
            throw new VacademyException("Entity type is required");
        }
        if (!StringUtils.hasText(dto.getSystemFieldName())) {
            throw new VacademyException("System field name is required");
        }
        if (!StringUtils.hasText(dto.getCustomFieldId())) {
            throw new VacademyException("Custom field ID is required");
        }

        // Check if mapping already exists
        Optional<SystemFieldCustomFieldMapping> existing = mappingRepository
            .findByInstituteIdAndEntityTypeAndSystemFieldNameAndCustomFieldIdAndStatus(
                dto.getInstituteId(), dto.getEntityType(), 
                dto.getSystemFieldName(), dto.getCustomFieldId(), "ACTIVE");
        
        if (existing.isPresent()) {
            throw new VacademyException("This mapping already exists");
        }

        // Validate custom field exists
        Optional<CustomFields> customField = customFieldRepository.findById(dto.getCustomFieldId());
        if (customField.isEmpty()) {
            throw new VacademyException("Custom field not found: " + dto.getCustomFieldId());
        }

        // Create mapping
        SystemFieldCustomFieldMapping mapping = SystemFieldCustomFieldMapping.builder()
            .instituteId(dto.getInstituteId())
            .entityType(dto.getEntityType())
            .systemFieldName(dto.getSystemFieldName())
            .customFieldId(dto.getCustomFieldId())
            .syncDirection(dto.getSyncDirection() != null ? dto.getSyncDirection() : SyncDirectionEnum.BIDIRECTIONAL)
            .converterClass(dto.getConverterClass())
            .status("ACTIVE")
            .build();

        SystemFieldCustomFieldMapping saved = mappingRepository.save(mapping);
        return toDTO(saved, customField.get().getFieldName());
    }

    /**
     * Update an existing mapping.
     */
    @Transactional
    public SystemFieldCustomFieldMappingDTO updateMapping(String mappingId, SystemFieldCustomFieldMappingDTO dto) {
        SystemFieldCustomFieldMapping mapping = mappingRepository.findById(mappingId)
            .orElseThrow(() -> new VacademyException("Mapping not found: " + mappingId));

        if (dto.getSyncDirection() != null) {
            mapping.setSyncDirection(dto.getSyncDirection());
        }
        if (dto.getConverterClass() != null) {
            mapping.setConverterClass(dto.getConverterClass());
        }
        if (StringUtils.hasText(dto.getStatus())) {
            mapping.setStatus(dto.getStatus());
        }

        SystemFieldCustomFieldMapping saved = mappingRepository.save(mapping);
        
        Optional<CustomFields> customField = customFieldRepository.findById(saved.getCustomFieldId());
        return toDTO(saved, customField.map(CustomFields::getFieldName).orElse(null));
    }

    /**
     * Delete (soft delete) a mapping.
     */
    @Transactional
    public void deleteMapping(String mappingId) {
        SystemFieldCustomFieldMapping mapping = mappingRepository.findById(mappingId)
            .orElseThrow(() -> new VacademyException("Mapping not found: " + mappingId));
        
        mapping.setStatus("DELETED");
        mappingRepository.save(mapping);
    }

    /**
     * Get all mappings for an institute and entity type.
     */
    public List<SystemFieldCustomFieldMappingDTO> getMappings(String instituteId, String entityType) {
        List<SystemFieldCustomFieldMapping> mappings = mappingRepository
            .findByInstituteIdAndEntityTypeAndStatus(instituteId, entityType, "ACTIVE");
        
        List<SystemFieldCustomFieldMappingDTO> result = new ArrayList<>();
        for (SystemFieldCustomFieldMapping mapping : mappings) {
            Optional<CustomFields> customField = customFieldRepository.findById(mapping.getCustomFieldId());
            result.add(toDTO(mapping, customField.map(CustomFields::getFieldName).orElse(null)));
        }
        return result;
    }

    /**
     * Get available system fields for mapping (with mapping status).
     */
    public List<SystemFieldInfoDTO> getAvailableSystemFields(String instituteId, String entityType) {
        return metadataService.getAvailableSystemFields(instituteId, entityType);
    }

    /**
     * Get supported entity types.
     */
    public List<String> getSupportedEntityTypes() {
        return metadataService.getSupportedEntityTypes();
    }

    private SystemFieldCustomFieldMappingDTO toDTO(SystemFieldCustomFieldMapping mapping, String customFieldName) {
        return SystemFieldCustomFieldMappingDTO.builder()
            .id(mapping.getId())
            .instituteId(mapping.getInstituteId())
            .entityType(mapping.getEntityType())
            .systemFieldName(mapping.getSystemFieldName())
            .customFieldId(mapping.getCustomFieldId())
            .customFieldName(customFieldName)
            .syncDirection(mapping.getSyncDirection())
            .converterClass(mapping.getConverterClass())
            .status(mapping.getStatus())
            .build();
    }
}
