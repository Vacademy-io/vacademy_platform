package vacademy.io.admin_core_service.features.institute_learner.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.institute_learner.dto.StudentDTO;
import vacademy.io.admin_core_service.features.institute_learner.repository.InstituteStudentRepository;

import java.util.*;

@Service
public class StudentFilterService {

    @Autowired
    InstituteStudentRepository instituteStudentRepository;

    public Page<StudentDTO> getAllStudentWithSearch(String name,
                                                    List<String> statuses,
                                                    List<String> gender,
                                                    List<String> instituteIds,
                                                    List<String> groupIds,
                                                    List<String> packageSessionIds,
                                                    List<String> customFieldIds,
                                                    Pageable pageable) {

        // safe lists (null = ignore filter)
        List<String> safeStatuses = (statuses == null || statuses.isEmpty()) ? new ArrayList<>() : statuses;
        List<String> safeGender = (gender == null || gender.isEmpty()) ? new ArrayList<>() : gender;
        List<String> safeInstituteIds = (instituteIds == null || instituteIds.isEmpty()) ? new ArrayList<>() : instituteIds;
        List<String> safeGroupIds = (groupIds == null || groupIds.isEmpty()) ? new ArrayList<>() : groupIds;
        List<String> safePackageSessionIds = (packageSessionIds == null || packageSessionIds.isEmpty()) ? new ArrayList<>() : packageSessionIds;
        List<String> safeCustomFieldIds = (customFieldIds == null || customFieldIds.isEmpty()) ? new ArrayList<>() : customFieldIds;

        Page<Object[]> result = instituteStudentRepository.findAllStudentsWithFilterAndSearchAndCustomFields(name,
                safeStatuses, safeGender, safeInstituteIds,
                safeGroupIds, safePackageSessionIds, safeCustomFieldIds,
                pageable
        );

        // map to DTOs
        List<StudentDTO> dtos = new ArrayList<>();
        for (Object[] row : result.getContent()) {
            StudentDTO dto = new StudentDTO();
            int idx = 0;
            dto.setId((String) row[idx++]);
            dto.setUsername((String) row[idx++]);
            dto.setUserId((String) row[idx++]);
            dto.setEmail((String) row[idx++]);
            dto.setFullName((String) row[idx++]);
            dto.setAddressLine((String) row[idx++]);
            dto.setRegion((String) row[idx++]);
            dto.setCity((String) row[idx++]);
            dto.setPinCode((String) row[idx++]);
            dto.setMobileNumber((String) row[idx++]);
            dto.setDateOfBirth((Date) row[idx++]);
            dto.setGender((String) row[idx++]);
            dto.setFatherName((String) row[idx++]);
            dto.setMotherName((String) row[idx++]);
            dto.setParentsMobileNumber((String) row[idx++]);
            dto.setParentsEmail((String) row[idx++]);
            dto.setLinkedInstituteName((String) row[idx++]);
            dto.setCreatedAt((Date) row[idx++]);
            dto.setUpdatedAt((Date) row[idx++]);
            dto.setPackageSessionId((String) row[idx++]);
            dto.setInstituteEnrollmentId((String) row[idx++]);
            dto.setStatus((String) row[idx++]);
            dto.setInstituteId((String) row[idx++]);
            dto.setExpiryDate((Date) row[idx++]);
            dto.setFaceFileId((String) row[idx++]);
            dto.setParentsToMotherMobileNumber((String) row[idx++]);
            dto.setParentsToMotherEmail((String) row[idx++]);
            if (row[idx] != null){
                dto.setReferralCount(((Number) row[idx++]).longValue());
            }
            // custom fields
            Map<String, String> customMap = new HashMap<>();
            if (safeCustomFieldIds != null) {
                for (String fieldId : safeCustomFieldIds) {
                    customMap.put(fieldId, (String) row[idx++]);
                }
            }
            dto.setCustomFields(customMap);

            dtos.add(dto);
        }

        return new PageImpl<>(dtos, pageable, result.getTotalElements());
    }

