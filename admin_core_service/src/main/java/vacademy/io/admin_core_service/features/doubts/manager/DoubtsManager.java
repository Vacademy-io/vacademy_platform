package vacademy.io.admin_core_service.features.doubts.manager;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.doubts.dtos.AllDoubtsResponse;
import vacademy.io.admin_core_service.features.doubts.dtos.DoubtsDto;
import vacademy.io.admin_core_service.features.doubts.dtos.DoubtsRequestFilter;
import vacademy.io.admin_core_service.features.doubts.entity.DoubtAssignee;
import vacademy.io.admin_core_service.features.doubts.entity.Doubts;
import vacademy.io.admin_core_service.features.doubts.enums.DoubtAssigneeSourceEnum;
import vacademy.io.admin_core_service.features.doubts.enums.DoubtAssigneeStatusEnum;
import vacademy.io.admin_core_service.features.doubts.enums.DoubtStatusEnum;
import vacademy.io.admin_core_service.features.doubts.service.DoubtService;
import vacademy.io.admin_core_service.features.faculty.entity.FacultySubjectPackageSessionMapping;
import vacademy.io.admin_core_service.features.faculty.repository.FacultySubjectPackageSessionMappingRepository;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.core.standard_classes.ListService;
import vacademy.io.common.exceptions.VacademyException;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Slf4j
@Component
public class DoubtsManager {

    @Autowired
    DoubtService doubtService;

    @Autowired
    FacultySubjectPackageSessionMappingRepository facultyMappingRepository;

    public ResponseEntity<String> updateOrCreateDoubt(CustomUserDetails userDetails, String doubtId, DoubtsDto request) {
        if(StringUtils.hasText(doubtId)){
            return ResponseEntity.ok(updateDoubt(doubtId, request));
        }

        return ResponseEntity.ok(createNewDoubt(request));
    }

    private String createNewDoubt(DoubtsDto request) {
        Doubts doubts = Doubts.builder()
                .status(DoubtStatusEnum.ACTIVE.name())
                .userId(request.getUserId())
                .source(request.getSource())
                .sourceId(request.getSourceId())
                .htmlText(request.getHtmlText())
                .parentLevel(request.getParentLevel() == null ? 0 : request.getParentLevel())
                .raisedTime(new Date())
                .parentId(request.getParentId())
                .contentPosition(request.getContentPosition())
                .contentType(request.getContentType())
                .packageSessionId(request.getBatchId())
                .build();

        Doubts savedDoubt = doubtService.updateOrCreateDoubt(doubts);
        try{
            if(request.getDoubtAssigneeRequestUserIds()!=null && request.getParentId() == null){
                createDoubtsAssignee(savedDoubt, request.getDoubtAssigneeRequestUserIds());
            }
        } catch (Exception e) {
            log.error("Failed To Save Doubt Assignee: {}", e.getMessage());
        }
        return savedDoubt.getId();
    }

    private String updateDoubt(String doubtId, DoubtsDto request) {
        try{
            Optional<Doubts> doubtsOpt = doubtService.getDoubtById(doubtId);
            if(doubtsOpt.isEmpty()) throw new VacademyException("Doubt Not Found");

            updateIfNotNull(request.getHtmlText(), doubtsOpt.get()::setHtmlText);
            updateIfNotNull(request.getStatus(), doubtsOpt.get()::setStatus);

            if(request.getStatus()!=null && request.getStatus().equals(DoubtStatusEnum.RESOLVED.name())){
                updateIfNotNull(new Date(), doubtsOpt.get()::setResolvedTime);
            }

            if(request.getDoubtAssigneeRequestUserIds()!=null){
                createDoubtsAssignee(doubtsOpt.get(), request.getDoubtAssigneeRequestUserIds());
            }
            doubtService.updateOrCreateDoubt(doubtsOpt.get());

            if(request.getDeleteAssigneeRequest()!=null){
                doubtService.deleteAssigneeForDoubt(request.getDeleteAssigneeRequest());
            }
        } catch (Exception e) {
            throw new VacademyException("Failed To Update Doubt: " +e.getMessage());
        }

        return doubtId;
    }

    private void createDoubtsAssignee(Doubts doubts, List<String> doubtAssigneeRequestUserIds) {
        List<DoubtAssignee> allNewAssignee = new ArrayList<>();

        doubtAssigneeRequestUserIds.forEach(userId->{
            allNewAssignee.add(DoubtAssignee.builder()
                    .doubts(doubts)
                    .source(DoubtAssigneeSourceEnum.USER.name())
                    .sourceId(userId)
                    .status(DoubtAssigneeStatusEnum.ACTIVE.name()).build());
        });

        doubtService.saveOrUpdateDoubtsAssignee(allNewAssignee);
    }

