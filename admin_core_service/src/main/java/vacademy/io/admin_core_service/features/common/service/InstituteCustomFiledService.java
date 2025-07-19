package vacademy.io.admin_core_service.features.common.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.common.dto.InstituteCustomFieldDTO;
import vacademy.io.admin_core_service.features.common.entity.CustomFields;
import vacademy.io.admin_core_service.features.common.entity.InstituteCustomField;
import vacademy.io.admin_core_service.features.common.repository.CustomFieldRepository;
import vacademy.io.admin_core_service.features.common.repository.InstituteCustomFieldRepository;

import java.util.ArrayList;
import java.util.List;

@Service
public class InstituteCustomFiledService {
    @Autowired
    private InstituteCustomFieldRepository instituteCustomFieldRepository;

    @Autowired
    private CustomFieldRepository customFieldRepository;

    public void addCustomFields(List<InstituteCustomFieldDTO>customFieldDTOs){
        List<InstituteCustomField>instituteCustomFields = new ArrayList<>();
        List<CustomFields>customFields = new ArrayList<>();
        for (InstituteCustomFieldDTO customFieldDTO : customFieldDTOs) {
            CustomFields customField = new CustomFields(customFieldDTO.getCustomField());
            customFields.add(customField);
            InstituteCustomField instituteCustomField = new InstituteCustomField(customFieldDTO);
            instituteCustomFields.add(instituteCustomField);
        }
        customFieldRepository.saveAll(customFields);
        instituteCustomFieldRepository.saveAll(instituteCustomFields);
    }
}
