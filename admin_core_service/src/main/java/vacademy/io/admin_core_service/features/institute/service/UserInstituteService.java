package vacademy.io.admin_core_service.features.institute.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.institute.constants.ConstantsSubModuleList;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.institute.repository.InstituteSubModuleRepository;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.dto.InstituteIdAndNameDTO;
import vacademy.io.common.institute.dto.InstituteInfoDTO;
import vacademy.io.common.institute.entity.Institute;
import vacademy.io.common.institute.entity.module.InstituteSubModule;
import vacademy.io.common.institute.entity.module.Submodule;
import vacademy.io.common.institute.repository.SubModuleRepository;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;


@Service
public class UserInstituteService {

    @Autowired
    private InstituteRepository instituteRepository;

    @Autowired
    InstituteSubModuleRepository instituteSubModuleRepository;

    @Autowired
    SubModuleRepository subModuleRepository;

    public static InstituteInfoDTO getInstituteDetails(Institute institute) {
        InstituteInfoDTO instituteInfoDTO = new InstituteInfoDTO();
        instituteInfoDTO.setId(institute.getId());
        instituteInfoDTO.setInstituteName(institute.getInstituteName());
        instituteInfoDTO.setCountry(institute.getCountry());
        instituteInfoDTO.setState(institute.getState());
        instituteInfoDTO.setCity(institute.getCity());
        instituteInfoDTO.setAddress(institute.getAddress());
        instituteInfoDTO.setPinCode(institute.getPinCode());
        instituteInfoDTO.setEmail(institute.getEmail());
        instituteInfoDTO.setPhone(institute.getMobileNumber());
        instituteInfoDTO.setWebsiteUrl(institute.getWebsiteUrl());
        return instituteInfoDTO;
    }

    @Transactional
    public InstituteIdAndNameDTO saveInstitute(InstituteInfoDTO instituteDto) {
        try{
            List<Submodule> allSubModules = new ArrayList<>();

            if(!Objects.isNull(instituteDto.getModuleRequestIds())){

                instituteDto.getModuleRequestIds().forEach(id->{
                    List<String> subModuleId = ConstantsSubModuleList.getSubModulesForModule(id);
                    allSubModules.addAll(subModuleRepository.findAllById(subModuleId));
                });
            }

            Institute institute = getInstitute(instituteDto);

            if (institute.getInstituteName() != null) {
                Institute savedInstitute = instituteRepository.save(institute);

                createInstituteSubModulesMapping(allSubModules, savedInstitute);

                return new InstituteIdAndNameDTO(savedInstitute.getId(), savedInstitute.getInstituteName());
            }

            return null;
        }
        catch (Exception e){
            throw new VacademyException("Failed to add: " + e.getMessage());
        }
    }

    private void createInstituteSubModulesMapping(List<Submodule> allSubModules, Institute institute) {
        List<InstituteSubModule> allInstituteMapping = new ArrayList<>();
        allSubModules.forEach(submodule -> {
            allInstituteMapping.add(InstituteSubModule.builder()
                    .instituteId(institute.getId())
                    .submodule(submodule).build());
        });

        instituteSubModuleRepository.saveAll(allInstituteMapping);
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


}