    private <T> void updateIfNotNull(T value, java.util.function.Consumer<T> setterMethod) {
        if (value != null) {
            setterMethod.accept(value);
        }
    }

    public ResponseEntity<AllDoubtsResponse> getAllDoubts(CustomUserDetails userDetails, DoubtsRequestFilter filter, int pageNo, int pageSize) {
        Sort sortColumns = ListService.createSortObject(filter.getSortColumns());
        Pageable pageable = PageRequest.of(pageNo,pageSize,sortColumns);

        if (!applyFacultyAccessFilter(userDetails, filter)) {
            return ResponseEntity.ok(createDoubtAllResponse(Page.empty(pageable)));
        }

        Page<Doubts> paginatedDoubts = doubtService.getAllDoubtsWithFilter(filter.getContentTypes(), filter.getContentPositions(),filter.getSources(),
                filter.getSourceIds(),filter.getStartDate(),filter.getEndDate(), filter.getUserIds(), filter.getStatus(), filter.getBatchIds(), pageable);


        return ResponseEntity.ok(createDoubtAllResponse(paginatedDoubts));
    }

    /**
     * Restricts the doubt query to only the package sessions where the user is an assigned faculty.
     * Admins and root users see all doubts unchanged. Returns false if the user is a faculty member
     * with no overlap between accessible and requested batches — caller should short-circuit to empty.
     */
    private boolean applyFacultyAccessFilter(CustomUserDetails user, DoubtsRequestFilter filter) {
        if (user == null || user.isRootUser() || hasRole(user, "ADMIN")) {
            return true;
        }
        if (!hasFacultyAssignedPermission(user)) {
            return true;
        }

        Set<String> accessiblePsIds = facultyMappingRepository.findByUserId(user.getUserId()).stream()
                .filter(m -> "ACTIVE".equalsIgnoreCase(m.getStatus()))
                .flatMap(m -> {
                    List<String> ids = new ArrayList<>();
                    if (m.getPackageSessionId() != null) ids.add(m.getPackageSessionId());
                    if ("PACKAGE_SESSION".equalsIgnoreCase(m.getAccessType()) && m.getAccessId() != null) {
                        ids.add(m.getAccessId());
                    }
                    return ids.stream();
                })
                .collect(Collectors.toSet());

        if (accessiblePsIds.isEmpty()) {
            return false;
        }

        List<String> requestedBatchIds = filter.getBatchIds();
        List<String> effective;
        if (requestedBatchIds == null || requestedBatchIds.isEmpty()) {
            effective = new ArrayList<>(accessiblePsIds);
        } else {
            effective = requestedBatchIds.stream()
                    .filter(id -> id != null && !id.isEmpty() && accessiblePsIds.contains(id))
                    .collect(Collectors.toList());
        }

        if (effective.isEmpty()) {
            return false;
        }
        filter.setBatchIds(effective);
        return true;
    }

    private boolean hasRole(CustomUserDetails user, String... roles) {
        return user.getAuthorities().stream()
                .map(auth -> auth.getAuthority())
                .anyMatch(authority -> {
                    for (String role : roles) {
                        if (role.equalsIgnoreCase(authority)) return true;
                    }
                    return false;
                });
    }

    private boolean hasFacultyAssignedPermission(CustomUserDetails user) {
        boolean fromAuthorities = user.getAuthorities().stream()
                .map(auth -> auth.getAuthority())
                .anyMatch(authority -> "HAS_FACULTY_ASSIGNED".equalsIgnoreCase(authority));
        if (fromAuthorities) return true;
        List<FacultySubjectPackageSessionMapping> mappings = facultyMappingRepository.findByUserId(user.getUserId());
        return mappings.stream().anyMatch(m -> "ACTIVE".equalsIgnoreCase(m.getStatus()));
    }

    private AllDoubtsResponse createDoubtAllResponse(Page<Doubts> paginatedDoubts) {
        if(paginatedDoubts == null){
            return AllDoubtsResponse.builder()
                    .content(new ArrayList<>())
                    .last(true)
                    .pageNo(0)
                    .pageSize(0)
                    .totalElements(0)
                    .totalPages(0)
                    .build();
        }

        List<Doubts> allDoubts = paginatedDoubts.getContent();
        return AllDoubtsResponse.builder()
                .content(doubtService.createDtoFromDoubts(allDoubts))
                .totalPages(paginatedDoubts.getTotalPages())
                .last(paginatedDoubts.isLast())
                .pageNo(paginatedDoubts.getNumber())
                .pageSize(paginatedDoubts.getSize())
                .totalElements(paginatedDoubts.getTotalElements()).build();
    }



}
