package vacademy.io.admin_core_service.features.common.manager;

import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.common.dto.CustomFieldDTO;
import vacademy.io.admin_core_service.features.common.entity.CustomFields;
import vacademy.io.admin_core_service.features.common.entity.InstituteCustomField;
import vacademy.io.admin_core_service.features.common.service.InstituteCustomFiledService;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.institute_learner.dto.InstituteCustomFieldSetupDTO;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.Institute;

import java.util.Optional;

@Component
public class InstituteCustomFieldManager {

    private final InstituteRepository instituteRepository;
    private final InstituteCustomFiledService instituteCustomFiledService;

    public InstituteCustomFieldManager(InstituteRepository instituteRepository, InstituteCustomFiledService instituteCustomFiledService) {
        this.instituteRepository = instituteRepository;
        this.instituteCustomFiledService = instituteCustomFiledService;
    }


    public ResponseEntity<String> createGroupOfCustomField(CustomUserDetails userDetails, String instituteId) {
        return ResponseEntity.ok("Done");
    }

    public ResponseEntity<String> createCustomFieldForInstitute(CustomUserDetails userDetails, CustomFieldDTO request, String instituteId, String fieldId) {
        Optional<Institute> institute = instituteRepository.findById(instituteId);
        if(institute.isEmpty()) throw new VacademyException("Institute Not Found");
        if(StringUtils.hasText(fieldId)){
            return ResponseEntity.ok(instituteCustomFiledService.updateCustomField(institute.get(),request, fieldId));
        }
        CustomFields savedCustomField = instituteCustomFiledService.createCustomFieldFromRequest(request);
        InstituteCustomField savedMapping = instituteCustomFiledService.createInstituteMappingFromCustomField(savedCustomField, institute.get(),request);
        return ResponseEntity.ok(savedMapping.getCustomFieldId());
    }


}
