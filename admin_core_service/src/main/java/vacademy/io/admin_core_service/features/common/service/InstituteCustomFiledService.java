package vacademy.io.admin_core_service.features.common.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.common.dto.CustomFieldDTO;
import vacademy.io.admin_core_service.features.common.util.CustomFieldKeyGenerator;
import vacademy.io.admin_core_service.features.common.dto.InstituteCustomFieldDTO;
import vacademy.io.admin_core_service.features.common.dto.InstituteCustomFieldDeleteRequestDTO;
import vacademy.io.admin_core_service.features.common.entity.CustomFieldValues;
import vacademy.io.admin_core_service.features.common.enums.CustomFieldTypeEnum;
import vacademy.io.admin_core_service.features.common.enums.FieldTypeEnum;
import vacademy.io.admin_core_service.features.common.repository.CustomFieldValuesRepository;
import vacademy.io.admin_core_service.features.institute_learner.dto.InstituteCustomFieldSetupDTO;
import vacademy.io.admin_core_service.features.common.entity.CustomFields;
import vacademy.io.admin_core_service.features.common.entity.InstituteCustomField;
import vacademy.io.admin_core_service.features.common.enums.StatusEnum;
import vacademy.io.admin_core_service.features.common.repository.CustomFieldRepository;
import vacademy.io.admin_core_service.features.common.repository.InstituteCustomFieldRepository;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.Institute;

