package vacademy.io.admin_core_service.features.institute.service;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.institute.entity.InstituteSubModule;
import vacademy.io.admin_core_service.features.institute.repository.InstituteSubModuleRepository;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class InstituteModuleService {

    @Autowired
    private InstituteSubModuleRepository instituteSubModuleRepository;

    private List<String> getSubmoduleIdsForInstitute(String instituteId) {

        List<InstituteSubModule> instituteSubModules = instituteSubModuleRepository.findSubModulesByInstituteId(instituteId);
        return instituteSubModules.stream()
                .map(InstituteSubModule::getSubModuleId)
                .collect(Collectors.toList());

    }
}
