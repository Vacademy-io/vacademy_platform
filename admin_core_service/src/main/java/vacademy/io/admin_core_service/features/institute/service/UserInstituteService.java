package vacademy.io.admin_core_service.features.institute.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.common.institute.dto.InstituteIdAndNameDTO;
import vacademy.io.common.institute.dto.InstituteInfoDTO;
import vacademy.io.common.institute.entity.Institute;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;


@Service
public class UserInstituteService {

    @Autowired
    private InstituteRepository instituteRepository;

    @Transactional
    public InstituteIdAndNameDTO saveInstitute(InstituteInfoDTO instituteDto) {

        InstituteIdAndNameDTO instituteList;

        Institute institute = getInstitute(instituteDto);
        if (institute.getInstituteName() != null) {
            Institute savedInstitute = instituteRepository.save(institute);
            return new InstituteIdAndNameDTO(savedInstitute.getId(), savedInstitute.getInstituteName());
        }

        return null;
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


}
