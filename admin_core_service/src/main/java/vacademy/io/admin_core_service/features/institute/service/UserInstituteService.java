package vacademy.io.admin_core_service.features.institute.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.institute.dto.InstituteIdAndNameDTO;
import vacademy.io.admin_core_service.features.institute.dto.InstituteInfoDTO;
import vacademy.io.admin_core_service.features.institute.entity.Institute;
import vacademy.io.admin_core_service.features.institute.entity.InstituteSubModule;
import vacademy.io.admin_core_service.features.institute.entity.Staff;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.institute.repository.InstituteSubModuleRepository;
import vacademy.io.admin_core_service.features.institute.repository.StaffRepository;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class UserInstituteService {

    @Autowired
    private InstituteRepository instituteRepository;

    @Autowired
    private StaffRepository staffRepository;

    @Autowired
    private InstituteSubModuleRepository instituteSubModuleRepository;

    @Transactional
    public List<InstituteIdAndNameDTO> saveInstitutesAndCreateStaff(String userId, List<InstituteInfoDTO> institutes) {

        for (InstituteInfoDTO instituteInfo : institutes) {
            Institute institute = getInstitute(instituteInfo);
            if(institute.getInstituteName()!=null) {
                String newId = UUID.randomUUID().toString();
                instituteRepository.insertInstitute(newId, institute);
                Staff staff = new Staff();
                staff.setUserId(userId);
                staff.setInstituteId(newId);
                staffRepository.save(staff);
            }
        }
        List<Institute> instituteList = instituteRepository.findInstitutesByUserId(userId);
        return instituteList.stream()
                .map(institute -> {

                    List<String> submoduleIds = getSubmoduleIdsForInstitute(institute.getId());

                    return new InstituteIdAndNameDTO(institute.getId(), institute.getInstituteName(), submoduleIds);
                })
                .collect(Collectors.toList());
    }

    private Institute getInstitute(InstituteInfoDTO instituteInfo) {
        Institute institute = new Institute();
        institute.setInstituteName(instituteInfo.getInstituteName());
        institute.setCountry(instituteInfo.getCountry());
        institute.setState(instituteInfo.getState());
        institute.setCity(instituteInfo.getCity());
        institute.setAddress(instituteInfo.getAddress());
        institute.setPinCode(instituteInfo.getPinCode());
        institute.setEmail(instituteInfo.getEmail());
        institute.setMobileNumber(instituteInfo.getPhone());
        institute.setWebsiteUrl(instituteInfo.getWebsiteUrl());
        return institute;
    }

    private List<String> getSubmoduleIdsForInstitute(String instituteId) {

        List<InstituteSubModule> instituteSubModules = instituteSubModuleRepository.findSubModulesByInstituteId(instituteId);
        return instituteSubModules.stream()
                .map(InstituteSubModule::getSubModuleId)
                .collect(Collectors.toList());

    }
}
