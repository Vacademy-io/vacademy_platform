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

    @Autowired
    vacademy.io.admin_core_service.features.workflow.service.WorkflowTriggerService workflowTriggerService;

    private final ObjectMapper objectMapper = new ObjectMapper();

    /** Role name as configured in auth_service for institute-level admins. */
    private static final String ADMIN_ROLE = "ADMIN";

    /** Default query type key for legacy/untyped doubts (academic, slide-anchored). */
    private static final String DEFAULT_TYPE = "DOUBT";

    public ResponseEntity<String> updateOrCreateDoubt(CustomUserDetails userDetails, String doubtId, DoubtsDto request) {
        if(StringUtils.hasText(doubtId)){
            return ResponseEntity.ok(updateDoubt(doubtId, request));
        }

        return ResponseEntity.ok(createNewDoubt(request));
    }

    private String createNewDoubt(DoubtsDto request) {
        boolean isReply = StringUtils.hasText(request.getParentId());

        // Resolve type / institute / batch up-front — needed for per-type routing, the admin
        // fallback, AND the notification dispatch below.
        String type;
        String instituteId;
        String packageSessionId;
        if (isReply) {
            // A reply belongs to its parent's thread — inherit tenancy/type/batch from the parent so
            // the row is consistent regardless of what the client echoed back.
            Doubts parent = doubtService.getDoubtById(request.getParentId()).orElse(null);
            type = (parent != null && StringUtils.hasText(parent.getType())) ? parent.getType() : DEFAULT_TYPE;
            instituteId = parent != null ? parent.getInstituteId() : request.getInstituteId();
            packageSessionId = parent != null ? parent.getPackageSessionId() : request.getBatchId();
            if (!StringUtils.hasText(instituteId) && StringUtils.hasText(packageSessionId)) {
                instituteId = facultyMappingRepository.findInstituteIdByPackageSessionId(packageSessionId).orElse(null);
            }
        } else {
            type = StringUtils.hasText(request.getType()) ? request.getType() : DEFAULT_TYPE;
            packageSessionId = request.getBatchId();
            // When the doubt is on a batch (SLIDE doubts), the batch is the source of truth for
            // tenancy — derive institute from it FIRST so a learner's stored "home" institute can't
            // mis-scope a doubt on a cross-institute course. Only batch-less GENERAL queries trust
            // the request's instituteId.
            if (StringUtils.hasText(packageSessionId)) {
                instituteId = facultyMappingRepository.findInstituteIdByPackageSessionId(packageSessionId)
                        .orElse(StringUtils.hasText(request.getInstituteId()) ? request.getInstituteId() : null);
            } else {
                instituteId = StringUtils.hasText(request.getInstituteId()) ? request.getInstituteId() : null;
            }
            // A GENERAL query has no batch to fall back on — fail loud rather than silently
            // orphaning it with a null institute (no routing, no notification, invisible in inbox).
            if (DoubtsSourceEnum.GENERAL.name().equals(request.getSource())
                    && !StringUtils.hasText(instituteId)) {
                throw new VacademyException("instituteId is required for general queries");
            }
        }

        Doubts doubts = Doubts.builder()
                .status(DoubtStatusEnum.ACTIVE.name())
                .userId(request.getUserId())
                .source(request.getSource())
                .sourceId(request.getSourceId())
                .type(type)
                .instituteId(instituteId)
                .htmlText(request.getHtmlText())
                .parentLevel(request.getParentLevel() == null ? 0 : request.getParentLevel())
                .raisedTime(new Date())
                .parentId(request.getParentId())
                .contentPosition(request.getContentPosition())
                .contentType(request.getContentType())
                .packageSessionId(packageSessionId)
                .build();

        Doubts savedDoubt = doubtService.updateOrCreateDoubt(doubts);
        List<String> finalAssigneeIds = new ArrayList<>();
        try {
            if (savedDoubt.getParentId() == null) {
                // Seed the assignee list via per-type routing (DOUBT_MANAGEMENT_SETTING.queryTypes):
                // each type may route to subject/batch teacher, a role, or specific staff. Types with
                // no config fall back to the global defaultAssigneeSource cascade. In every faculty
                // path the institute admin is the safety net so the doubt is never silently dropped.
                String subjectId = resolveSubjectIdForDoubt(savedDoubt);
                DoubtManagementSettingDataDto setting = loadDoubtManagementSettingByInstitute(instituteId);
                Set<String> assigneeIds = new LinkedHashSet<>(resolveAssigneesForDoubt(
                        savedDoubt, subjectId, instituteId, setting));
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

        // Fire the DOUBT_RAISED workflow trigger so admin/team-notification
        // recipes can react. Only for top-level doubts (replies don't count as
        // a "raised" event) and only when we know the institute. Wrapped so
        // workflow failures can't affect the doubt creation response.
        if (savedDoubt.getParentId() == null && instituteId != null && !instituteId.isBlank()) {
            try {
                java.util.Map<String, Object> ctx = new java.util.HashMap<>();
                ctx.put("doubtId", savedDoubt.getId());
                ctx.put("userId", savedDoubt.getUserId());
                ctx.put("packageSessionId", savedDoubt.getPackageSessionId());
                ctx.put("source", savedDoubt.getSource());
                ctx.put("sourceId", savedDoubt.getSourceId());
                ctx.put("contentType", savedDoubt.getContentType());
                ctx.put("htmlText", savedDoubt.getHtmlText());
                ctx.put("raisedTime", savedDoubt.getRaisedTime());
                ctx.put("assigneeIds", finalAssigneeIds);
                workflowTriggerService.handleTriggerEvents(
                        vacademy.io.admin_core_service.features.workflow.enums.WorkflowTriggerEvent.DOUBT_RAISED.name(),
                        savedDoubt.getId(),
                        instituteId,
                        ctx);
            } catch (Exception wfe) {
                log.warn("Failed to trigger DOUBT_RAISED workflow for doubt {}: {}",
                        savedDoubt.getId(), wfe.getMessage());
            }
        }

        return savedDoubt.getId();
    }

    /**
     * Routes a freshly-created top-level doubt to its default assignees based on its {@code type}.
     * Looks up the type's config in {@code DOUBT_MANAGEMENT_SETTING.queryTypes}; when present, uses
     * its per-type {@code assignee} block, otherwise falls back to the institute-wide
     * {@code defaultAssigneeSource} cascade (legacy behavior). The admin safety net inside the
     * cascade ensures a doubt is never silently dropped.
     */
    private List<String> resolveAssigneesForDoubt(Doubts doubt, String subjectId, String instituteId,
                                                  DoubtManagementSettingDataDto setting) {
        String typeKey = StringUtils.hasText(doubt.getType()) ? doubt.getType() : DEFAULT_TYPE;
        DoubtManagementSettingDataDto.QueryTypeConfig typeConfig = findTypeConfig(setting, typeKey);
        if (typeConfig != null && typeConfig.getAssignee() != null
                && StringUtils.hasText(typeConfig.getAssignee().getSource())) {
            return resolveTypeAssignees(typeConfig.getAssignee(), doubt.getPackageSessionId(),
                    subjectId, instituteId, setting);
        }
        // No per-type routing for this type → institute-wide default cascade.
        return resolveImplicitAssignees(parseAssigneeSource(setting), doubt.getPackageSessionId(),
                subjectId, instituteId, setting);
    }

    private DoubtManagementSettingDataDto.QueryTypeConfig findTypeConfig(
            DoubtManagementSettingDataDto setting, String typeKey) {
        if (setting == null || setting.getQueryTypes() == null) return null;
        return setting.getQueryTypes().stream()
                .filter(t -> t != null && typeKey.equalsIgnoreCase(t.getKey()))
                .findFirst().orElse(null);
    }

    /**
     * Resolves assignees for a type whose {@code assignee.source} is set:
     *   SPECIFIC_USERS → the configured user ids; ROLE → all users holding that role;
     *   SUBJECT/BATCH/BOTH → the faculty cascade; NONE → no implicit assignee (manual triage from
     *   the institute-scoped admin inbox). SPECIFIC_USERS/ROLE fall back to admin when they resolve
     *   to nobody so the query isn't dropped.
     */
    private List<String> resolveTypeAssignees(DoubtManagementSettingDataDto.QueryTypeAssignee assignee,
                                              String packageSessionId, String subjectId, String instituteId,
                                              DoubtManagementSettingDataDto setting) {
        DoubtDefaultAssigneeSourceEnum source = parseSource(assignee.getSource());
        switch (source) {
            case SPECIFIC_USERS: {
                List<String> ids = assignee.getUserIds() == null ? List.of()
                        : assignee.getUserIds().stream().filter(StringUtils::hasText).distinct().toList();
                return ids.isEmpty() ? resolveAdminFallback(instituteId) : ids;
            }
            case ROLE: {
                String role = StringUtils.hasText(assignee.getRole()) ? assignee.getRole() : ADMIN_ROLE;
                List<String> ids = resolveUsersByRole(instituteId, role);
                return ids.isEmpty() ? resolveAdminFallback(instituteId) : ids;
            }
            case NONE:
                return List.of();
            default:
                return resolveImplicitAssignees(source, packageSessionId, subjectId, instituteId, setting);
        }
    }

    /**
     * Faculty cascade for SUBJECT_TEACHER / BATCH_TEACHER / BOTH (cascades teacher → batch → admin).
     * Reused by both the legacy global-default path and per-type routing — the caller passes the
     * resolved {@code source} and the loaded {@code setting}. Admin fallback is the safety net: even
     * with no faculty mapped, the institute's ADMIN users still receive the doubt. Returns empty only
     * when neither faculty nor admin lookup yields anyone.
     *
     * @param subjectId  may be {@code null} (non-slide); SUBJECT_TEACHER then skips the subject step.
     * @param instituteId required for the admin fallback; if null the admin step is skipped.
     */
    List<String> resolveImplicitAssignees(DoubtDefaultAssigneeSourceEnum source, String packageSessionId,
                                          String subjectId, String instituteId,
                                          DoubtManagementSettingDataDto setting) {
        // NONE → skip teachers entirely, go straight to admin so the doubt is still routed.
        if (source == DoubtDefaultAssigneeSourceEnum.NONE) {
            return resolveAdminFallback(instituteId);
        }
        // ROLE / SPECIFIC_USERS are only meaningful as a per-type choice, not a global cascade — if
        // one reaches here, route to admin rather than nobody.
        if (source == DoubtDefaultAssigneeSourceEnum.ROLE
                || source == DoubtDefaultAssigneeSourceEnum.SPECIFIC_USERS) {
            return resolveAdminFallback(instituteId);
        }
        // The faculty cascade needs a batch. GENERAL queries (no batch) → admin fallback.
        if (packageSessionId == null || packageSessionId.isEmpty()) {
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
        return resolveUsersByRole(instituteId, ADMIN_ROLE);
    }

    /** Returns the user ids holding {@code role} in the institute, or empty on any failure/blank input. */
    private List<String> resolveUsersByRole(String instituteId, String role) {
        if (instituteId == null || instituteId.isEmpty() || !StringUtils.hasText(role)) return List.of();
        try {
            return authService.getUserIdsByRole(instituteId, role);
        } catch (Exception e) {
            log.warn("Role lookup failed for institute {} role {}: {}", instituteId, role, e.getMessage());
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

    /**
     * Parses a per-type {@code assignee.source} string into the enum, tolerating unknown/blank
     * values (older/newer frontend) by falling back to BATCH_TEACHER rather than throwing.
     */
    private DoubtDefaultAssigneeSourceEnum parseSource(String raw) {
        if (!StringUtils.hasText(raw)) return DoubtDefaultAssigneeSourceEnum.BATCH_TEACHER;
        try {
            return DoubtDefaultAssigneeSourceEnum.valueOf(raw.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            log.warn("Unknown per-type assignee source '{}', falling back to BATCH_TEACHER", raw);
            return DoubtDefaultAssigneeSourceEnum.BATCH_TEACHER;
        }
    }

    private DoubtManagementSettingDataDto loadDoubtManagementSettingByInstitute(String instituteId) {
        if (instituteId == null || instituteId.isEmpty()) return null;
        try {
            Object raw = instituteSettingService.getSettingByInstituteIdAndKey(
                    instituteId, SettingKeyEnums.DOUBT_MANAGEMENT_SETTING.name());
            if (raw == null) return null;
            return objectMapper.convertValue(raw, DoubtManagementSettingDataDto.class);
        } catch (Exception e) {
            log.warn("Failed to read DOUBT_MANAGEMENT_SETTING for institute {}: {}",
                    instituteId, e.getMessage());
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
                filter.getSourceIds(), filter.getTypes(), filter.getStartDate(), filter.getEndDate(), filter.getUserIds(), filter.getStatus(),
                filter.getBatchIds(), filter.getInstituteId(), viewerUserId, pageable);

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
