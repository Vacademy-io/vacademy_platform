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
import vacademy.io.admin_core_service.features.doubts.repository.DoubtsAssigneeRepository;
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

    @Autowired
    DoubtNotificationService doubtNotificationService;

    @Autowired
    DoubtsAssigneeRepository doubtsAssigneeRepository;

    @Autowired
    vacademy.io.admin_core_service.features.auth_service.service.AuthService authService;

    private final ObjectMapper objectMapper = new ObjectMapper();

    /** Role name as configured in auth_service for institute-level admins. */
    private static final String ADMIN_ROLE = "ADMIN";

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
        // Resolve the institute up-front — we need it for the admin fallback inside
        // resolveImplicitAssignees AND for the notification dispatch below.
        String instituteId = facultyMappingRepository
                .findInstituteIdByPackageSessionId(savedDoubt.getPackageSessionId())
                .orElse(null);
        List<String> finalAssigneeIds = new ArrayList<>();
        try {
            if (savedDoubt.getParentId() == null) {
                // Seed the assignee list with the cascade resolver: subject teacher → batch
                // teacher → admin. Driven by DOUBT_MANAGEMENT_SETTING.defaultAssigneeSource and
                // ensures the doubt is never silently dropped — at minimum the institute admin
                // gets notified so they can re-assign manually.
                String subjectId = resolveSubjectIdForDoubt(savedDoubt);
                Set<String> assigneeIds = new LinkedHashSet<>(resolveImplicitAssignees(
                        savedDoubt.getPackageSessionId(), subjectId, instituteId));
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
                finalAssigneeIds.addAll(assigneeIds);
            }
        } catch (Exception e) {
            log.error("Failed To Save Doubt Assignee: {}", e.getMessage());
        }

        // Fire "doubt raised" notifications after the assignees are persisted. Only for top-level
        // doubts (not replies) and only when we have at least one assignee to notify. Notification
        // failures are swallowed inside the service and must not affect the doubt creation response.
        if (savedDoubt.getParentId() == null && !finalAssigneeIds.isEmpty() && instituteId != null) {
            doubtNotificationService.notifyDoubtRaised(savedDoubt, finalAssigneeIds, instituteId);
        }
        return savedDoubt.getId();
    }

    /**
     * Returns distinct user ids for users who should be auto-assigned to a newly-created doubt on
     * the given package session. Behavior is driven by the institute's DOUBT_MANAGEMENT_SETTING:
     *
     * <ul>
     *   <li>{@code SUBJECT_TEACHER}: cascades subject teacher → batch teacher → admin. Subject
     *       narrowing only applies when a subject is resolvable (i.e. SLIDE-source doubts).</li>
     *   <li>{@code BATCH_TEACHER} or {@code BOTH} or unconfigured: cascades batch teacher → admin.</li>
     *   <li>{@code NONE}: skips faculty entirely and assigns directly to admin so doubts never
     *       go un-notified — the admin can then re-assign manually from the doubt UI.</li>
     * </ul>
     *
     * <p>Admin fallback is the safety net: even if no faculty is mapped to the batch, the
     * institute's ADMIN-role users will receive the doubt notification and bell alert. Returns
     * an empty list only when both the faculty lookup AND the admin lookup return nothing —
     * that means the institute has no users at all who can receive the doubt.
     *
     * @param subjectId  may be {@code null} for non-slide doubts; SUBJECT_TEACHER mode then skips
     *                   the subject step and cascades to batch.
     * @param instituteId required for the admin fallback lookup. If null, admin step is skipped.
     */
    List<String> resolveImplicitAssignees(String packageSessionId, String subjectId, String instituteId) {
        if (packageSessionId == null || packageSessionId.isEmpty()) return List.of();

        DoubtManagementSettingDataDto setting = loadDoubtManagementSetting(packageSessionId);
        DoubtDefaultAssigneeSourceEnum source = parseAssigneeSource(setting);

        // NONE → skip teachers entirely, go straight to admin so the doubt is still routed.
        if (source == DoubtDefaultAssigneeSourceEnum.NONE) {
            return resolveAdminFallback(instituteId);
        }

        // Step 1: SUBJECT_TEACHER → try the subject-specific faculty first.
        if (source == DoubtDefaultAssigneeSourceEnum.SUBJECT_TEACHER
                && subjectId != null && !subjectId.isEmpty()) {
            List<String> subjectFaculty = activeUserIdsFromMappings(
                    facultyMappingRepository.findByPackageSessionIdAndSubjectId(packageSessionId, subjectId));
            if (!subjectFaculty.isEmpty()) return subjectFaculty;
            // Subject teacher missing — honor fallback toggle. Default true: cascade to batch.
            boolean fallback = setting == null
                    || setting.getFallbackToBatchWhenNoSubjectTeacher() == null
                    || Boolean.TRUE.equals(setting.getFallbackToBatchWhenNoSubjectTeacher());
            if (!fallback) {
                // Strict subject-only mode: skip batch but still keep the admin safety net so
                // the doubt isn't dropped on the floor.
                return resolveAdminFallback(instituteId);
            }
        }

        // Step 2: batch-wide faculty (this is what BATCH_TEACHER mode hits directly, and what
        // SUBJECT_TEACHER mode falls back to when subject teacher is empty).
        List<String> batchFaculty = activeUserIdsFromMappings(
                facultyMappingRepository.findByPackageSessionId(packageSessionId));
        if (!batchFaculty.isEmpty()) return batchFaculty;

        // Step 3: final fallback — institute admin(s).
        return resolveAdminFallback(instituteId);
    }

    /**
     * Returns admin user IDs for the institute, or an empty list if none exist or instituteId is
     * unknown. Failures in auth_service are swallowed by AuthService.getUserIdsByRole.
     */
    private List<String> resolveAdminFallback(String instituteId) {
        if (instituteId == null || instituteId.isEmpty()) return List.of();
        try {
            return authService.getUserIdsByRole(instituteId, ADMIN_ROLE);
        } catch (Exception e) {
            log.warn("Admin fallback lookup failed for institute {}: {}", instituteId, e.getMessage());
            return List.of();
        }
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
        Doubts resolvedDoubtForNotification = null;
        Doubts assignedDoubtForNotification = null;
        List<String> newlyAssignedUserIds = List.of();
        try{
            Optional<Doubts> doubtsOpt = doubtService.getDoubtById(doubtId);
            if(doubtsOpt.isEmpty()) throw new VacademyException("Doubt Not Found");

            // Detect status transition to RESOLVED before we mutate the entity, so we only notify
            // on the actual flip (not every subsequent update while status already == RESOLVED).
            String previousStatus = doubtsOpt.get().getStatus();
            boolean transitioningToResolved = request.getStatus() != null
                    && DoubtStatusEnum.RESOLVED.name().equals(request.getStatus())
                    && !DoubtStatusEnum.RESOLVED.name().equals(previousStatus);

            // Snapshot the set of currently-active assignee user ids BEFORE createDoubtsAssignee
            // writes any new rows. The delta (request − snapshot) is who we'll notify as newly
            // assigned. Without this, we'd re-notify existing assignees every time any field on
            // the doubt changes.
            List<DoubtAssignee> existingAssignees = doubtsAssigneeRepository
                    .findByDoubtIdAndStatusNotIn(doubtId, List.of(DoubtAssigneeStatusEnum.DELETED.name()));
            Set<String> existingAssigneeUserIds = existingAssignees.stream()
                    .filter(a -> DoubtAssigneeSourceEnum.USER.name().equalsIgnoreCase(a.getSource()))
                    .filter(a -> DoubtAssigneeStatusEnum.ACTIVE.name().equalsIgnoreCase(a.getStatus()))
                    .map(DoubtAssignee::getSourceId)
                    .filter(id -> id != null && !id.isEmpty())
                    .collect(java.util.stream.Collectors.toSet());

            updateIfNotNull(request.getHtmlText(), doubtsOpt.get()::setHtmlText);
            updateIfNotNull(request.getStatus(), doubtsOpt.get()::setStatus);

            if(request.getStatus()!=null && request.getStatus().equals(DoubtStatusEnum.RESOLVED.name())){
                updateIfNotNull(new Date(), doubtsOpt.get()::setResolvedTime);
            }

            if(request.getDoubtAssigneeRequestUserIds()!=null){
                createDoubtsAssignee(doubtsOpt.get(), request.getDoubtAssigneeRequestUserIds());
                newlyAssignedUserIds = request.getDoubtAssigneeRequestUserIds().stream()
                        .filter(id -> id != null && !id.isEmpty())
                        .filter(id -> !existingAssigneeUserIds.contains(id))
                        .distinct()
                        .toList();
            }
            doubtService.updateOrCreateDoubt(doubtsOpt.get());

            if(request.getDeleteAssigneeRequest()!=null){
                doubtService.deleteAssigneeForDoubt(request.getDeleteAssigneeRequest());
            }

            if(request.getExcludedAssigneeUserIds()!=null && !request.getExcludedAssigneeUserIds().isEmpty()){
                persistExcludedAssignees(doubtsOpt.get(), request.getExcludedAssigneeUserIds());
            }

            if (transitioningToResolved) {
                resolvedDoubtForNotification = doubtsOpt.get();
            }
            if (!newlyAssignedUserIds.isEmpty() && doubtsOpt.get().getParentId() == null
                    && !DoubtStatusEnum.RESOLVED.name().equalsIgnoreCase(doubtsOpt.get().getStatus())) {
                assignedDoubtForNotification = doubtsOpt.get();
            }
        } catch (Exception e) {
            throw new VacademyException("Failed To Update Doubt: " +e.getMessage());
        }

        // Fire notifications outside the try/catch — notification-service errors must never surface
        // as a doubt-update failure. The service itself also swallows its own errors; this is
        // defence-in-depth.
        if (resolvedDoubtForNotification != null) {
            try {
                String instituteId = facultyMappingRepository
                        .findInstituteIdByPackageSessionId(resolvedDoubtForNotification.getPackageSessionId())
                        .orElse(null);
                if (instituteId != null) {
                    doubtNotificationService.notifyDoubtResolved(resolvedDoubtForNotification, instituteId);
                }
            } catch (Exception e) {
                log.warn("Doubt resolved notification dispatch failed: {}", e.getMessage());
            }
        }
        if (assignedDoubtForNotification != null) {
            // Admin just added new assignee(s). Reuse the "doubt raised" event — from the teacher's
            // perspective this is the same "please look at this doubt" signal. The channel prefs
            // (push_enabled / email_enabled / email_template_id) under on_doubt_raised apply.
            try {
                String instituteId = facultyMappingRepository
                        .findInstituteIdByPackageSessionId(assignedDoubtForNotification.getPackageSessionId())
                        .orElse(null);
                if (instituteId != null) {
                    doubtNotificationService.notifyDoubtRaised(
                            assignedDoubtForNotification, newlyAssignedUserIds, instituteId);
                }
            } catch (Exception e) {
                log.warn("Doubt newly-assigned notification dispatch failed: {}", e.getMessage());
            }
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
     * Check order:
     *   1. Null caller → no filter (defensive).
     *   2. Explicit TEACHER or STUDENT role → scope, ignoring {@code isRootUser}. Handles teacher
     *      accounts that were wrongly flagged root — the TEACHER role wins and they don't leak.
     *   3. ANY admin signal — ADMIN role OR {@code isRootUser} — → no filter. Checked BEFORE the
     *      FSPSSM probe so hybrid admins who happen to have teaching mappings (or stale FSPSSM
     *      rows from older provisioning) keep their unrestricted view.
     *   4. Has ACTIVE FSPSSM mapping → scope (custom role teachers like FACULTY/INSTRUCTOR).
     *   5. Otherwise → scope by user id.
     *
     * Tradeoff: teachers provisioned with {@code isRootUser=true} and NO formal TEACHER role will
     * pass through step 3 and see everything. That's a data-provisioning bug, not a code bug —
     * fix on the account by either clearing the root flag or adding the TEACHER role. Giving
     * real admins back their visibility is the higher priority.
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
        if (hasAnyFacultyMapping(user.getUserId())) {
            return user.getUserId();
        }
        return user.getUserId();
    }

    private boolean hasAnyFacultyMapping(String userId) {
        if (userId == null || userId.isEmpty()) return false;
        try {
            return !facultyMappingRepository.findByUserId(userId).isEmpty();
        } catch (Exception e) {
            log.warn("FSPSSM lookup failed for viewer scope detection, userId={}: {}", userId, e.getMessage());
            return false;
        }
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
