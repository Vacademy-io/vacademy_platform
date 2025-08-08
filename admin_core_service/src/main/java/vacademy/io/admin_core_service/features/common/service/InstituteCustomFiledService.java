package vacademy.io.admin_core_service.features.common.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.common.dto.CustomFieldDTO;
import vacademy.io.admin_core_service.features.common.dto.InstituteCustomFieldDTO;
import vacademy.io.admin_core_service.features.common.dto.InstituteCustomFieldDeleteRequestDTO;
import vacademy.io.admin_core_service.features.common.entity.CustomFields;
import vacademy.io.admin_core_service.features.common.entity.InstituteCustomField;
import vacademy.io.admin_core_service.features.common.enums.StatusEnum;
import vacademy.io.admin_core_service.features.common.repository.CustomFieldRepository;
import vacademy.io.admin_core_service.features.common.repository.InstituteCustomFieldRepository;

import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
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

    public int softDeleteInstituteCustomFieldsBulk(List<InstituteCustomFieldDeleteRequestDTO>requestDTOS,String instituteId) {
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
}
