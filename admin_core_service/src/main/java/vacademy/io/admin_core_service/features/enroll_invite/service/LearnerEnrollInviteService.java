package vacademy.io.admin_core_service.features.enroll_invite.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.common.enums.StatusEnum;
import vacademy.io.admin_core_service.features.enroll_invite.dto.EnrollInviteDTO;
import vacademy.io.admin_core_service.features.enroll_invite.entity.EnrollInvite;
import vacademy.io.admin_core_service.features.enroll_invite.repository.EnrollInviteRepository;
import vacademy.io.admin_core_service.features.workflow.enums.WorkflowTriggerEvent;
import vacademy.io.admin_core_service.features.workflow.service.WorkflowTriggerService;
import vacademy.io.common.exceptions.VacademyException;

import java.util.*;

@Service
@Slf4j
public class LearnerEnrollInviteService {

    @Autowired
    private EnrollInviteRepository enrollInviteRepository;

    @Autowired
    private EnrollInviteService enrollInviteService;

    @Autowired
    private WorkflowTriggerService workflowTriggerService;

    /**
     * Fetches and validates an active enroll invite by instituteId and inviteCode.
     *
     * @param instituteId The ID of the institute.
     * @param inviteCode  The invite code used by learner.
     * @return Fully populated EnrollInviteDTO
     * @throws VacademyException if invite not found, not started yet, or expired.
     */
    public EnrollInviteDTO getEnrollInvite(String instituteId, String inviteCode) {
        if (Objects.isNull(instituteId) || Objects.isNull(inviteCode)) {
            throw new VacademyException("Institute ID and Invite Code are required.");
        }

        EnrollInvite enrollInvite = enrollInviteRepository
                .findValidEnrollInvite(List.of(StatusEnum.ACTIVE.name()), instituteId, inviteCode)
                .orElseThrow(() -> new VacademyException("Enroll invite not found."));

        Date now = new Date();

        if (enrollInvite.getStartDate() != null && enrollInvite.getStartDate().after(now)) {
            throw new VacademyException("This enroll invite has not started accepting enrollments yet.");
        }

        if (enrollInvite.getEndDate() != null && enrollInvite.getEndDate().before(now)) {
            throw new VacademyException("This enroll invite has expired.");
        }

        EnrollInviteDTO result = enrollInviteService.buildFullEnrollInviteDTO(enrollInvite, instituteId);

        // Trigger INVITE_FORM_FILL workflow
        try {
            Map<String, Object> contextData = new HashMap<>();
            contextData.put("invite", enrollInvite);
            contextData.put("instituteId", instituteId);
            contextData.put("inviteCode", inviteCode);
            workflowTriggerService.handleTriggerEvents(
                    WorkflowTriggerEvent.INVITE_FORM_FILL.name(),
                    enrollInvite.getId(),
                    instituteId,
                    contextData);
        } catch (Exception e) {
            log.warn("Failed to trigger INVITE_FORM_FILL workflow", e);
        }

        return result;
    }
}
