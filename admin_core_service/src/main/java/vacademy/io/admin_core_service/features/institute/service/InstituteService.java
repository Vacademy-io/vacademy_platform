package vacademy.io.admin_core_service.features.institute.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.institute.dto.InstituteDTO;
import vacademy.io.admin_core_service.features.institute.dto.InstituteSearchProjection;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.Institute;

import java.util.List;

@Service
public class InstituteService {
    @Autowired
    private InstituteRepository instituteRepository;

    public Institute findById(String instituteId) {
        return instituteRepository.findById(instituteId).orElseThrow(()-> new VacademyException("Institute not found"));
    }
    public InstituteDTO getInstituteById(String instituteId) {
        Institute institute= instituteRepository.findById(instituteId).orElseThrow(()-> new VacademyException("Institute not found"));
        return InstituteDTO.builder()
                .id(institute.getId())
                .instituteName(institute.getInstituteName())
                .setting(institute.getSetting())
                .instituteThemeCode(institute.getInstituteThemeCode())
                .address(institute.getAddress())
                .websiteUrl(institute.getWebsiteUrl())
                .build();
    }

    public List<InstituteSearchProjection>searchInstitute(String searchName){
        return instituteRepository.searchByQuery(searchName);
    }
}
