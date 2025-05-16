package vacademy.io.admin_core_service.features.faculty.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.faculty.dto.AddFacultyToSubjectAndBatchDTO;
import vacademy.io.admin_core_service.features.faculty.entity.FacultySubjectPackageSessionMapping;
import vacademy.io.admin_core_service.features.faculty.repository.FacultySubjectPackageSessionMappingRepository;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class FacultyService {
    private final FacultySubjectPackageSessionMappingRepository facultyRepository;
    private final AuthService authService;

    public String addFacultyToSubjectsAndBatches(AddFacultyToSubjectAndBatchDTO addFacultyToSubjectAndBatch, String instituteId, CustomUserDetails userDetails){
        UserDTO userDTO = addFacultyToSubjectAndBatch.getUser();
        if (addFacultyToSubjectAndBatch.isNewUser()){
            userDTO = inviteUser(userDTO, instituteId);
        }
        List<FacultySubjectPackageSessionMapping> mappings = new ArrayList<>();
        for (AddFacultyToSubjectAndBatchDTO.BatchSubjectMapping batchSubjectMapping : addFacultyToSubjectAndBatch.getBatchSubjectMappings()) {
            for (String subjectId : batchSubjectMapping.getSubjectIds()) {
                FacultySubjectPackageSessionMapping mapping = new FacultySubjectPackageSessionMapping(userDTO.getId(), batchSubjectMapping.getBatchId(), subjectId);
                mappings.add(mapping);
            }
        }
        facultyRepository.saveAll(mappings);
        return "success";
    }

    public UserDTO inviteUser(UserDTO userDTO,String instituteId) {
        return authService.inviteUser(userDTO, instituteId);
    }
}