import java.sql.Timestamp;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class InstituteCustomFiledService {
    @Autowired
    private InstituteCustomFieldRepository instituteCustomFieldRepository;

    @Autowired
    private CustomFieldRepository customFieldRepository;

    @Autowired
    private CustomFieldKeyGenerator keyGenerator;

    @Autowired
    private CustomFieldValuesRepository customFieldValuesRepository;

    @Transactional
    public void addOrUpdateCustomField(List<InstituteCustomFieldDTO> cfDTOs) {
        List<InstituteCustomField> instCFList = new ArrayList<>();

        for (InstituteCustomFieldDTO dto : cfDTOs) {
            CustomFieldDTO cfDto = dto.getCustomField();
            if (cfDto == null) {
                continue;
            }

            CustomFields cf;

            if (StringUtils.hasText(cfDto.getId())) {
                Optional<CustomFields> existingCF = customFieldRepository.findById(cfDto.getId());
                if (existingCF.isEmpty()) {
                    throw new VacademyException("Custom Field Not Found");
                }
                cf = existingCF.get();

            } else {
                String fieldKey = keyGenerator.generateFieldKey(cfDto.getFieldName(), dto.getInstituteId());
                cf = findOrCreateCustomFieldWithLock(fieldKey, cfDto);
            }

            Optional<InstituteCustomField> optionalInstCF = instituteCustomFieldRepository
                    .findTopByInstituteIdAndCustomFieldIdAndTypeAndTypeIdAndStatusOrderByCreatedAtDesc(
                            dto.getInstituteId(),
                            cf.getId(),
                            dto.getType(),
                            dto.getTypeId(),
                            StatusEnum.ACTIVE.name());

            InstituteCustomField instCF;

            if (optionalInstCF.isPresent()) {
                instCF = optionalInstCF.get();
                // Update mutable fields for existing mapping
                if (StringUtils.hasText(dto.getGroupName())) {
                    instCF.setGroupName(dto.getGroupName());
                }
                if (dto.getGroupInternalOrder() != null) {
                    instCF.setGroupInternalOrder(dto.getGroupInternalOrder());
                }
                if (dto.getIndividualOrder() != null) {
                    instCF.setIndividualOrder(dto.getIndividualOrder());
                }
            } else {
                instCF = new InstituteCustomField(dto);
                instCF.setCustomFieldId(cf.getId());
            }
        }

        if (!instCFList.isEmpty()) {
            instituteCustomFieldRepository.saveAll(instCFList);
        }
    }

    /**
     * Find existing custom field or create new one with pessimistic locking to
     * prevent duplicates.
     * This method uses database-level locking to ensure only one thread can create
     * a field with the same key.
     */
    private CustomFields findOrCreateCustomFieldWithLock(String fieldKey, CustomFieldDTO cfDto) {
        Optional<CustomFields> existing = customFieldRepository.findByFieldKeyWithLock(fieldKey,
                StatusEnum.ACTIVE.name());
        if (existing.isPresent()) {
            return existing.get();
        }
        CustomFields newCF = new CustomFields(cfDto);
        newCF.setFieldKey(fieldKey);
        return customFieldRepository.save(newCF);
    }

    public List<InstituteCustomFieldDTO> findCustomFieldsAsJson(String instituteId, String type, String typeId) {

        // Step 1: Call the repository to fetch the joined entities
        List<Object[]> results = instituteCustomFieldRepository.findInstituteCustomFieldsWithDetails(instituteId, type,
                typeId);

        // Step 2: Convert the list of results into a list of InstituteCustomFieldDTOs
        List<InstituteCustomFieldDTO> dtoList = results.stream()
                .map(this::convertToInstituteCustomFieldDto)
                .collect(Collectors.toList());

        return dtoList;
    }

    public List<InstituteCustomFieldDTO> findActiveCustomFieldsWithNullTypeId(String instituteId) {
        List<Object[]> results = instituteCustomFieldRepository
                .findActiveInstituteCustomFieldsWithNullTypeId(instituteId, StatusEnum.ACTIVE.name());
        return results.stream().map(this::convertToInstituteCustomFieldDto).collect(Collectors.toList());
    }

    public int softDeleteInstituteCustomField(String instituteId, String type, String customFieldId) {
        return instituteCustomFieldRepository.updateStatusByInstituteIdAndTypeAndCustomFieldId(
                instituteId, type, customFieldId, StatusEnum.DELETED.name());
    }

    public int softDeleteInstituteCustomFieldsBulk(List<InstituteCustomFieldDeleteRequestDTO> requestDTOS,
            String instituteId) {
        if (requestDTOS == null || requestDTOS.isEmpty())
            return 0;
        int total = 0;
        for (InstituteCustomFieldDeleteRequestDTO entry : requestDTOS) {
            total += instituteCustomFieldRepository.updateStatusByInstituteIdAndTypeAndCustomFieldId(
                    instituteId, entry.getType(), entry.getCustomFieldId(), StatusEnum.DELETED.name());
        }
        return total;
    }

    public List<InstituteCustomFieldSetupDTO> findUniqueActiveCustomFieldsByInstituteId(String instituteId) {
        List<Object[]> results = instituteCustomFieldRepository
                .findUniqueActiveCustomFieldsByInstituteId(instituteId, StatusEnum.ACTIVE.name());
        return results.stream().map(this::convertToInstituteCustomFieldSetupDto).collect(Collectors.toList());
    }

    /**
     * Helper method to convert a result object array into a populated
     * InstituteCustomFieldDTO.
     *
     * @param result An object array containing [InstituteCustomField,
     *               CustomFields].
     * @return A populated InstituteCustomFieldDTO.
     */
    private InstituteCustomFieldDTO convertToInstituteCustomFieldDto(Object[] result) {
        InstituteCustomField icf = (InstituteCustomField) result[0];
        CustomFields cf = (CustomFields) result[1];

        // Create and populate the nested CustomFieldDTO
        CustomFieldDTO customFieldDTO = new CustomFieldDTO();
        customFieldDTO.setId(cf.getId());
        customFieldDTO.setFieldKey(cf.getFieldKey());
        customFieldDTO.setFieldName(cf.getFieldName());
        customFieldDTO.setFieldType(cf.getFieldType());
        customFieldDTO.setDefaultValue(cf.getDefaultValue());
        customFieldDTO.setConfig(cf.getConfig());
        customFieldDTO.setFormOrder(cf.getFormOrder());
        customFieldDTO.setIsMandatory(cf.getIsMandatory());
        customFieldDTO.setIsFilter(cf.getIsFilter());
        customFieldDTO.setIsSortable(cf.getIsSortable());
        customFieldDTO.setIsHidden(cf.getIsHidden());
        if (cf.getCreatedAt() != null) {
            customFieldDTO.setCreatedAt(new Timestamp(cf.getCreatedAt().getTime()));
        }
        if (cf.getUpdatedAt() != null) {
            customFieldDTO.setUpdatedAt(new Timestamp(cf.getUpdatedAt().getTime()));
        }

        customFieldDTO.setSessionId(icf.getTypeId());

        InstituteCustomFieldDTO instituteDTO = new InstituteCustomFieldDTO();
        instituteDTO.setId(icf.getId());
        instituteDTO.setInstituteId(icf.getInstituteId());
        instituteDTO.setType(icf.getType());
        instituteDTO.setTypeId(icf.getTypeId());
        instituteDTO.setGroupName(icf.getGroupName());
        instituteDTO.setCustomField(customFieldDTO);
        instituteDTO.setStatus(icf.getStatus());
        return instituteDTO;
    }

    private InstituteCustomFieldSetupDTO convertToInstituteCustomFieldSetupDto(Object[] result) {
        InstituteCustomField icf = (InstituteCustomField) result[0];
        CustomFields cf = (CustomFields) result[1];

        InstituteCustomFieldSetupDTO setupDTO = new InstituteCustomFieldSetupDTO();
        setupDTO.setCustomFieldId(cf.getId());
        setupDTO.setFieldKey(cf.getFieldKey());
        setupDTO.setFieldName(cf.getFieldName());
        setupDTO.setFieldType(cf.getFieldType());
        setupDTO.setFormOrder(cf.getFormOrder());
        setupDTO.setIsHidden(cf.getIsHidden());
        setupDTO.setGroupName(icf.getGroupName());
        setupDTO.setType(icf.getType());
        setupDTO.setTypeId(icf.getTypeId());
        setupDTO.setStatus(icf.getStatus());

        return setupDTO;
    }

    public List<InstituteCustomField> createDefaultCustomFieldsForInstitute(Institute institute) {
        CustomFields nameCustomFields = CustomFields.builder()
                .fieldKey("name")
                .fieldName("name")
                .defaultValue(null)
                .fieldType("text")
                .config("{}")
                .isMandatory(false)
                .isFilter(true)
                .isSortable(true)
                .build();

        CustomFields emailCustomFields = CustomFields.builder()
                .fieldKey("email")
                .fieldName("email")
                .defaultValue(null)
                .fieldType("text")
                .config("{}")
                .isMandatory(false)
                .isFilter(true)
                .isSortable(true)
                .build();

        CustomFields phoneCustomFields = CustomFields.builder()
                .fieldKey("phone")
                .fieldName("phone")
                .defaultValue(null)
                .fieldType("number")
                .config("{}")
                .isMandatory(false)
                .isFilter(true)
                .isSortable(true)
                .build();

        CustomFields usernameCustomFields = CustomFields.builder()
                .fieldKey("username")
                .fieldName("username")
                .defaultValue(null)
                .fieldType("text")
                .config("{}")
                .isMandatory(false)
                .isFilter(true)
                .isSortable(true)
                .build();

        CustomFields passwordCustomFields = CustomFields.builder()
                .fieldKey("password")
                .fieldName("password")
                .defaultValue(null)
                .fieldType("text")
                .config("{}")
                .isMandatory(false)
                .isFilter(true)
                .isSortable(true)
                .build();

        CustomFields batchCustomFields = CustomFields.builder()
                .fieldKey("batch")
                .fieldName("batch")
                .defaultValue(null)
                .fieldType("text")
                .config("{}")
                .isMandatory(false)
                .isFilter(true)
                .isSortable(true)
                .build();

        List<CustomFields> allDefaultCustomFields = List.of(nameCustomFields, emailCustomFields, usernameCustomFields,
                passwordCustomFields, batchCustomFields, phoneCustomFields);
        List<CustomFields> allSavedCustomFields = customFieldRepository.saveAll(allDefaultCustomFields);
        List<InstituteCustomField> defaultInstituteCustomFields = new ArrayList<>();

        allSavedCustomFields.forEach(customField -> {
            defaultInstituteCustomFields.add(InstituteCustomField.builder()
                    .customFieldId(customField.getId())
                    .instituteId(institute.getId())
                    .status("ACTIVE")
                    .type(CustomFieldTypeEnum.DEFAULT_CUSTOM_FIELD.name())
                    .build());
        });

        return instituteCustomFieldRepository.saveAll(defaultInstituteCustomFields);
    }

    public Optional<CustomFields> getCustomFieldById(String customFieldId) {
        return customFieldRepository.findById(customFieldId);
    }

    public CustomFields createCustomFieldFromRequest(CustomFieldDTO request, String instuteID) {
        if (Objects.isNull(request))
            throw new VacademyException("Invalid Request");

        // Generate field key if not provided
        String fieldKey = request.getFieldKey();
        if (fieldKey == null || fieldKey.trim().isEmpty()) {
            fieldKey = keyGenerator.generateFieldKey(request.getFieldName(), instuteID);
        }

        return customFieldRepository.save(CustomFields.builder()
                .fieldName(request.getFieldName())
                .fieldKey(fieldKey)
                .fieldType(request.getFieldType())
                .defaultValue(request.getDefaultValue())
                .config(request.getConfig())
                .isSortable(request.getIsSortable())
                .isMandatory(request.getIsMandatory()).build());
    }

    /**
     * Find custom field by field key for a specific institute.
     * First checks if the field exists with a proper institute mapping,
     * then falls back to global fieldKey lookup for backward compatibility with old
     * data.
     * Since fieldKey contains _inst_{instituteId}, the global lookup is still
     * institute-scoped.
     */
    public Optional<CustomFields> findCustomFieldByKeyAndInstitute(String fieldKey, String instituteId) {
        // First try to find via institute mapping (proper way)
        Optional<CustomFields> withMapping = customFieldRepository.findByFieldKeyAndInstituteId(fieldKey, instituteId);
        if (withMapping.isPresent()) {
            return withMapping;
        }
        // Fallback: check by fieldKey directly (for backward compatibility with old
        // data)
        // This works because fieldKey already contains _inst_{instituteId}
        return customFieldRepository.findTopByFieldKeyAndStatusOrderByCreatedAtDesc(fieldKey, StatusEnum.ACTIVE.name());
    }

    /**
     * Find custom field by field key globally
     */
    public Optional<CustomFields> findCustomFieldByKey(String fieldKey) {
        return customFieldRepository.findByFieldKey(fieldKey);
    }

    /**
     * Generate field key from field name
     */
    public String generateFieldKey(String fieldName, String instituteId) {
        return keyGenerator.generateFieldKey(fieldName, instituteId);
    }

    /**
     * Create or find existing custom field by key for institute.
     * Uses pessimistic locking to prevent race conditions and duplicates.
     */
    @Transactional
    public CustomFields createOrFindCustomFieldByKey(CustomFieldDTO request, String instituteId) {
        if (Objects.isNull(request))
            throw new VacademyException("Invalid Request");

        String fieldKey = keyGenerator.generateFieldKey(request.getFieldName(), instituteId);

        return findOrCreateCustomFieldWithLock(fieldKey, request);
    }

    public InstituteCustomField createInstituteMappingFromCustomField(CustomFields savedCustomField,
            Institute institute, CustomFieldDTO request) {
        return instituteCustomFieldRepository.save(InstituteCustomField.builder()
                .customFieldId(savedCustomField.getId())
                .instituteId(institute.getId())
                .type(CustomFieldTypeEnum.DEFAULT_CUSTOM_FIELD.name())
                .individualOrder(request.getIndividualOrder())
                .groupInternalOrder(request.getGroupInternalOrder()).build());
    }

    public String updateCustomField(Institute institute, CustomFieldDTO request, String fieldId) {
        Optional<CustomFields> customFieldsOptional = customFieldRepository.findById(fieldId);
        if (customFieldsOptional.isEmpty()) {
            throw new VacademyException("Custom Field Not Found");
        }

        CustomFields customField = customFieldsOptional.get();

        // Update fields from request DTO
        if (request.getFieldKey() != null)
            customField.setFieldKey(request.getFieldKey());
        if (request.getFieldName() != null)
            customField.setFieldName(request.getFieldName());
        if (request.getFieldType() != null)
            customField.setFieldType(request.getFieldType());
        if (request.getDefaultValue() != null)
            customField.setDefaultValue(request.getDefaultValue());
        if (request.getConfig() != null)
            customField.setConfig(request.getConfig());

        if (request.getFormOrder() != null)
            customField.setFormOrder(request.getFormOrder());
        if (request.getIsMandatory() != null)
            customField.setIsMandatory(request.getIsMandatory());
        if (request.getIsFilter() != null)
            customField.setIsFilter(request.getIsFilter());
        if (request.getIsSortable() != null)
            customField.setIsSortable(request.getIsSortable());

        // Save updated field
        customFieldRepository.save(customField);

        return "Custom Field with id " + fieldId + " updated successfully.";
    }

    public Optional<InstituteCustomField> getCustomFieldByInstituteIdAndName(String instituteId, String fieldName) {
        return instituteCustomFieldRepository.findByInstituteIdAndFieldName(instituteId, fieldName);
    }

    public Optional<InstituteCustomField> getByInstituteIdAndFieldIdAndTypeAndTypeId(String instituteId, String fieldId,
            String type, String typeId) {
        return instituteCustomFieldRepository
                .findTopByInstituteIdAndCustomFieldIdAndTypeAndTypeIdAndStatusOrderByCreatedAtDesc(instituteId, fieldId,
                        type, typeId, StatusEnum.ACTIVE.name());
    }

    public InstituteCustomField createorupdateinstutefieldmapping(InstituteCustomField instituteCustomField) {
        return instituteCustomFieldRepository.save(instituteCustomField);
    }

    public List<InstituteCustomField> createOrUpdateMappings(List<InstituteCustomField> allMappings) {
        return instituteCustomFieldRepository.saveAll(allMappings);
    }

    public List<InstituteCustomField> getAllMappingFromIds(List<String> request) {
        return instituteCustomFieldRepository.findAllById(request);
    }

    public List<CustomFields> getAllCustomFields(List<String> allFieldIds) {
        return customFieldRepository.findAllById(allFieldIds);
    }

    public void createOrSaveAllFields(List<CustomFields> allFields) {
        customFieldRepository.saveAll(allFields);
    }

    public List<InstituteCustomField> getCusFieldByInstituteAndTypeAndTypeId(String instituteId, String type,
            String typeId, List<String> status) {
        return instituteCustomFieldRepository.findByInstituteIdAndTypeAndTypeIdAndStatusIn(instituteId, type, typeId,
                status);
    }

    public CustomFieldDTO getCustomFieldDtoFromId(String customFieldId) {
        Optional<CustomFields> customFields = customFieldRepository.findById(customFieldId);
        if (customFields.isPresent()) {
            return CustomFieldDTO.builder()
                    .id(customFieldId)
                    .fieldName(customFields.get().getFieldName())
                    .fieldKey(customFields.get().getFieldKey())
                    .fieldType(customFields.get().getFieldType())
                    .defaultValue(customFields.get().getDefaultValue())
                    .build();
        }
        throw new VacademyException("Custom Field Not Found");
    }

    public List<InstituteCustomField> getAllMappingFromFieldsIds(String instituteId, List<CustomFields> allFields,
            List<String> status) {
        return instituteCustomFieldRepository.findByInstituteIdAndCustomFieldIdInAndStatusIn(instituteId,
                allFields.stream().map(CustomFields::getId).toList(), status);
    }

    public List<CustomFieldValues> updateOrCreateCustomFieldsValues(List<CustomFieldValues> response) {
        return customFieldValuesRepository.saveAll(response);
    }

    /**
     * Get all active DROPDOWN type custom fields for an institute
     * Database query handles deduplication using DISTINCT ON
     */
    public List<CustomFieldDTO> getActiveDropdownCustomFields(String instituteId) {
        List<CustomFields> dropdownFields = customFieldRepository.findDropdownCustomFieldsByInstituteId(
                instituteId,
                FieldTypeEnum.DROPDOWN.name(),
                StatusEnum.ACTIVE.name());

        return dropdownFields.stream()
                .map(field -> CustomFieldDTO.builder()
                        .id(field.getId())
                        .fieldKey(field.getFieldKey())
                        .fieldName(field.getFieldName())
                        .fieldType(field.getFieldType())
                        .defaultValue(field.getDefaultValue())
                        .config(field.getConfig())
                        .formOrder(field.getFormOrder())
                        .isMandatory(field.getIsMandatory())
                        .isFilter(field.getIsFilter())
                        .isSortable(field.getIsSortable())
                        .isHidden(field.getIsHidden())
                        .createdAt(new Timestamp(field.getCreatedAt().getTime()))
                        .updatedAt(new Timestamp(field.getUpdatedAt().getTime()))
                        .build())
                .collect(Collectors.toList());
    }

    public List<vacademy.io.admin_core_service.features.institute.dto.settings.custom_field.CustomFieldUsageDTO> getCustomFieldsUsage(
            String instituteId) {
        List<Object[]> rawData = instituteCustomFieldRepository.findCustomFieldUsageAggregation(instituteId);

        // Map to hold Usage DTOs keyed by CustomField ID
        Map<String, vacademy.io.admin_core_service.features.institute.dto.settings.custom_field.CustomFieldUsageDTO> usageMap = new HashMap<>();

        for (Object[] row : rawData) {
            CustomFields cf = (CustomFields) row[0];
            String type = (String) row[1];
            Long count = (Long) row[2];

            vacademy.io.admin_core_service.features.institute.dto.settings.custom_field.CustomFieldUsageDTO usageDTO = usageMap
                    .computeIfAbsent(cf.getId(), k -> {
                        CustomFieldDTO cfDTO = CustomFieldDTO.builder()
                                .id(cf.getId())
                                .fieldName(cf.getFieldName())
                                .fieldKey(cf.getFieldKey())
                                .fieldType(cf.getFieldType())
                                .defaultValue(cf.getDefaultValue())
                                .config(cf.getConfig())
                                .formOrder(cf.getFormOrder())
                                .isMandatory(cf.getIsMandatory())
                                .isFilter(cf.getIsFilter())
                                .isSortable(cf.getIsSortable())
                                .isHidden(cf.getIsHidden())
                                .build();

                        return vacademy.io.admin_core_service.features.institute.dto.settings.custom_field.CustomFieldUsageDTO
                                .builder()
                                .customField(cfDTO)
                                .isDefault(false)
                                .enrollInviteCount(0)
                                .audienceCount(0)
                                .build();
                    });

            if (CustomFieldTypeEnum.DEFAULT_CUSTOM_FIELD.name().equals(type)) {
                usageDTO.setDefault(true);
            } else if (CustomFieldTypeEnum.ENROLL_INVITE.name().equals(type)) {
                usageDTO.setEnrollInviteCount(usageDTO.getEnrollInviteCount() + count);
            } else if (CustomFieldTypeEnum.AUDIENCE_FORM.name().equals(type)) {
                usageDTO.setAudienceCount(usageDTO.getAudienceCount() + count);
            }
        }

        return new ArrayList<>(usageMap.values());
    }
}
