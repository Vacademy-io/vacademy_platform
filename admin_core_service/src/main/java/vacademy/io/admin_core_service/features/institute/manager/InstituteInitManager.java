package vacademy.io.admin_core_service.features.institute.manager;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.institute.entity.Institute;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.institute.service.InstituteModuleService;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.dto.InstituteInfoDTO;

import java.util.Optional;

@Component
public class InstituteInitManager {

    @Autowired
    InstituteModuleService instituteModuleService;
    @Autowired
    InstituteRepository instituteRepository;

    public InstituteInfoDTO getInstituteDetails(String instituteId) {

        Optional<Institute> institute = instituteRepository.findById(instituteId);

        if(institute.isEmpty()) {
            throw new VacademyException("Invalid Institute Id");
        }

        InstituteInfoDTO instituteInfoDTO = new InstituteInfoDTO();
        instituteInfoDTO.setInstituteName(institute.get().getInstituteName());
        instituteInfoDTO.setId(institute.get().getId());
        instituteInfoDTO.setCity(institute.get().getCity());
        instituteInfoDTO.setCountry(institute.get().getCountry());
        instituteInfoDTO.setWebsiteUrl(institute.get().getWebsiteUrl());
        instituteInfoDTO.setEmail(institute.get().getEmail());
        instituteInfoDTO.setPinCode(institute.get().getPinCode());
        instituteInfoDTO.setInstituteLogoFileId(institute.get().getLogoFileId());
        instituteInfoDTO.setDescription(institute.get().getDescription());
        instituteInfoDTO.setHeldBy(institute.get().getHeldBy());
        instituteInfoDTO.setFoundedDate(institute.get().getFoundedData());
        instituteInfoDTO.setPhone(institute.get().getMobileNumber());
        instituteInfoDTO.setAddress(institute.get().getAddress());
        instituteInfoDTO.setType(institute.get().getInstituteType());
        instituteInfoDTO.setState(institute.get().getState());
        instituteInfoDTO.setLanguage(institute.get().getLanguage());
        instituteInfoDTO.setInstituteThemeCode(institute.get().getInstituteThemeCode());
        instituteInfoDTO.setSubModules(instituteModuleService.getSubmoduleIdsForInstitute(institute.get().getId()));
        return instituteInfoDTO;
    }
}
