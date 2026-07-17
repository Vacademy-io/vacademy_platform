package vacademy.io.admin_core_service.features.onboarding.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.common.enums.StatusEnum;
import vacademy.io.admin_core_service.features.onboarding.dto.OnboardingStepTriggerDTO;
import vacademy.io.admin_core_service.features.workflow.entity.Workflow;
import vacademy.io.admin_core_service.features.workflow.entity.WorkflowTrigger;
import vacademy.io.admin_core_service.features.workflow.enums.EventAppliedType;
import vacademy.io.admin_core_service.features.workflow.enums.WorkflowTriggerEvent;
import vacademy.io.admin_core_service.features.workflow.repository.WorkflowRepository;
import vacademy.io.admin_core_service.features.workflow.repository.WorkflowTriggerRepository;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Manages the workflow triggers attached to a single onboarding step (eventId = step.id).
 * Mirrors {@code LmsSettingService.getPackageWorkflowTriggers}/{@code savePackageWorkflowTriggers}
 * but scoped to one eventId instead of a course's package sessions, and restricted to the
 * ONBOARDING_STEP_* trigger events.
 */
@Service
@RequiredArgsConstructor
public class OnboardingStepWorkflowTriggerService {

    private static final Set<String> ALLOWED_EVENTS = Set.of(
            WorkflowTriggerEvent.ONBOARDING_STEP_ENTERED.name(),
            WorkflowTriggerEvent.ONBOARDING_STEP_COMPLETED.name(),
            WorkflowTriggerEvent.ONBOARDING_STEP_SKIPPED.name()
    );

    private final WorkflowTriggerRepository workflowTriggerRepository;
    private final WorkflowRepository workflowRepository;

    public List<OnboardingStepTriggerDTO> getStepWorkflowTriggers(String stepId) {
        List<OnboardingStepTriggerDTO> out = new ArrayList<>();
        LinkedHashSet<String> seen = new LinkedHashSet<>();
        for (WorkflowTrigger t : workflowTriggerRepository.findActiveByEventIdIn(List.of(stepId))) {
            if (t.getWorkflow() == null || t.getWorkflow().getId() == null) continue;
            if (!ALLOWED_EVENTS.contains(t.getTriggerEventName())) continue;
            String key = t.getTriggerEventName() + "|" + t.getWorkflow().getId();
            if (!seen.add(key)) continue;
            out.add(OnboardingStepTriggerDTO.builder()
                    .triggerEventName(t.getTriggerEventName())
                    .workflowId(t.getWorkflow().getId())
                    .workflowName(t.getWorkflow().getName())
                    .build());
        }
        return out;
    }

    /**
     * Make this step's attached workflow triggers exactly match {@code desired} (authoritative):
     * create workflow_trigger rows for each (event, workflow) pair not already present, and delete
     * existing rows on this step whose (event, workflow) pair isn't in the desired set.
     */
    @Transactional
    public Map<String, Object> saveStepWorkflowTriggers(String instituteId, String stepId,
                                                          List<OnboardingStepTriggerDTO> desired) {
        Map<String, Object> res = new HashMap<>();
        int created = 0;
        int removed = 0;

        LinkedHashSet<String> target = new LinkedHashSet<>();
        List<OnboardingStepTriggerDTO> valid = new ArrayList<>();
        if (desired != null) {
            for (OnboardingStepTriggerDTO d : desired) {
                if (d == null || d.getTriggerEventName() == null || d.getWorkflowId() == null
                        || !ALLOWED_EVENTS.contains(d.getTriggerEventName())) {
                    continue;
                }
                if (target.add(d.getTriggerEventName().trim() + "|" + d.getWorkflowId().trim())) {
                    valid.add(d);
                }
            }
        }

        List<WorkflowTrigger> existing = workflowTriggerRepository.findActiveByEventIdIn(List.of(stepId)).stream()
                .filter(t -> ALLOWED_EVENTS.contains(t.getTriggerEventName()))
                .collect(Collectors.toList());
        List<WorkflowTrigger> toRemove = new ArrayList<>();
        for (WorkflowTrigger t : existing) {
            String wfId = t.getWorkflow() != null ? t.getWorkflow().getId() : null;
            if (wfId == null || !target.contains(t.getTriggerEventName() + "|" + wfId)) {
                toRemove.add(t);
            }
        }
        workflowTriggerRepository.deleteAll(toRemove);
        removed = toRemove.size();

        for (OnboardingStepTriggerDTO d : valid) {
            String ev = d.getTriggerEventName().trim();
            if (workflowTriggerRepository.existsByWorkflow_IdAndEventIdAndTriggerEventName(
                    d.getWorkflowId().trim(), stepId, ev)) {
                continue;
            }
            Workflow wf = workflowRepository.findById(d.getWorkflowId().trim()).orElse(null);
            if (wf == null) continue;
            workflowTriggerRepository.save(WorkflowTrigger.builder()
                    .triggerEventName(ev)
                    .instituteId(instituteId)
                    .status(StatusEnum.ACTIVE.name())
                    .workflow(wf)
                    .eventId(stepId)
                    .eventAppliedType(EventAppliedType.ONBOARDING_STEP.name())
                    .build());
            created++;
        }

        res.put("created", created);
        res.put("removed", removed);
        return res;
    }
}
