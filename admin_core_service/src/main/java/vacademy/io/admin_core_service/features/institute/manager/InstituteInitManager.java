package vacademy.io.admin_core_service.features.institute.manager;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.institute.service.InstituteModuleService;
import vacademy.io.common.institute.dto.InstituteInfoDTO;

@Component
public class InstituteInitManager {

    @Autowired
    InstituteModuleService instituteModuleService;
    @Autowired
    InstituteRepository instituteRepository;

    public InstituteInfoDTO getInstituteDetails(String instituteId) {

        InstituteInfoDTO instituteInfoDTO = new InstituteInfoDTO();
        instituteInfoDTO.setInstituteName(instituteId);
        return instituteInfoDTO;
    }
}