    public Page<StudentDTO> getAllStudentWithFilter(List<String> statuses, List<String> gender, List<String> instituteIds, List<String> groupIds, List<String> packageSessionIds, Pageable pageable) {

        // Ensure all lists are not null
        List<String> safeStatuses = (statuses != null) ? statuses : new ArrayList<>();
        List<String> safeGender = (gender != null) ? gender : new ArrayList<>();
        List<String> safeInstituteIds = (instituteIds != null) ? instituteIds : new ArrayList<>();
        List<String> safeGroupIds = (groupIds != null) ? groupIds : new ArrayList<>();
        List<String> safePackageSessionIds = (packageSessionIds != null) ? packageSessionIds : new ArrayList<>();
        return instituteStudentRepository.getAllStudentWithFilterRaw(safeStatuses, safeGender, safeInstituteIds, safeGroupIds, safePackageSessionIds, pageable).map(StudentDTO::new);
    }


    public Page<StudentDTO> getAllStudentWithFilterAndCustomFields(
            List<String> statuses,
            List<String> gender,
            List<String> instituteIds,
            List<String> groupIds,
            List<String> packageSessionIds,
            List<String> customFieldIds,
            Pageable pageable) {

        // safe lists (null = ignore filter)
        List<String> safeStatuses = (statuses == null || statuses.isEmpty()) ? new ArrayList<>() : statuses;
        List<String> safeGender = (gender == null || gender.isEmpty()) ? new ArrayList<>() : gender;
        List<String> safeInstituteIds = (instituteIds == null || instituteIds.isEmpty()) ? new ArrayList<>() : instituteIds;
        List<String> safeGroupIds = (groupIds == null || groupIds.isEmpty()) ? new ArrayList<>() : groupIds;
        List<String> safePackageSessionIds = (packageSessionIds == null || packageSessionIds.isEmpty()) ? new ArrayList<>() : packageSessionIds;
        List<String> safeCustomFieldIds = (customFieldIds == null || customFieldIds.isEmpty()) ? new ArrayList<>() : customFieldIds;

        Page<Object[]> result = instituteStudentRepository.findAllStudentsWithFiltersAndCustomFields(
                safeStatuses, safeGender, safeInstituteIds,
                safeGroupIds, safePackageSessionIds, safeCustomFieldIds,
                pageable
        );

        // map to DTOs
        List<StudentDTO> dtos = new ArrayList<>();
        for (Object[] row : result.getContent()) {
            StudentDTO dto = new StudentDTO();
            int idx = 0;
            dto.setId((String) row[idx++]);
            dto.setUsername((String) row[idx++]);
            dto.setUserId((String) row[idx++]);
            dto.setEmail((String) row[idx++]);
            dto.setFullName((String) row[idx++]);
            dto.setAddressLine((String) row[idx++]);
            dto.setRegion((String) row[idx++]);
            dto.setCity((String) row[idx++]);
            dto.setPinCode((String) row[idx++]);
            dto.setMobileNumber((String) row[idx++]);
            dto.setDateOfBirth((Date) row[idx++]);
            dto.setGender((String) row[idx++]);
            dto.setFatherName((String) row[idx++]);
            dto.setMotherName((String) row[idx++]);
            dto.setParentsMobileNumber((String) row[idx++]);
            dto.setParentsEmail((String) row[idx++]);
            dto.setLinkedInstituteName((String) row[idx++]);
            dto.setCreatedAt((Date) row[idx++]);
            dto.setUpdatedAt((Date) row[idx++]);
            dto.setPackageSessionId((String) row[idx++]);
            dto.setInstituteEnrollmentId((String) row[idx++]);
            dto.setStatus((String) row[idx++]);
            dto.setInstituteId((String) row[idx++]);
            dto.setExpiryDate((Date) row[idx++]);
            dto.setFaceFileId((String) row[idx++]);
            dto.setParentsToMotherMobileNumber((String) row[idx++]);
            dto.setParentsToMotherEmail((String) row[idx++]);
            if (row[idx] != null){
                dto.setReferralCount(((Number) row[idx++]).longValue());
            }
            // custom fields
            Map<String, String> customMap = new HashMap<>();
            if (safeCustomFieldIds != null) {
                for (String fieldId : safeCustomFieldIds) {
                    customMap.put(fieldId, (String) row[idx++]);
                }
            }
            dto.setCustomFields(customMap);

            dtos.add(dto);
        }

        return new PageImpl<>(dtos, pageable, result.getTotalElements());
    }
}
