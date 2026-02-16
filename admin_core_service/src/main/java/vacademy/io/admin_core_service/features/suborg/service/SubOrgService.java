package vacademy.io.admin_core_service.features.suborg.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.institute.entity.InstituteSubOrg;
import vacademy.io.admin_core_service.features.institute.repository.InstituteSubOrgRepository;
import vacademy.io.admin_core_service.features.institute.service.UserInstituteService;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.dto.InstituteIdAndNameDTO;
import vacademy.io.common.institute.dto.InstituteInfoDTO;

import java.util.List;

@Service
@RequiredArgsConstructor
public class SubOrgService {

    private final UserInstituteService userInstituteService;
    private final InstituteSubOrgRepository instituteSubOrgRepository;

    @Transactional
    public String createSubOrg(InstituteInfoDTO instituteInfoDTO, String parentInstituteId) {
        // 1. Create the child institute using existing logic in UserInstituteService
        InstituteIdAndNameDTO createdInstitute = userInstituteService.saveInstitute(instituteInfoDTO);

        if (createdInstitute == null) {
            throw new VacademyException("Failed to create sub-organization institute");
        }

        // 2. Link parent and child in InstituteSubOrg table
        InstituteSubOrg mapping = new InstituteSubOrg();
        mapping.setInstituteId(parentInstituteId);
        mapping.setSuborgId(createdInstitute.getInstituteId());
        mapping.setStatus("ACTIVE");
        mapping.setName(instituteInfoDTO.getInstituteName());
        mapping.setDescription(instituteInfoDTO.getDescription());

        instituteSubOrgRepository.save(mapping);

        return createdInstitute.getInstituteId();
    }

    public List<InstituteSubOrg> getSubOrgs(String parentInstituteId) {
        return instituteSubOrgRepository.findByInstituteId(parentInstituteId);
    }
}
