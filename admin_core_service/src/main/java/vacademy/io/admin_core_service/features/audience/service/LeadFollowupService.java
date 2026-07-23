package vacademy.io.admin_core_service.features.audience.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.audience.dto.CloseLeadFollowupRequest;
import vacademy.io.admin_core_service.features.audience.dto.CreateLeadFollowupRequest;
import vacademy.io.admin_core_service.features.audience.dto.LeadFollowupDto;
import vacademy.io.admin_core_service.features.audience.dto.UpdateLeadFollowupRequest;
import vacademy.io.admin_core_service.features.audience.entity.Audience;
import vacademy.io.admin_core_service.features.audience.entity.AudienceResponse;
import vacademy.io.admin_core_service.features.audience.entity.LeadFollowup;
import vacademy.io.admin_core_service.features.audience.enums.LeadFollowupStatus;
import vacademy.io.admin_core_service.features.audience.repository.AudienceRepository;
import vacademy.io.admin_core_service.features.audience.repository.AudienceResponseRepository;
import vacademy.io.admin_core_service.features.audience.repository.LeadFollowupRepository;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.timeline.service.TimelineEventService;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class LeadFollowupService {

    private final LeadFollowupRepository leadFollowupRepository;
    private final TimelineEventService timelineEventService;
    private final AuthService authService;
    private final AudienceResponseRepository audienceResponseRepository;
    private final AudienceRepository audienceRepository;
    private final vacademy.io.admin_core_service.features.counsellor_workbench.service.CounsellorScopeService counsellorScopeService;
    private final vacademy.io.admin_core_service.features.counsellor_workbench.repository.WorkbenchLeadRepository workbenchLeadRepository;

    @Transactional
    public LeadFollowupDto create(CreateLeadFollowupRequest request, CustomUserDetails user) {
        String instituteId = resolveInstituteId(request.getAudienceResponseId(), request.getInstituteId());

        LeadFollowup followup = LeadFollowup.builder()
                .audienceResponseId(request.getAudienceResponseId())
                .instituteId(instituteId)
                .createdBy(user.getUserId())
                .scheduleTime(request.getScheduleTime())
                .content(request.getContent())
                .build();

        LeadFollowup saved = leadFollowupRepository.save(followup);

        String studentUserId = audienceResponseRepository.findById(request.getAudienceResponseId())
                .map(AudienceResponse::getUserId)
                .orElse(null);

        timelineEventService.logEvent(
                "LEAD", request.getAudienceResponseId(),
                "FOLLOWUP_SCHEDULED",
                "ADMIN", user.getUserId(), user.getUsername(),
                "Follow-up scheduled",
                request.getContent(),
                Map.of("followupId", saved.getId(), "scheduleTime",
                        request.getScheduleTime() != null ? request.getScheduleTime().getTime() : null),
                studentUserId
        );

        return LeadFollowupDto.from(saved);
    }

    /**
     * All follow-ups for one lead. RBAC: a hierarchy-scoped caller (COUNSELLOR
     * role) may only read them when the lead's current assignee sits inside
     * their scope (unassigned leads stay visible — same rule the leads list
     * applies to the shared unassigned pool).
     */
    @Transactional(readOnly = true)
    public List<LeadFollowupDto> listForLead(String audienceResponseId, CustomUserDetails user) {
        List<LeadFollowup> rows = leadFollowupRepository
                .findByAudienceResponseIdOrderByScheduleTimeAsc(audienceResponseId);
        if (!rows.isEmpty() && user != null && user.getUserId() != null) {
            String instituteId = resolveInstituteId(audienceResponseId, rows.get(0).getInstituteId());
            if (counsellorScopeService.isScopedCaller(instituteId, user)) {
                String leadUserId = audienceResponseRepository.findById(audienceResponseId)
                        .map(AudienceResponse::getUserId)
                        .orElse(null);
                String assignee = null;
                if (leadUserId != null) {
                    try {
                        assignee = workbenchLeadRepository.currentAssigneeForLead(instituteId, leadUserId);
                    } catch (org.springframework.dao.EmptyResultDataAccessException e) {
                        // No user_lead_profile row yet — treat as unassigned.
                    }
                }
                if (assignee != null && !counsellorScopeService
                        .scopedCounsellorUserIds(instituteId, user.getUserId()).contains(assignee)) {
                    throw new VacademyException("You don't have access to this lead's follow-ups");
                }
            }
        }
        return rows.stream()
                .map(LeadFollowupDto::from)
                .collect(Collectors.toList());
    }

    /**
     * Pending follow-ups the caller may work on.
     *
     * <p>Legacy shape (no instituteId): the caller's own follow-ups only —
     * kept so old frontends behave exactly as before.
     *
     * <p>With instituteId: hierarchy-scoped callers (COUNSELLOR role) get
     * their own + their counsellor-role reports' pending follow-ups (the
     * manager view); pure admins get the whole institute. An explicit
     * {@code counsellorUserId} narrows to that one user — validated against
     * the caller's scope when the caller is scoped.
     */
    @Transactional(readOnly = true)
    public List<LeadFollowupDto> myPending(CustomUserDetails user, String instituteId, String counsellorUserId) {
        if (instituteId == null || instituteId.isBlank()) {
            return withLeadInfo(leadFollowupRepository
                    .findByCreatedByAndIsClosedFalseOrderByScheduleTimeAsc(user.getUserId())
                    .stream()
                    .map(LeadFollowupDto::from)
                    .collect(Collectors.toList()));
        }

        boolean scoped = counsellorScopeService.isScopedCaller(instituteId, user);
        List<LeadFollowup> rows;
        if (counsellorUserId != null && !counsellorUserId.isBlank()) {
            if (scoped && !user.getUserId().equals(counsellorUserId)
                    && !counsellorScopeService.scopedCounsellorUserIds(instituteId, user.getUserId())
                            .contains(counsellorUserId)) {
                throw new VacademyException("You don't have access to this counsellor's follow-ups");
            }
            rows = leadFollowupRepository
                    .findByInstituteIdAndCreatedByInAndIsClosedFalseOrderByScheduleTimeAsc(
                            instituteId, List.of(counsellorUserId));
        } else if (scoped) {
            rows = leadFollowupRepository
                    .findByInstituteIdAndCreatedByInAndIsClosedFalseOrderByScheduleTimeAsc(
                            instituteId,
                            counsellorScopeService.scopedCounsellorUserIds(instituteId, user.getUserId()));
        } else {
            rows = leadFollowupRepository
                    .findByInstituteIdAndIsClosedFalseOrderByScheduleTimeAsc(instituteId);
        }
        return withLeadInfo(rows.stream()
                .map(LeadFollowupDto::from)
                .collect(Collectors.toList()));
    }

    /**
     * Batch-hydrate lead display fields (name/mobile/userId) from
     * audience_response — the reminder popup and pending lists need a name,
     * not just an id. User-linked leads keep parent_name null and carry their
     * identity on the auth user instead, so a second auth-service batch fills
     * the gaps. Failures leave the fields null rather than failing the list.
     */
    private List<LeadFollowupDto> withLeadInfo(List<LeadFollowupDto> dtos) {
        List<String> responseIds = dtos.stream()
                .map(LeadFollowupDto::getAudienceResponseId)
                .filter(id -> id != null && !id.isBlank())
                .distinct()
                .collect(Collectors.toList());
        if (responseIds.isEmpty()) return dtos;
        Map<String, AudienceResponse> byId = audienceResponseRepository.findAllById(responseIds)
                .stream()
                .collect(Collectors.toMap(AudienceResponse::getId, r -> r, (a, b) -> a));
        dtos.forEach(d -> {
            AudienceResponse ar = byId.get(d.getAudienceResponseId());
            if (ar != null) {
                d.setLeadName(ar.getParentName());
                d.setLeadMobile(ar.getParentMobile());
                d.setLeadUserId(ar.getUserId());
            }
        });

        List<String> missingUserIds = dtos.stream()
                .filter(d -> isBlank(d.getLeadName()) || isBlank(d.getLeadMobile()))
                .map(LeadFollowupDto::getLeadUserId)
                .filter(id -> id != null && !id.isBlank())
                .distinct()
                .collect(Collectors.toList());
        if (!missingUserIds.isEmpty()) {
            try {
                Map<String, UserDTO> users = authService
                        .getUsersFromAuthServiceByUserIds(new ArrayList<>(missingUserIds))
                        .stream()
                        .filter(u -> u != null && u.getId() != null)
                        .collect(Collectors.toMap(UserDTO::getId, u -> u, (a, b) -> a));
                dtos.forEach(d -> {
                    UserDTO u = users.get(d.getLeadUserId());
                    if (u != null) {
                        if (isBlank(d.getLeadName())) d.setLeadName(u.getFullName());
                        if (isBlank(d.getLeadMobile())) d.setLeadMobile(u.getMobileNumber());
                    }
                });
            } catch (Exception e) {
                log.warn("[LeadFollowup] auth user hydration failed: {}", e.getMessage());
            }
        }
        return dtos;
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    @Transactional
    public LeadFollowupDto update(String id, UpdateLeadFollowupRequest request) {
        LeadFollowup followup = findOrThrow(id);
        if (Boolean.TRUE.equals(followup.getIsClosed())) {
            throw new VacademyException("Cannot update a closed follow-up");
        }
        if (request.getScheduleTime() != null) followup.setScheduleTime(request.getScheduleTime());
        if (request.getContent() != null) followup.setContent(request.getContent());
        return LeadFollowupDto.from(leadFollowupRepository.save(followup));
    }

    @Transactional
    public LeadFollowupDto close(String id, CloseLeadFollowupRequest request, CustomUserDetails user) {
        LeadFollowup followup = findOrThrow(id);
        if (Boolean.TRUE.equals(followup.getIsClosed())) {
            throw new VacademyException("Follow-up is already closed");
        }

        String status = LeadFollowupStatus.COMPLETED.name();

        Timestamp now = new Timestamp(System.currentTimeMillis());
        followup.setStatus(status);
        followup.setIsClosed(true);
        followup.setCloserReason(request.getCloserReason());
        followup.setClosedBy(user.getUserId());
        followup.setClosedAt(now);

        LeadFollowup saved = leadFollowupRepository.save(followup);

        String studentUserId = audienceResponseRepository.findById(followup.getAudienceResponseId())
                .map(AudienceResponse::getUserId)
                .orElse(null);

        timelineEventService.logEvent(
                "LEAD", followup.getAudienceResponseId(),
                "FOLLOWUP_CLOSED",
                "ADMIN", user.getUserId(), user.getUsername(),
                "Follow-up " + status.toLowerCase(),
                request.getCloserReason(),
                Map.of("followupId", id, "status", status),
                studentUserId
        );

        return LeadFollowupDto.from(saved);
    }

    private LeadFollowup findOrThrow(String id) {
        return leadFollowupRepository.findById(id)
                .orElseThrow(() -> new VacademyException("Follow-up not found: " + id));
    }

    /** Derive instituteId from the audience response chain when the caller didn't supply it. */
    private String resolveInstituteId(String audienceResponseId, String providedInstituteId) {
        if (providedInstituteId != null && !providedInstituteId.isBlank()) {
            return providedInstituteId;
        }
        return audienceResponseRepository.findById(audienceResponseId)
                .map(AudienceResponse::getAudienceId)
                .flatMap(audienceRepository::findById)
                .map(Audience::getInstituteId)
                .orElseThrow(() -> new VacademyException("Cannot resolve institute for response: " + audienceResponseId));
    }
}
