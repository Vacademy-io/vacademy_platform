package vacademy.io.admin_core_service.features.common.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.CollectionUtils;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.common.dto.CustomFieldDTO;
import vacademy.io.admin_core_service.features.common.dto.CustomFieldMappingUsageDTO;
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

            // First try to find ACTIVE field
            Optional<InstituteCustomField> optionalInstCF = instituteCustomFieldRepository
                    .findTopByInstituteIdAndCustomFieldIdAndTypeAndTypeIdAndStatusOrderByCreatedAtDesc(
                            dto.getInstituteId(),
                            cf.getId(),
                            dto.getType(),
                            dto.getTypeId(),
                            StatusEnum.ACTIVE.name());

            // If not found, try to find any field (including DELETED) to reactivate it
            if (optionalInstCF.isEmpty()) {
                List<InstituteCustomField> allFields = instituteCustomFieldRepository
                        .findByInstituteIdAndTypeAndTypeIdAndStatusIn(
                                dto.getInstituteId(),
                                dto.getType(),
                                dto.getTypeId(),
                                List.of(StatusEnum.ACTIVE.name(), StatusEnum.DELETED.name()));
                
                optionalInstCF = allFields.stream()
                        .filter(field -> field.getCustomFieldId().equals(cf.getId()))
                        .findFirst();
            }

            InstituteCustomField instCF;

            if (optionalInstCF.isPresent()) {
                instCF = optionalInstCF.get();
                // Reactivate if it was deleted
                if (StatusEnum.DELETED.name().equals(instCF.getStatus())) {
                    instCF.setStatus(StatusEnum.ACTIVE.name());
                }
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
                if (dto.getIsMandatory() != null) {
                    instCF.setIsMandatory(dto.getIsMandatory());
                }
            } else {
                instCF = new InstituteCustomField(dto);
                instCF.setCustomFieldId(cf.getId());
            }
            
            instCFList.add(instCF);
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

    /**
     * Unified per-feature custom-field sync.
     *
     * Used by every feature flow that owns its own list of custom fields
     * (Enroll Invite, Audience, Live Session, Assessment). Semantics:
     *
     *   1. Load every existing ACTIVE mapping for the (institute, type, typeId) tuple.
     *   2. Walk the incoming list:
     *        - If the entry has a customFieldId → reuse the existing master
     *          custom_fields row. Reactivate any matching DELETED mapping or
     *          create a new ACTIVE one.
     *        - If the entry has no customFieldId (an "ad-hoc" field added in
     *          the feature dialog) → create a new master custom_fields row
     *          AND a new mapping with the feature type/typeId. NO
     *          DEFAULT_CUSTOM_FIELD mapping is created — defaults are managed
     *          exclusively from Settings → Custom Fields.
     *   3. Soft-delete every previously-ACTIVE mapping that is no longer in
     *      the incoming list. Existing custom_field_values are untouched, so
     *      a future re-add of the same field reactivates and the answers
     *      come back.
     *
     * The caller is expected to have already persisted the parent entity
     * (so typeId is non-null) before calling this method.
     */
    @Transactional
    public void syncFeatureCustomFields(String instituteId,
                                        String type,
                                        String typeId,
                                        List<InstituteCustomFieldDTO> incoming) {
        if (!StringUtils.hasText(instituteId) || !StringUtils.hasText(type) || !StringUtils.hasText(typeId)) {
            throw new VacademyException("instituteId, type and typeId are required for syncFeatureCustomFields");
        }

        List<InstituteCustomFieldDTO> safeIncoming = incoming == null ? new ArrayList<>() : incoming;

        // Normalize: stamp every incoming DTO with the right institute/type/typeId,
        // and clear any stale primary key so the upsert path can find or create
        // the correct mapping.
        safeIncoming.forEach(dto -> {
            if (dto == null) return;
            dto.setInstituteId(instituteId);
            dto.setType(type);
            dto.setTypeId(typeId);
            dto.setId(null);
        });

        // 1. Persist (insert / reactivate / update) every incoming mapping.
        List<InstituteCustomFieldDTO> toUpsert = safeIncoming.stream()
                .filter(Objects::nonNull)
                .collect(Collectors.toList());
        if (!toUpsert.isEmpty()) {
            addOrUpdateCustomField(toUpsert);
        }

        // 2. Soft-delete every existing ACTIVE mapping that is not in the
        //    incoming set. We compare by customFieldId because that is the
        //    stable identifier of "which field is on this feature instance".
        List<InstituteCustomField> existingActive = instituteCustomFieldRepository
                .findByInstituteIdAndTypeAndTypeIdAndStatusIn(instituteId, type, typeId,
                        List.of(StatusEnum.ACTIVE.name()));

        if (CollectionUtils.isEmpty(existingActive)) {
            return;
        }

        Set<String> incomingFieldIds = toUpsert.stream()
                .map(dto -> dto.getCustomField() != null ? dto.getCustomField().getId() : dto.getFieldId())
                .filter(StringUtils::hasText)
                .collect(Collectors.toSet());

        List<InstituteCustomField> toDelete = existingActive.stream()
                .filter(row -> !incomingFieldIds.contains(row.getCustomFieldId()))
                .peek(row -> row.setStatus(StatusEnum.DELETED.name()))
                .collect(Collectors.toList());

        if (!toDelete.isEmpty()) {
            instituteCustomFieldRepository.saveAll(toDelete);
        }
    }

    public List<InstituteCustomFieldDTO> findCustomFieldsAsJson(String instituteId, String type, String typeId) {

        // Step 1: Call the repository to fetch the joined entities
        List<Object[]> results = instituteCustomFieldRepository.findInstituteCustomFieldsWithDetails(instituteId, type,
                typeId);

        // Step 2: Convert the list of results into a list of InstituteCustomFieldDTOs and filter only ACTIVE ones
        List<InstituteCustomFieldDTO> dtoList = results.stream()
                .map(this::convertToInstituteCustomFieldDto)
                .filter(dto -> StatusEnum.ACTIVE.name().equals(dto.getStatus()))
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

    /**
     * List every ACTIVE mapping for one custom field across all feature
     * instances. Used by the Settings → Custom Fields cascade-delete dialog
     * so the admin can pick which mappings to soft-delete (DEFAULT,
     * individual ENROLL_INVITE rows, individual AUDIENCE_FORM rows, etc.).
     *
     * <p>Returns a flat list — the frontend groups by {@code type} for display.
     */
    public List<CustomFieldMappingUsageDTO> getCustomFieldUsages(String instituteId, String customFieldId) {
        if (!StringUtils.hasText(instituteId) || !StringUtils.hasText(customFieldId)) {
            return new ArrayList<>();
        }
        List<InstituteCustomField> rows = instituteCustomFieldRepository
                .findByInstituteIdAndCustomFieldIdInAndStatusIn(
                        instituteId,
                        List.of(customFieldId),
                        List.of(StatusEnum.ACTIVE.name()));
        return rows.stream()
                .map(row -> CustomFieldMappingUsageDTO.builder()
                        .mappingId(row.getId())
                        .type(row.getType())
                        .typeId(row.getTypeId())
                        .status(row.getStatus())
                        .build())
                .collect(Collectors.toList());
    }

    /**
     * Soft-delete a list of {@code institute_custom_fields} rows by id.
     *
     * <p>"Delete" here means: status flipped to DELETED. Nothing else
     * happens — the master {@code custom_fields} row stays intact, and any
     * {@code custom_field_values} answers stored against the field stay in
     * place. This is intentional: the unified {@code syncFeatureCustomFields}
     * is reactivation-aware, so a future re-add of the same field on the
     * same feature instance flips the row back to ACTIVE and the answers
     * come back automatically.
     *
     * <p>Used by the Settings → Custom Fields cascade-delete dialog. Returns
     * the number of rows actually flipped (rows already DELETED are
     * skipped).
     */
    @Transactional
    public int softDeleteMappingsByIds(List<String> mappingIds) {
        if (CollectionUtils.isEmpty(mappingIds)) {
            return 0;
        }
        List<InstituteCustomField> rows = instituteCustomFieldRepository.findAllById(mappingIds);
        int flipped = 0;
        for (InstituteCustomField row : rows) {
            if (!StatusEnum.DELETED.name().equals(row.getStatus())) {
                row.setStatus(StatusEnum.DELETED.name());
                flipped++;
            }
        }
        if (flipped > 0) {
            instituteCustomFieldRepository.saveAll(rows);
        }
        return flipped;
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
        instituteDTO.setIndividualOrder(icf.getIndividualOrder());
        instituteDTO.setGroupInternalOrder(icf.getGroupInternalOrder());
        instituteDTO.setIsMandatory(icf.getIsMandatory());
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
                .fieldKey("full_name")
                .fieldName("Full Name")
                .defaultValue(null)
                .fieldType("text")
                .config("{}")
                .isMandatory(false)
                .isFilter(true)
                .isSortable(true)
                .build();

        CustomFields emailCustomFields = CustomFields.builder()
                .fieldKey("email")
                .fieldName("Email")
                .defaultValue(null)
                .fieldType("text")
                .config("{}")
                .isMandatory(false)
                .isFilter(true)
                .isSortable(true)
                .build();

        CustomFields phoneCustomFields = CustomFields.builder()
                .fieldKey("phone_number")
                .fieldName("Phone Number")
                .defaultValue(null)
                .fieldType("number")
                .config("{}")
                .isMandatory(false)
                .isFilter(true)
                .isSortable(true)
                .build();

        List<CustomFields> allDefaultCustomFields = List.of(nameCustomFields, emailCustomFields, phoneCustomFields);
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

    /**
     * Find default custom fields for an institute
     */
    public List<InstituteCustomField> findDefaultCustomFieldsByInstituteId(String instituteId) {
        return instituteCustomFieldRepository.findByInstituteIdAndTypeAndTypeIdAndStatusIn(
                instituteId,
                CustomFieldTypeEnum.DEFAULT_CUSTOM_FIELD.name(),
                null,
                List.of(StatusEnum.ACTIVE.name())
        );
    }

    /**
     * Copy default custom fields for an institute to enroll invite type.
     *
     * <p>Used only by <strong>system-generated</strong> enroll invite creation
     * paths (e.g. bulk course import, default enroll invite generation) where
     * there is no admin UI to pick fields. Admin-driven create / edit flows
     * should call {@link #syncFeatureCustomFields(String, String, String, java.util.List)}
     * directly with the explicit list the admin selected.
     *
     * <p>Routes through the unified sync so that re-runs are idempotent and
     * any previously soft-deleted mappings are reactivated rather than
     * duplicated.
     */
    public void copyDefaultCustomFieldsToEnrollInvite(String instituteId, String enrollInviteId) {
        if (instituteId == null || enrollInviteId == null) {
            return;
        }

        List<InstituteCustomFieldDTO> defaultCustomFieldsToCopy = getDefaultCustomFieldsForEnrollInvite(instituteId, enrollInviteId);
        if (!defaultCustomFieldsToCopy.isEmpty()) {
            syncFeatureCustomFields(instituteId,
                    CustomFieldTypeEnum.ENROLL_INVITE.name(),
                    enrollInviteId,
                    defaultCustomFieldsToCopy);
        }
    }

    /**
     * Get default custom fields for an institute and convert them to ENROLL_INVITE type for the given enroll invite ID
     */
    private List<InstituteCustomFieldDTO> getDefaultCustomFieldsForEnrollInvite(String instituteId, String enrollInviteId) {
        List<InstituteCustomField> defaultCustomFields = findDefaultCustomFieldsByInstituteId(instituteId);

        return defaultCustomFields.stream()
                .filter(defaultField -> defaultField.getCustomFieldId() != null) // Filter out any null customFieldIds
                .map(defaultField -> {
                    InstituteCustomFieldDTO dto = new InstituteCustomFieldDTO();
                    dto.setInstituteId(instituteId);
                    dto.setFieldId(defaultField.getCustomFieldId());
                    dto.setType(CustomFieldTypeEnum.ENROLL_INVITE.name());
                    dto.setTypeId(enrollInviteId);
                    dto.setStatus(StatusEnum.ACTIVE.name());
                    dto.setIndividualOrder(defaultField.getIndividualOrder());
                    dto.setGroupInternalOrder(defaultField.getGroupInternalOrder());
                    
                    // Set customField with id so addOrUpdateCustomField can find the existing CustomFields entity
                    CustomFieldDTO customFieldDTO = new CustomFieldDTO();
                    customFieldDTO.setId(defaultField.getCustomFieldId());
                    dto.setCustomField(customFieldDTO);
                    
                    return dto;
                })
                .collect(Collectors.toList());
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

    /**
     * Find custom fields by institute, type, and typeId (all statuses)
     */
    public List<InstituteCustomField> findByInstituteIdAndTypeAndTypeId(String instituteId, String type, String typeId) {
        return instituteCustomFieldRepository.findByInstituteIdAndTypeAndTypeIdAndStatusIn(
                instituteId, type, typeId, List.of(StatusEnum.ACTIVE.name(), StatusEnum.DELETED.name()));
    }

    /**
     * Update status of multiple custom fields
     */
    @Transactional
    public void updateCustomFieldStatus(List<InstituteCustomField> fields) {
        if (!CollectionUtils.isEmpty(fields)) {
            instituteCustomFieldRepository.saveAll(fields);
        }
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
