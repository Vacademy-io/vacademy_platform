package vacademy.io.admin_core_service.features.institute.service;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.institute.repository.InstituteSubModuleRepository;
import vacademy.io.common.institute.dto.InstituteSubModuleDTO;
import vacademy.io.common.institute.entity.module.InstituteSubModule;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class InstituteModuleService {

    @Autowired
    private InstituteSubModuleRepository instituteSubModuleRepository;

    public List<InstituteSubModuleDTO> getSubmoduleIdsForInstitute(String instituteId) {

        List<InstituteSubModule> instituteSubModules = instituteSubModuleRepository.findSubModulesByInstituteId(instituteId);
        return instituteSubModules.stream()
                .map((instituteSubModule) -> new InstituteSubModuleDTO(instituteSubModule.getSubmodule().getModule().getModuleName(), instituteSubModule.getSubmodule().getSubmoduleName(), ""))
                .collect(Collectors.toList());

    }
}
