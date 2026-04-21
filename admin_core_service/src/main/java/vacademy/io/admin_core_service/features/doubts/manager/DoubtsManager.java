package vacademy.io.admin_core_service.features.doubts.manager;

import com.fasterxml.jackson.databind.ObjectMapper;
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
import vacademy.io.admin_core_service.features.doubts.enums.DoubtsSourceEnum;
import vacademy.io.admin_core_service.features.doubts.service.DoubtService;
import vacademy.io.admin_core_service.features.faculty.entity.FacultySubjectPackageSessionMapping;
import vacademy.io.admin_core_service.features.faculty.repository.FacultySubjectPackageSessionMappingRepository;
import vacademy.io.admin_core_service.features.institute.dto.settings.doubt_management.DoubtDefaultAssigneeSourceEnum;
import vacademy.io.admin_core_service.features.institute.dto.settings.doubt_management.DoubtManagementSettingDataDto;
import vacademy.io.admin_core_service.features.institute.enums.SettingKeyEnums;
import vacademy.io.admin_core_service.features.institute.service.setting.InstituteSettingService;
import vacademy.io.admin_core_service.features.slide.dto.SlideMetadataProjection;
import vacademy.io.admin_core_service.features.slide.service.SlideMetaDataService;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.core.standard_classes.ListService;
import vacademy.io.common.exceptions.VacademyException;

import java.util.ArrayList;
import java.util.Date;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

@Slf4j
@Component
public class DoubtsManager {

    @Autowired
    DoubtService doubtService;

    @Autowired
    FacultySubjectPackageSessionMappingRepository facultyMappingRepository;

    @Autowired
    InstituteSettingService instituteSettingService;

    @Autowired
    SlideMetaDataService slideMetaDataService;

