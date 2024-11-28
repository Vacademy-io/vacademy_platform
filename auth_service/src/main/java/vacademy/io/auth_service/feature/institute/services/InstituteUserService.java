package vacademy.io.auth_service.feature.institute.services;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.auth_service.feature.institute.entity.InstituteSubModule;
import vacademy.io.auth_service.feature.institute.repository.InstituteSubModuleRepository;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class InstituteUserService {

    @Autowired
    private InstituteSubModuleRepository instituteSubModuleRepository;

    private List<String> getSubmoduleIdsForInstitute(String instituteId) {

        List<InstituteSubModule> instituteSubModules = instituteSubModuleRepository.findSubModulesByInstituteId(instituteId);
        return instituteSubModules.stream()
                .map(InstituteSubModule::getSubModuleId)
                .collect(Collectors.toList());

    }
}
