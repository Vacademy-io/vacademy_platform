package vacademy.io.admin_core_service.features.counsellor_workbench.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.audience.entity.UserLeadProfile;
import vacademy.io.admin_core_service.features.audience.repository.UserLeadProfileRepository;
import vacademy.io.admin_core_service.features.audience.service.UserLeadProfileService;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.counsellor_workbench.dto.ReassignRequest;
import vacademy.io.admin_core_service.features.counsellor_workbench.dto.ReassignResultDTO;
import vacademy.io.admin_core_service.features.timeline.enums.LeadJourneyActionType;
import vacademy.io.admin_core_service.features.timeline.service.TimelineEventService;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Bulk re-routing of one counsellor's open leads.
 *
 * Three modes (the workbench dialog exposes all three):
 *   SINGLE       — every open lead from fromUserId moves to targetUserId.
 *   ROUND_ROBIN  — leads are spread across the active counsellors in the
 *                  team subtree (excluding fromUserId), iterating in a
 *                  cycle so the work is balanced.
 *   MANUAL       — caller provides explicit per-lead targets (the preview
 *                  workflow: server proposes, UI lets admin override per row,
 *                  then submits assignments back as MANUAL).
 *
 * The preview endpoint passes dryRun=true to {@link #planReassign} and skips
 * the persistence call. The same code path computes both the proposal
 * (preview) and the persisted result (commit) — so what the admin sees on
 * screen is exactly what gets applied.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CounsellorReassignService {

    private final UserLeadProfileRepository profileRepo;
    private final UserLeadProfileService profileService;
    private final TimelineEventService timelineEventService;
    private final CounsellorScopeService scopeService;
    private final AuthService authService;

    @Transactional
    public ReassignResultDTO reassign(ReassignRequest req, CustomUserDetails actor) {
        return planAndApply(req, actor, false);
    }

    @Transactional(readOnly = true)
    public ReassignResultDTO preview(ReassignRequest req, CustomUserDetails actor) {
        return planAndApply(req, actor, true);
    }

    // ────────────────────────────────────────────────────────────────

    private ReassignResultDTO planAndApply(ReassignRequest req, CustomUserDetails actor, boolean dryRun) {
        require(req.getInstituteId(), "institute_id is required");
        require(req.getFromUserId(), "from_user_id is required");
        require(req.getMode(), "mode is required");

        List<UserLeadProfile> openLeads = profileRepo
                .findByInstituteIdAndConversionStatus(req.getInstituteId(), "LEAD",
                        org.springframework.data.domain.Pageable.unpaged()).getContent().stream()
                .filter(p -> req.getFromUserId().equals(p.getAssignedCounselorId()))
                .collect(Collectors.toList());

        if (openLeads.isEmpty()) {
            return ReassignResultDTO.builder()
                    .dryRun(dryRun).totalLeads(0).assignments(Collections.emptyList()).build();
        }

        List<Plan> plan = switch (req.getMode().toUpperCase(Locale.ROOT)) {
            case "SINGLE" -> planSingle(openLeads, req);
            case "ROUND_ROBIN" -> planRoundRobin(openLeads, req);
            case "MANUAL" -> planManual(openLeads, req);
            default -> throw new VacademyException("Unknown reassign mode: " + req.getMode());
        };

        // Resolve display names for everyone we're routing to, in one batch.
        Set<String> targetIds = plan.stream().map(Plan::toUserId).collect(Collectors.toSet());
        Map<String, String> nameById = resolveNames(targetIds);

        List<ReassignResultDTO.AssignmentResult> results = new ArrayList<>(plan.size());
        for (Plan p : plan) {
            String toName = nameById.get(p.toUserId());
            results.add(ReassignResultDTO.AssignmentResult.builder()
                    .leadId(p.leadProfile.getId())
                    .leadName(null)  // resolved client-side via existing lead lookups; avoids a join here
                    .fromUserId(req.getFromUserId())
                    .toUserId(p.toUserId())
                    .toUserName(toName)
                    .build());

            if (!dryRun) {
                profileService.assignCounselor(
                        p.leadProfile.getUserId(), req.getInstituteId(),
                        p.toUserId(), toName);
                // Timeline event mirrors the manual reassign flow so the
                // journey UI reads identically whether the route was SINGLE,
                // ROUND_ROBIN, or MANUAL.
                String actorId = actor != null ? actor.getUserId() : null;
                String actorName = actor != null ? actor.getUsername() : null;
                try {
                    timelineEventService.logJourneyEvent(
                            "USER_LEAD_PROFILE", p.leadProfile.getUserId(),
                            LeadJourneyActionType.COUNSELOR_ASSIGNED,
                            "ADMIN", actorId, actorName,
                            "Counselor reassigned",
                            "Reassigned via workbench (mode=" + req.getMode() + ")",
                            Map.of(
                                    "counselor_id", p.toUserId(),
                                    "counselor_name", toName != null ? toName : "",
                                    "reassigned_from", req.getFromUserId(),
                                    "trigger", "WORKBENCH_REASSIGN",
                                    "mode", req.getMode(),
                                    "assigned_by", actorName != null ? actorName : ""),
                            p.leadProfile.getUserId());
                } catch (Exception e) {
                    log.warn("Timeline log failed for lead={} ({}): {}",
                            p.leadProfile.getId(), req.getMode(), e.getMessage());
                }
            }
        }

        return ReassignResultDTO.builder()
                .dryRun(dryRun)
                .totalLeads(results.size())
                .assignments(results)
                .build();
    }

    private List<Plan> planSingle(List<UserLeadProfile> leads, ReassignRequest req) {
        require(req.getTargetUserId(), "target_user_id is required for SINGLE mode");
        if (req.getTargetUserId().equals(req.getFromUserId())) {
            throw new VacademyException("Target counsellor must differ from the source");
        }
        return leads.stream()
                .map(l -> new Plan(l, req.getTargetUserId()))
                .collect(Collectors.toList());
    }

    private List<Plan> planRoundRobin(List<UserLeadProfile> leads, ReassignRequest req) {
        // Active counsellors within the same team subtree as fromUserId,
        // excluding fromUserId itself. Resolved via the workbench scope so
        // the same team rules apply to RR distribution as to the lead list.
        List<String> teamIds = scopeService.allTeamIdsUnderLeadsRoot(req.getInstituteId());
        List<String> candidates = scopeService.usersInTeams(teamIds).stream()
                .filter(uid -> !uid.equals(req.getFromUserId()))
                .sorted()
                .collect(Collectors.toList());
        if (candidates.isEmpty()) {
            throw new VacademyException("No active counsellors available for round-robin reassignment");
        }
        List<Plan> out = new ArrayList<>(leads.size());
        int idx = 0;
        for (UserLeadProfile l : leads) {
            out.add(new Plan(l, candidates.get(idx % candidates.size())));
            idx++;
        }
        return out;
    }

    private List<Plan> planManual(List<UserLeadProfile> leads, ReassignRequest req) {
        if (req.getAssignments() == null || req.getAssignments().isEmpty()) {
            throw new VacademyException("assignments list is required for MANUAL mode");
        }
        Map<String, String> overrideByLeadId = new HashMap<>();
        for (ReassignRequest.Assignment a : req.getAssignments()) {
            if (a.getLeadId() == null || a.getToUserId() == null) {
                throw new VacademyException("Each assignment must have lead_id and to_user_id");
            }
            overrideByLeadId.put(a.getLeadId(), a.getToUserId());
        }
        Set<String> allowed = new HashSet<>(
                scopeService.usersInTeams(scopeService.allTeamIdsUnderLeadsRoot(req.getInstituteId())));
        List<Plan> out = new ArrayList<>(leads.size());
        for (UserLeadProfile l : leads) {
            String to = overrideByLeadId.get(l.getId());
            if (to == null) {
                throw new VacademyException("Missing target for lead " + l.getId());
            }
            if (!allowed.contains(to)) {
                throw new VacademyException("Target user " + to + " is outside the leads team subtree");
            }
            out.add(new Plan(l, to));
        }
        return out;
    }

    private Map<String, String> resolveNames(Collection<String> userIds) {
        if (userIds.isEmpty()) return Collections.emptyMap();
        Map<String, String> out = new HashMap<>();
        try {
            List<UserDTO> users = authService.getUsersFromAuthServiceByUserIds(new ArrayList<>(userIds));
            for (UserDTO u : users) {
                if (u != null && u.getId() != null) out.put(u.getId(), u.getFullName());
            }
        } catch (Exception e) {
            log.warn("Display name resolution failed: {}", e.getMessage());
        }
        return out;
    }

    private static void require(String s, String msg) {
        if (s == null || s.isBlank()) throw new VacademyException(msg);
    }

    private record Plan(UserLeadProfile leadProfile, String toUserId) {
    }
}
