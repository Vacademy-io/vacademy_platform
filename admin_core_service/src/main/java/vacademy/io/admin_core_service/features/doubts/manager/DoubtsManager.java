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
import vacademy.io.admin_core_service.features.doubts.dtos.OpenDoubtConfigResponse;
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

    /** Basic shape check; deliverability is not verified — the reply email just bounces if fake. */
    private static final java.util.regex.Pattern EMAIL_PATTERN =
            java.util.regex.Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");

    private static final int GUEST_TEXT_MAX_CHARS = 5000;
    private static final int GUEST_CONTACT_MAX_CHARS = 255;

    /**
     * Public (unauthenticated) view of the query-intake config for the login page. Never throws —
     * any failure reads as "disabled" so the public endpoint can't 5xx.
     */
    public OpenDoubtConfigResponse getOpenDoubtConfig(String instituteId) {
        try {
            DoubtManagementSettingDataDto setting = loadDoubtManagementSettingByInstitute(instituteId);
            if (setting == null || setting.getLearnerQuery() == null
                    || !Boolean.TRUE.equals(setting.getLearnerQuery().getEnabled())) {
                return OpenDoubtConfigResponse.disabled();
            }
            List<OpenDoubtConfigResponse.QueryTypeOption> types = learnerSelectableTypes(setting).stream()
                    .map(t -> new OpenDoubtConfigResponse.QueryTypeOption(t.getKey(), t.getLabel()))
                    .toList();
            return OpenDoubtConfigResponse.builder()
                    .learnerQuery(new OpenDoubtConfigResponse.LearnerQueryFlags(
                            true, Boolean.TRUE.equals(setting.getLearnerQuery().getAllowGuest())))
                    .queryTypes(types)
                    .build();
        } catch (Exception e) {
            log.warn("Open doubt config lookup failed for institute {}: {}", instituteId, e.getMessage());
            return OpenDoubtConfigResponse.disabled();
        }
    }

    /**
     * Logged-out guest query creation (open endpoint). Server-side gate: the institute's
     * allow-guest toggle must be ON regardless of what the client claims; contact + content are
     * validated and the doubt is forced to a batchless GENERAL shape with no user id.
     */
    public String createGuestDoubt(DoubtsDto request) {
        if (request == null || !StringUtils.hasText(request.getInstituteId())) {
            throw new VacademyException("instituteId is required");
        }
        DoubtManagementSettingDataDto setting = loadDoubtManagementSettingByInstitute(request.getInstituteId());
        boolean guestAllowed = setting != null && setting.getLearnerQuery() != null
                && Boolean.TRUE.equals(setting.getLearnerQuery().getEnabled())
                && Boolean.TRUE.equals(setting.getLearnerQuery().getAllowGuest());
        if (!guestAllowed) {
            throw new VacademyException("Guest queries are not enabled for this institute");
        }
        if (!StringUtils.hasText(request.getGuestName())
                || request.getGuestName().trim().length() > GUEST_CONTACT_MAX_CHARS) {
            throw new VacademyException("Name is required");
        }
        if (!StringUtils.hasText(request.getGuestEmail())
                || request.getGuestEmail().trim().length() > GUEST_CONTACT_MAX_CHARS
                || !EMAIL_PATTERN.matcher(request.getGuestEmail().trim()).matches()) {
            throw new VacademyException("A valid email is required");
        }
        if (!StringUtils.hasText(request.getHtmlText())) {
            throw new VacademyException("Query text is required");
        }
        if (request.getHtmlText().length() > GUEST_TEXT_MAX_CHARS) {
            throw new VacademyException("Query text is too long");
        }
        // Match case-insensitively but persist the CONFIGURED key so the admin inbox type filter
        // (exact d.type IN :types) still matches; uppercasing the raw client echo would diverge.
        String requestedType = StringUtils.hasText(request.getType()) ? request.getType().trim() : DEFAULT_TYPE;
        String canonicalKey = learnerSelectableTypes(setting).stream()
                .filter(t -> requestedType.equalsIgnoreCase(t.getKey()))
                .map(DoubtManagementSettingDataDto.QueryTypeConfig::getKey)
                .findFirst()
                .orElse(null);
        if (canonicalKey == null) {
            throw new VacademyException("Unknown query type");
        }

        DoubtsDto sanitized = DoubtsDto.builder()
                .source(DoubtsSourceEnum.GENERAL.name())
                .type(canonicalKey)
                .instituteId(request.getInstituteId())
                .guestName(request.getGuestName().trim())
                .guestEmail(request.getGuestEmail().trim())
                .htmlText(request.getHtmlText())
                .build();
        return createNewDoubt(sanitized);
    }

    /**
     * GENERAL queries (the "?" dialog + the unauthenticated guest endpoint) carry PLAIN TEXT from a
     * textarea — but it lands in the {@code html_text} column that the admin renders with
     * dangerouslySetInnerHTML. HTML-escape it so a guest can't inject {@code <img onerror=…>}/script
     * that would execute in an admin's session (stored XSS). Newlines become {@code <br>} so the
     * escaped text still reads naturally. SLIDE doubts keep their rich editor HTML untouched.
     */
    private String sanitizeDoubtHtml(String source, String htmlText) {
        if (htmlText == null) return null;
        if (!DoubtsSourceEnum.GENERAL.name().equals(source)) return htmlText;
        return org.springframework.web.util.HtmlUtils.htmlEscape(htmlText).replace("\n", "<br>");
    }

    /** Enabled + learner-selectable types; falls back to the built-in DOUBT when none configured. */
    private List<DoubtManagementSettingDataDto.QueryTypeConfig> learnerSelectableTypes(
            DoubtManagementSettingDataDto setting) {
        List<DoubtManagementSettingDataDto.QueryTypeConfig> configured =
                setting == null || setting.getQueryTypes() == null ? List.of() : setting.getQueryTypes();
        List<DoubtManagementSettingDataDto.QueryTypeConfig> selectable = configured.stream()
                .filter(t -> t != null && StringUtils.hasText(t.getKey()))
                .filter(t -> !Boolean.FALSE.equals(t.getEnabled()))
                .filter(t -> !Boolean.FALSE.equals(t.getLearnerSelectable()))
                .toList();
        if (!selectable.isEmpty()) return selectable;
        DoubtManagementSettingDataDto.QueryTypeConfig doubtDefault =
                new DoubtManagementSettingDataDto.QueryTypeConfig();
        doubtDefault.setKey(DEFAULT_TYPE);
        doubtDefault.setLabel("Doubt");
        return List.of(doubtDefault);
    }

    private String createNewDoubt(DoubtsDto request) {
        boolean isReply = StringUtils.hasText(request.getParentId());

        // Resolve type / institute / batch up-front — needed for per-type routing, the admin
        // fallback, AND the notification dispatch below.
        String type;
        String instituteId;
        String packageSessionId;
        Doubts parentDoubt = null;
        if (isReply) {
            // A reply belongs to its parent's thread — inherit tenancy/type/batch from the parent so
            // the row is consistent regardless of what the client echoed back.
            parentDoubt = doubtService.getDoubtById(request.getParentId()).orElse(null);
            Doubts parent = parentDoubt;
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
                .guestName(request.getGuestName())
                .guestEmail(request.getGuestEmail())
                .htmlText(sanitizeDoubtHtml(request.getSource(), request.getHtmlText()))
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

        // A staff reply on a GUEST doubt (no user account) is emailed to the guest's address —
        // that email is the guest's only way to receive the answer. Service swallows failures.
        if (isReply && parentDoubt != null && instituteId != null) {
            doubtNotificationService.notifyGuestReply(parentDoubt, savedDoubt.getHtmlText(), instituteId);
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

    /**
     * Institute for notification dispatch on an existing doubt. Prefers the stored institute_id
     * (always set for new doubts, and the ONLY source for GENERAL/guest doubts which have no
     * batch) and falls back to the batch lookup for legacy rows that predate the column.
     */
    private String resolveNotificationInstituteId(Doubts doubt) {
        if (doubt == null) return null;
        if (StringUtils.hasText(doubt.getInstituteId())) return doubt.getInstituteId();
        if (!StringUtils.hasText(doubt.getPackageSessionId())) return null;
        return facultyMappingRepository
                .findInstituteIdByPackageSessionId(doubt.getPackageSessionId())
                .orElse(null);
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
                String instituteId = resolveNotificationInstituteId(resolvedDoubtForNotification);
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
                String instituteId = resolveNotificationInstituteId(assignedDoubtForNotification);
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

        // For a scoped viewer (teacher / non-admin staff), their LIVE FSPSSM visibility mirrors the
        // institute's configured default_assignee_source so what a teacher can see matches what the
        // admin set: BATCH_TEACHER/BOTH (and the no-setting default) → they see their whole batch;
        // SUBJECT_TEACHER → only their subject's doubts; NONE/ROLE/SPECIFIC_USERS → assignment-only.
        // Admin/root callers (viewerUserId == null) are unscoped, so the flags are left off.
        boolean scopeBatch = false;
        boolean scopeSubject = false;
        if (viewerUserId != null) {
            DoubtDefaultAssigneeSourceEnum mode = parseAssigneeSource(
                    loadDoubtManagementSettingByInstitute(filter.getInstituteId()));
            scopeBatch = (mode == DoubtDefaultAssigneeSourceEnum.BATCH_TEACHER
                    || mode == DoubtDefaultAssigneeSourceEnum.BOTH);
            scopeSubject = (mode == DoubtDefaultAssigneeSourceEnum.SUBJECT_TEACHER);
        }

        Page<Doubts> paginatedDoubts = doubtService.getAllDoubtsWithFilter(filter.getContentTypes(), filter.getContentPositions(), filter.getSources(),
                filter.getSourceIds(), filter.getTypes(), filter.getStartDate(), filter.getEndDate(), filter.getUserIds(), filter.getStatus(),
                filter.getBatchIds(), filter.getInstituteId(), viewerUserId, scopeBatch, scopeSubject, pageable);

        return ResponseEntity.ok(createDoubtAllResponse(paginatedDoubts));
    }

    /**
     * Loads one doubt by id and maps it to the same {@link DoubtsDto} the inbox list renders (via
     * {@link DoubtService#createDtoFromDoubts}, so child replies / slide metadata are populated too).
     * Backs the doubt-management deep link (?doubtId=X) — the inbox fetches the target doubt this way
     * when it isn't on the loaded page. Returns 404 when the id doesn't resolve to a doubt.
     */
    public ResponseEntity<DoubtsDto> getDoubtById(String doubtId) {
        if (doubtId == null || doubtId.isBlank()) {
            return ResponseEntity.notFound().build();
        }
        Optional<Doubts> doubt = doubtService.getDoubtById(doubtId);
        if (doubt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        List<DoubtsDto> dtos = doubtService.createDtoFromDoubts(List.of(doubt.get()));
        if (dtos.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(dtos.get(0));
    }

    /**
     * Returns {@code null} when the caller should see all doubts (admin / unrestricted), and the
     * user id when the caller's view should be scoped by doubt_assignee / FSPSSM / self-raised.
     *
     * Check order:
     *   1. Null caller → no filter (defensive).
     *   2. Explicit ADMIN role → no filter. This is the authoritative admin signal and is checked
     *      FIRST, before the teaching-role probe, because an admin-portal account may legitimately
     *      hold BOTH an ADMIN role and a TEACHER role (or faculty/FSPSSM batch assignments) — see
     *      {@code VALID_ROLES_FOR_ADMIN_PORTAL}. Without this ordering the TEACHER branch would
     *      scope a real admin down to only their assigned batches.
     *   3. Explicit TEACHER or STUDENT role → scope, ignoring {@code isRootUser}. Handles teacher
     *      accounts that were wrongly flagged root — the TEACHER role wins and they don't leak.
     *   4. {@code isRootUser} (no ADMIN/TEACHER role) → no filter.
     *   5. Has ACTIVE FSPSSM mapping → scope (custom role teachers like FACULTY/INSTRUCTOR).
     *   6. Otherwise → scope by user id.
     *
     * Tradeoff: an account flagged {@code isRootUser=true} with NO formal ADMIN/TEACHER role will
     * pass through step 4 and see everything. That's a data-provisioning concern, not a code bug —
     * fix on the account by adding the right role. Giving real admins back their full doubt
     * visibility is the higher priority.
     */
    private String resolveViewerUserId(CustomUserDetails user) {
        if (user == null) {
            return null;
        }
        if (hasRole(user, "ADMIN")) {
            return null;
        }
        if (hasRole(user, "TEACHER") || hasRole(user, "STUDENT")) {
            return user.getUserId();
        }
        if (user.isRootUser()) {
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
