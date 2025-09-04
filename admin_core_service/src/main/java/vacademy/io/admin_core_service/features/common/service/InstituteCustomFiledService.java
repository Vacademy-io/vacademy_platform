package vacademy.io.admin_core_service.features.common.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.common.dto.CustomFieldDTO;
import vacademy.io.admin_core_service.features.common.dto.InstituteCustomFieldDTO;
import vacademy.io.admin_core_service.features.common.dto.InstituteCustomFieldDeleteRequestDTO;
import vacademy.io.admin_core_service.features.common.enums.CustomFieldTypeEnum;
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

    public void addOrUpdateCustomField(List<InstituteCustomFieldDTO> customFieldDTOs) {
        List<InstituteCustomField> instituteCustomFields = new ArrayList<>();
        List<CustomFields> customFields = new ArrayList<>();
        for (InstituteCustomFieldDTO customFieldDTO : customFieldDTOs) {
            CustomFields customField = new CustomFields(customFieldDTO.getCustomField());
            customFields.add(customField);
            InstituteCustomField instituteCustomField = new InstituteCustomField(customFieldDTO);
            instituteCustomFields.add(instituteCustomField);
        }
        customFieldRepository.saveAll(customFields);
        instituteCustomFieldRepository.saveAll(instituteCustomFields);
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
        setupDTO.setGroupName(icf.getGroupName());
        setupDTO.setType(icf.getType());
        setupDTO.setTypeId(icf.getTypeId());
        setupDTO.setStatus(icf.getStatus());

        return setupDTO;
    }

    public List<InstituteCustomField> createDefaultCustomFieldsForInstitute(Institute institute){
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

        List<CustomFields> allDefaultCustomFields = List.of(nameCustomFields,emailCustomFields,usernameCustomFields,passwordCustomFields,batchCustomFields,phoneCustomFields);
        List<CustomFields> allSavedCustomFields = customFieldRepository.saveAll(allDefaultCustomFields);
        List<InstituteCustomField> defaultInstituteCustomFields = new ArrayList<>();

        allSavedCustomFields.forEach(customField->{
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

    public CustomFields createCustomFieldFromRequest(CustomFieldDTO request) {
        if(Objects.isNull(request)) throw new VacademyException("Invalid Request");

        return customFieldRepository.save(CustomFields.builder()
                .fieldName(request.getFieldName())
                .fieldKey(request.getFieldKey())
                .fieldType(request.getFieldType())
                .defaultValue(request.getDefaultValue())
                .config(request.getConfig())
                .isSortable(request.getIsSortable())
                .isMandatory(request.getIsMandatory()).build());
    }

    public InstituteCustomField createInstituteMappingFromCustomField(CustomFields savedCustomField, Institute institute, CustomFieldDTO request) {
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
        if (request.getFieldKey() != null) customField.setFieldKey(request.getFieldKey());
        if (request.getFieldName() != null) customField.setFieldName(request.getFieldName());
        if (request.getFieldType() != null) customField.setFieldType(request.getFieldType());
        if (request.getDefaultValue() != null) customField.setDefaultValue(request.getDefaultValue());
        if (request.getConfig() != null) customField.setConfig(request.getConfig());

        if (request.getFormOrder() != null) customField.setFormOrder(request.getFormOrder());
        if (request.getIsMandatory() != null) customField.setIsMandatory(request.getIsMandatory());
        if (request.getIsFilter() != null) customField.setIsFilter(request.getIsFilter());
        if (request.getIsSortable() != null) customField.setIsSortable(request.getIsSortable());

        // Save updated field
        customFieldRepository.save(customField);

        return "Custom Field with id " + fieldId + " updated successfully.";
    }

}
