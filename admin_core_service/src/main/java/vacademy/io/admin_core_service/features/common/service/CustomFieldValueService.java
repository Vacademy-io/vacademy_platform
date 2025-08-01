package vacademy.io.admin_core_service.features.common.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.common.common.dto.CustomFieldValueDTO;
import vacademy.io.admin_core_service.features.common.entity.CustomFieldValues;
import vacademy.io.admin_core_service.features.common.repository.CustomFieldValuesRepository;

import java.util.ArrayList;
import java.util.List;

@Service
public class CustomFieldValueService {

    @Autowired
    private CustomFieldValuesRepository customFieldValuesRepository;

    public void addCustomFieldValue(List<CustomFieldValueDTO> customFieldValueDTOS,String sourceType,String sourceId) {
        if (customFieldValueDTOS == null || customFieldValueDTOS.isEmpty()) {
            return; // Or throw an exception depending on use case
        }

        List<CustomFieldValues> customFieldValues = new ArrayList<>();

        for (CustomFieldValueDTO customFieldValueDTO : customFieldValueDTOS) {
            if (customFieldValueDTO == null) {
                continue; // Skip null DTO entries
            }
            customFieldValueDTO.setSourceType(sourceType);
            customFieldValueDTO.setSourceId(sourceId);
            // Optionally validate fields of customFieldValueDTO here
            customFieldValues.add(new CustomFieldValues(customFieldValueDTO));
        }

        if (!customFieldValues.isEmpty()) {
            customFieldValuesRepository.saveAll(customFieldValues);
        }
    }

    public void shiftCustomField(String source,String previousSourceId,String newSourceId,String type,String typeId){
        List<CustomFieldValues>customFieldValues = customFieldValuesRepository.findBySourceTypeAndSourceIdAndTypeAndTypeId(source,
                previousSourceId,
                type,typeId);
        List<CustomFieldValues>shiftedCustomFiledValues = new ArrayList<>();
        for(CustomFieldValues customFieldValue:customFieldValues){
            CustomFieldValues newCustomFiledValue = new CustomFieldValues();
            newCustomFiledValue.setCustomFieldId(customFieldValue.getCustomFieldId());
            newCustomFiledValue.setSourceType(source);
            newCustomFiledValue.setSourceId(newSourceId);
            newCustomFiledValue.setType(type);
            newCustomFiledValue.setTypeId(typeId);
            newCustomFiledValue.setValue(customFieldValue.getValue());
            shiftedCustomFiledValues.add(newCustomFiledValue);
        }
        customFieldValuesRepository.saveAll(shiftedCustomFiledValues);
    }
}
