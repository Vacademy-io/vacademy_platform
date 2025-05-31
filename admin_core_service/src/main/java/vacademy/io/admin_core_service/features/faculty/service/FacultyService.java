package vacademy.io.admin_core_service.features.faculty.service;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.faculty.dto.*;
import vacademy.io.admin_core_service.features.faculty.entity.FacultySubjectPackageSessionMapping;
import vacademy.io.admin_core_service.features.faculty.enums.FacultyStatusEnum;
import vacademy.io.admin_core_service.features.faculty.repository.FacultySubjectPackageSessionMappingRepository;
import vacademy.io.admin_core_service.features.packages.enums.PackageSessionStatusEnum;
import vacademy.io.admin_core_service.features.subject.enums.SubjectStatusEnum;
import vacademy.io.admin_core_service.features.subject.service.SubjectService;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.core.standard_classes.ListService;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.dto.SubjectTopLevelDto;
import vacademy.io.common.institute.entity.student.Subject;

import java.util.*;
import java.util.stream.Collectors;

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

    @Transactional
    public String updateFacultyAssignmentsToSubjects(
            FacultyBatchSubjectDTO updateRequest,
            CustomUserDetails userDetails
    ) {
        List<FacultySubjectPackageSessionMapping> updatedMappings = new ArrayList<>();

        for (FacultyBatchSubjectDTO.BatchSubjectAssignment batchAssignment : updateRequest.getBatchSubjectAssignments()) {
            String batchId = batchAssignment.getBatchId();

            for (FacultyBatchSubjectDTO.SubjectAssignment subjectAssignment : batchAssignment.getSubjectAssignments()) {
                String subjectId = subjectAssignment.getSubjectId();

                if (subjectAssignment.isNewAssignment()) {
                    FacultySubjectPackageSessionMapping newMapping = new FacultySubjectPackageSessionMapping(
                            userDetails.getId(),
                            batchId,
                            subjectId,
                            userDetails.getFullName(),
                            FacultyStatusEnum.ACTIVE.name()
                    );
                    updatedMappings.add(newMapping);
                } else {
                    FacultySubjectPackageSessionMapping existingMapping = facultyRepository
                            .findByUserIdAndPackageSessionIdAndSubjectIdAndStatusIn(
                                    updateRequest.getFacultyId(),
                                    batchId,
                                    subjectId,
                                    List.of(FacultyStatusEnum.ACTIVE.name())
                            ).orElseThrow(() -> new VacademyException("Faculty mapping not found"));

                    existingMapping.setStatus(FacultyStatusEnum.DELETED.name());
                    updatedMappings.add(existingMapping);
                }
            }
        }

        facultyRepository.saveAll(updatedMappings);
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

    public FacultyBatchSubjectDTO getAllFacultyBatchSubject(String userId, CustomUserDetails userDetails) {
        List<FacultyBatchSubjectFlatRow> facultyBatchSubjectFlatRows =
                facultyRepository.findFacultyBatchSubjectsFiltered(
                        userId,
                        List.of(FacultyStatusEnum.ACTIVE.name()),
                        List.of(PackageSessionStatusEnum.ACTIVE.name(), PackageSessionStatusEnum.HIDDEN.name()),
                        List.of(SubjectStatusEnum.ACTIVE.name())
                );

        return mapToNestedDTO(facultyBatchSubjectFlatRows);
    }



    private FacultyBatchSubjectDTO mapToNestedDTO(List<FacultyBatchSubjectFlatRow> rows) {
        FacultyBatchSubjectDTO dto = new FacultyBatchSubjectDTO();
        dto.setFacultyId(rows.isEmpty() ? null : rows.get(0).getFacultyId());

        Map<String, List<FacultyBatchSubjectFlatRow>> byBatch = rows.stream()
                .collect(Collectors.groupingBy(FacultyBatchSubjectFlatRow::getBatchId));

        List<FacultyBatchSubjectDTO.BatchSubjectAssignment> assignments = byBatch.entrySet().stream()
                .map(entry -> {
                    FacultyBatchSubjectDTO.BatchSubjectAssignment bsa = new FacultyBatchSubjectDTO.BatchSubjectAssignment();
                    bsa.setBatchId(entry.getKey());
                    List<FacultyBatchSubjectDTO.SubjectAssignment> subjects = entry.getValue().stream()
                            .map(row -> {
                                FacultyBatchSubjectDTO.SubjectAssignment sa = new FacultyBatchSubjectDTO.SubjectAssignment();
                                sa.setSubjectId(row.getSubjectId());
                                sa.setNewAssignment(row.getIsNewAssignment());
                                return sa;
                            })
                            .collect(Collectors.toList());
                    bsa.setSubjectAssignments(subjects);
                    return bsa;
                })
                .collect(Collectors.toList());

        dto.setBatchSubjectAssignments(assignments);
        return dto;
    }
}
