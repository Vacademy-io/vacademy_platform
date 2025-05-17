package vacademy.io.admin_core_service.features.faculty.service;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.faculty.dto.AddFacultyToSubjectAndBatchDTO;
import vacademy.io.admin_core_service.features.faculty.dto.FacultyAllResponse;
import vacademy.io.admin_core_service.features.faculty.dto.FacultyTopLevelResponse;
import vacademy.io.admin_core_service.features.faculty.dto.FacultyRequestFilter;
import vacademy.io.admin_core_service.features.faculty.entity.FacultySubjectPackageSessionMapping;
import vacademy.io.admin_core_service.features.faculty.enums.FacultyStatusEnum;
import vacademy.io.admin_core_service.features.faculty.repository.FacultySubjectPackageSessionMappingRepository;
import vacademy.io.admin_core_service.features.subject.service.SubjectService;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.core.standard_classes.ListService;
import vacademy.io.common.institute.dto.SubjectTopLevelDto;
import vacademy.io.common.institute.entity.student.Subject;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class FacultyService {
    private final FacultySubjectPackageSessionMappingRepository facultyRepository;
    private final AuthService authService;
    private final SubjectService subjectService;

    public String addFacultyToSubjectsAndBatches(AddFacultyToSubjectAndBatchDTO addFacultyToSubjectAndBatch, String instituteId, CustomUserDetails userDetails){
        UserDTO userDTO = addFacultyToSubjectAndBatch.getUser();
        if (addFacultyToSubjectAndBatch.isNewUser()){
            userDTO = inviteUser(userDTO, instituteId);
        }
        List<FacultySubjectPackageSessionMapping> mappings = new ArrayList<>();
        for (AddFacultyToSubjectAndBatchDTO.BatchSubjectMapping batchSubjectMapping : addFacultyToSubjectAndBatch.getBatchSubjectMappings()) {
            for (String subjectId : batchSubjectMapping.getSubjectIds()) {
                FacultySubjectPackageSessionMapping mapping = new FacultySubjectPackageSessionMapping(userDTO.getId(), batchSubjectMapping.getBatchId(), subjectId, addFacultyToSubjectAndBatch.getUser().getFullName(), FacultyStatusEnum.ACTIVE.name());
                mappings.add(mapping);
            }
        }
        facultyRepository.saveAll(mappings);
        return "success";
    }

    public UserDTO inviteUser(UserDTO userDTO,String instituteId) {
        return authService.inviteUser(userDTO, instituteId);
    }

    public ResponseEntity<FacultyAllResponse> getAllFaculty(CustomUserDetails userDetails, String instituteId, FacultyRequestFilter filter, int pageNo, int pageSize) {
        Sort sortColumns = ListService.createSortObject(filter.getSortColumns());
        Pageable pageable = PageRequest.of(pageNo,pageSize,sortColumns);

        Page<FacultySubjectPackageSessionMapping> paginatedResponse = facultyRepository.findByFilters(filter.getName(),filter.getSubjects(),filter.getBatches(),filter.getStatus(),pageable);

        return ResponseEntity.ok(createAllFacultyResponse(paginatedResponse));
    }

    private FacultyAllResponse createAllFacultyResponse(Page<FacultySubjectPackageSessionMapping> paginatedData) {
        if(Objects.isNull(paginatedData)){
            return FacultyAllResponse.builder()
                    .content(new ArrayList<>())
                    .totalPages(0)
                    .last(true)
                    .pageSize(0)
                    .pageNo(0)
                    .totalElements(0)
                    .build();
        }

        List<FacultySubjectPackageSessionMapping> facultyList = paginatedData.getContent();
        return FacultyAllResponse.builder()
                .content(createFacultyTopLevelResponseFromList(facultyList))
                .pageNo(paginatedData.getNumber())
                .pageSize(paginatedData.getSize())
                .last(paginatedData.isLast())
                .totalPages(paginatedData.getTotalPages())
                .totalElements(paginatedData.getTotalElements()).build();
    }

    private List<FacultyTopLevelResponse> createFacultyTopLevelResponseFromList(List<FacultySubjectPackageSessionMapping> facultyList) {
        List<FacultyTopLevelResponse> response = new ArrayList<>();
        facultyList.forEach(faculty->{
            response.add(FacultyTopLevelResponse.builder()
                    .id(faculty.getId())
                    .userId(faculty.getUserId())
                    .subjects(createSubjectTopLevelFromSubjects(subjectService.getAllSubjectsForFaculty(faculty.getUserId(), faculty.getPackageSessionId())))
                    .name(faculty.getName()).build());
        });
        return response;
    }

    private List<SubjectTopLevelDto> createSubjectTopLevelFromSubjects(List<Subject> allSubjectsForFaculty) {
        List<SubjectTopLevelDto> dtos = new ArrayList<>();
        allSubjectsForFaculty.forEach(subject -> {
            dtos.add(subject.getSubjectTopLevelDto());
        });

        return dtos;
    }
}