    private final ObjectMapper objectMapper = new ObjectMapper();

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
        try {
            if (savedDoubt.getParentId() == null) {
                // Seed the assignee list with faculty who are FSPSSM-linked to this batch — these
                // become the "default" assignees an admin sees as pre-selected for the doubt. The
                // exact set (subject-scoped / batch-wide / none) is controlled by the institute's
                // DOUBT_MANAGEMENT_SETTING.
                String subjectId = resolveSubjectIdForDoubt(savedDoubt);
                Set<String> assigneeIds = new LinkedHashSet<>(resolveImplicitAssignees(
                        savedDoubt.getPackageSessionId(), subjectId));
                // Overlay any explicit ids the client asked for (e.g. admin picked someone from
                // the dropdown at creation time).
                if (request.getDoubtAssigneeRequestUserIds() != null) {
                    request.getDoubtAssigneeRequestUserIds().stream()
                            .filter(id -> id != null && !id.isEmpty())
                            .forEach(assigneeIds::add);
                }
                if (!assigneeIds.isEmpty()) {
                    createDoubtsAssignee(savedDoubt, new ArrayList<>(assigneeIds));
                }
            }
        } catch (Exception e) {
            log.error("Failed To Save Doubt Assignee: {}", e.getMessage());
        }
        return savedDoubt.getId();
    }

    /**
     * Returns distinct user ids for faculty who should be auto-assigned to a newly-created doubt
     * on the given package session. Behavior is driven by the institute's DOUBT_MANAGEMENT_SETTING:
     *   - SUBJECT_TEACHER: only faculty whose FSPSSM row matches the doubt's subject. Falls back
     *     to batch-wide when no subject match exists AND {@code fallbackToBatchWhenNoSubjectTeacher}
     *     is true (default).
     *   - BATCH_TEACHER / BOTH / unconfigured: all faculty FSPSSM-linked to the batch (legacy).
     *   - NONE: empty list — admin must assign manually.
     *
     * {@code subjectId} may be {@code null} for non-slide doubts; in that case SUBJECT_TEACHER
     * cannot narrow and we treat it as batch-wide.
     */
    List<String> resolveImplicitAssignees(String packageSessionId, String subjectId) {
        if (packageSessionId == null || packageSessionId.isEmpty()) return List.of();

        DoubtManagementSettingDataDto setting = loadDoubtManagementSetting(packageSessionId);
        DoubtDefaultAssigneeSourceEnum source = parseAssigneeSource(setting);

        if (source == DoubtDefaultAssigneeSourceEnum.NONE) {
            return List.of();
        }

        // Narrow to subject-specific faculty when requested and possible.
        if (source == DoubtDefaultAssigneeSourceEnum.SUBJECT_TEACHER
                && subjectId != null && !subjectId.isEmpty()) {
            List<String> subjectFaculty = activeUserIdsFromMappings(
                    facultyMappingRepository.findByPackageSessionIdAndSubjectId(packageSessionId, subjectId));
            if (!subjectFaculty.isEmpty()) return subjectFaculty;

            boolean fallback = setting == null
                    || setting.getFallbackToBatchWhenNoSubjectTeacher() == null
                    || Boolean.TRUE.equals(setting.getFallbackToBatchWhenNoSubjectTeacher());
            if (!fallback) return List.of();
            // fall through to batch-wide
        }

        return activeUserIdsFromMappings(facultyMappingRepository.findByPackageSessionId(packageSessionId));
    }

    private List<String> activeUserIdsFromMappings(List<FacultySubjectPackageSessionMapping> mappings) {
        return mappings.stream()
                .filter(m -> "ACTIVE".equalsIgnoreCase(m.getStatus()))
                .map(FacultySubjectPackageSessionMapping::getUserId)
                .filter(id -> id != null && !id.isEmpty())
                .distinct()
                .toList();
    }

    private DoubtDefaultAssigneeSourceEnum parseAssigneeSource(DoubtManagementSettingDataDto setting) {
        // No setting configured → preserve legacy behavior (batch-wide) so existing institutes
        // aren't surprised by a narrower auto-assign after deploy.
        if (setting == null || setting.getDefaultAssigneeSource() == null) {
            return DoubtDefaultAssigneeSourceEnum.BATCH_TEACHER;
        }
        try {
            return DoubtDefaultAssigneeSourceEnum.valueOf(setting.getDefaultAssigneeSource());
        } catch (IllegalArgumentException e) {
            log.warn("Unknown default_assignee_source value '{}', falling back to BATCH_TEACHER",
                    setting.getDefaultAssigneeSource());
            return DoubtDefaultAssigneeSourceEnum.BATCH_TEACHER;
        }
    }

    private DoubtManagementSettingDataDto loadDoubtManagementSetting(String packageSessionId) {
        Optional<String> instituteIdOpt =
                facultyMappingRepository.findInstituteIdByPackageSessionId(packageSessionId);
        if (instituteIdOpt.isEmpty()) return null;
        try {
            Object raw = instituteSettingService.getSettingByInstituteIdAndKey(
                    instituteIdOpt.get(), SettingKeyEnums.DOUBT_MANAGEMENT_SETTING.name());
            if (raw == null) return null;
            return objectMapper.convertValue(raw, DoubtManagementSettingDataDto.class);
        } catch (Exception e) {
            log.warn("Failed to read DOUBT_MANAGEMENT_SETTING for packageSessionId={}: {}",
                    packageSessionId, e.getMessage());
            return null;
        }
    }

    /**
     * For SLIDE-source doubts, the subject isn't on the doubt row — it lives on the slide's
     * metadata (subject → module → chapter → slide). Returns {@code null} for non-slide sources
     * or when metadata can't be resolved; callers treat null as "no subject narrowing possible."
     */
    private String resolveSubjectIdForDoubt(Doubts doubt) {
        if (!DoubtsSourceEnum.SLIDE.name().equals(doubt.getSource())) return null;
        if (doubt.getSourceId() == null || doubt.getSourceId().isEmpty()) return null;
        Optional<SlideMetadataProjection> projection =
                slideMetaDataService.getSlideMetadataForAdmin(doubt.getSourceId());
        return projection.map(SlideMetadataProjection::getSubjectId).orElse(null);
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

            if(request.getExcludedAssigneeUserIds()!=null && !request.getExcludedAssigneeUserIds().isEmpty()){
                persistExcludedAssignees(doubtsOpt.get(), request.getExcludedAssigneeUserIds());
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

    /**
     * Persist an "exclusion" — the admin has removed a default (FSPSSM-implicit) teacher from this
     * doubt. We store a {@link DoubtAssignee} row with status {@code DELETED} so the exclusion
     * survives page reloads; the UI reads these back via {@code excluded_assignee_user_ids} and
     * filters them out of the default pill list.
     */
    private void persistExcludedAssignees(Doubts doubts, List<String> userIds) {
        List<DoubtAssignee> rows = new ArrayList<>();
        userIds.stream()
                .filter(id -> id != null && !id.isEmpty())
                .distinct()
                .forEach(userId -> rows.add(DoubtAssignee.builder()
                        .doubts(doubts)
                        .source(DoubtAssigneeSourceEnum.USER.name())
                        .sourceId(userId)
                        .status(DoubtAssigneeStatusEnum.DELETED.name())
                        .build()));
        if (!rows.isEmpty()) {
            doubtService.saveOrUpdateDoubtsAssignee(rows);
        }
    }

    private <T> void updateIfNotNull(T value, java.util.function.Consumer<T> setterMethod) {
        if (value != null) {
            setterMethod.accept(value);
        }
    }

    public ResponseEntity<AllDoubtsResponse> getAllDoubts(CustomUserDetails userDetails, DoubtsRequestFilter filter, int pageNo, int pageSize) {
        Sort sortColumns = ListService.createSortObject(filter.getSortColumns());
        Pageable pageable = PageRequest.of(pageNo,pageSize,sortColumns);

        String viewerUserId = resolveViewerUserId(userDetails);

        Page<Doubts> paginatedDoubts = doubtService.getAllDoubtsWithFilter(filter.getContentTypes(), filter.getContentPositions(), filter.getSources(),
                filter.getSourceIds(), filter.getStartDate(), filter.getEndDate(), filter.getUserIds(), filter.getStatus(), filter.getBatchIds(),
                viewerUserId, pageable);

        return ResponseEntity.ok(createDoubtAllResponse(paginatedDoubts));
    }

    /**
     * Returns {@code null} when the caller should see all doubts (admin / unrestricted), and the
     * user id when the caller's view should be scoped by doubt_assignee / FSPSSM / self-raised.
     *
     * Rule (aligned with product ask "only admin can see all doubts"):
     *   1. Null caller → no filter (defensive).
     *   2. Caller is a TEACHER or STUDENT → always scope, even if {@code is_root_user} is true on
     *      the account. Some teacher/student accounts are incorrectly provisioned with the root
     *      flag and we do NOT want that to leak every doubt to them.
     *   3. Otherwise, if caller is explicitly an ADMIN role or the account is root → no filter.
     *   4. Otherwise (non-teacher, non-student, non-admin, non-root) → scope by user id. They
     *      will only see doubts they're directly assigned to via doubt_assignee.
     */
    private String resolveViewerUserId(CustomUserDetails user) {
        if (user == null) {
            return null;
        }
        if (hasRole(user, "TEACHER") || hasRole(user, "STUDENT")) {
            return user.getUserId();
        }
        if (hasRole(user, "ADMIN") || user.isRootUser()) {
            return null;
        }
        return user.getUserId();
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
