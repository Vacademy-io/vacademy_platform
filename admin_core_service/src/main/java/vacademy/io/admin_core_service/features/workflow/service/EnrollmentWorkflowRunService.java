package vacademy.io.admin_core_service.features.workflow.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.workflow.dto.EnrollmentWorkflowRunDTO;
import vacademy.io.admin_core_service.features.workflow.entity.NodeTemplate;
import vacademy.io.admin_core_service.features.workflow.entity.Workflow;
import vacademy.io.admin_core_service.features.workflow.entity.WorkflowExecution;
import vacademy.io.admin_core_service.features.workflow.entity.WorkflowExecutionLog;
import vacademy.io.admin_core_service.features.workflow.entity.WorkflowNodeMapping;
import vacademy.io.admin_core_service.features.workflow.entity.WorkflowTrigger;
import vacademy.io.admin_core_service.features.workflow.enums.WorkflowExecutionStatus;
import vacademy.io.admin_core_service.features.workflow.repository.NodeTemplateRepository;
import vacademy.io.admin_core_service.features.workflow.repository.WorkflowExecutionLogRepository;
import vacademy.io.admin_core_service.features.workflow.repository.WorkflowExecutionRepository;
import vacademy.io.admin_core_service.features.workflow.repository.WorkflowNodeMappingRepository;
import vacademy.io.admin_core_service.features.workflow.repository.WorkflowTriggerRepository;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Resolves the enrollment workflow runs (and their per-node steps) attached to a
 * learner enrollment or a course's package sessions, so the admin dashboard can
 * render them as a tick/cross checklist.
 *
 * <p>The list is <b>authoritative</b>: it starts from the package-session-specific
 * workflow triggers <i>configured</i> to fire on enrollment for the course (those
 * attached via the Course Settings "Workflow Triggers" card, carrying
 * {@code eventId = packageSessionId}), so a workflow that <i>will</i> run shows up
 * even before it has executed (as a PENDING run whose steps come from the workflow
 * definition). Where an execution exists it is overlaid, replacing the definition
 * steps with the real per-node statuses/errors (and the workflow-level error) from
 * the execution + {@code workflow_execution_log}. Institute-global triggers
 * ({@code eventId} null) are intentionally excluded — a global execution can't be
 * tied to a specific package session.
 *
 * <p>Executions are tied to a package session through the execution's
 * {@code workflow_trigger_id} → the trigger's {@code eventId} (= packageSessionId
 * for course-attached triggers). This is reliable regardless of idempotency
 * strategy — the idempotency key is a random UUID under the default strategy and
 * does NOT encode the package session, so it can't be used for the link.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EnrollmentWorkflowRunService {

    private final WorkflowExecutionRepository workflowExecutionRepository;
    private final WorkflowExecutionLogRepository workflowExecutionLogRepository;
    private final NodeTemplateRepository nodeTemplateRepository;
    private final WorkflowTriggerRepository workflowTriggerRepository;
    private final WorkflowNodeMappingRepository workflowNodeMappingRepository;

    /** Events that fire when a learner is enrolled (see StudentRegistrationManager). */
    private static final List<String> ENROLLMENT_EVENTS = List.of("LEARNER_BATCH_ENROLLMENT");
    private static final List<String> ACTIVE_STATUSES = List.of("ACTIVE");

    /**
     * @param instituteId       institute that owns the workflow
     * @param packageSessionIds package sessions to look up runs for (a learner's
     *                          enrollments, or all sessions of a course)
     */
    @Transactional(readOnly = true)
    public List<EnrollmentWorkflowRunDTO> getRuns(String instituteId, List<String> packageSessionIds) {
        if (!StringUtils.hasText(instituteId) || packageSessionIds == null || packageSessionIds.isEmpty()) {
            return List.of();
        }

        // Resolve the enrollment triggers configured for each package session, then
        // overlay each trigger's latest execution. Dedup so a global trigger shared
        // across package sessions (or an execution) is shown once.
        Map<String, EnrollmentWorkflowRunDTO> runsByKey = new LinkedHashMap<>();
        // trigger id -> (trigger, the package session it was resolved for)
        Map<String, WorkflowTrigger> triggersById = new LinkedHashMap<>();
        Map<String, String> packageSessionByTriggerId = new LinkedHashMap<>();

        for (String packageSessionId : packageSessionIds) {
            if (!StringUtils.hasText(packageSessionId)) {
                continue;
            }
            for (String eventName : ENROLLMENT_EVENTS) {
                // Only package-session-specific (course-attached) triggers — the ones
                // configured via the Course Settings "Workflow Triggers" card, which
                // carry eventId = packageSessionId and so tie reliably to this course.
                // Institute-global triggers (eventId null) are intentionally NOT
                // resolved: a global execution can't be scoped to one package session.
                List<WorkflowTrigger> triggers = workflowTriggerRepository
                        .findSpecificTriggers(instituteId, packageSessionId, eventName, ACTIVE_STATUSES);
                for (WorkflowTrigger trigger : triggers) {
                    if (trigger.getWorkflow() == null) {
                        continue;
                    }
                    triggersById.putIfAbsent(trigger.getId(), trigger);
                    packageSessionByTriggerId.putIfAbsent(trigger.getId(), packageSessionId);
                }
            }
        }

        if (triggersById.isEmpty()) {
            return List.of();
        }

        // Latest execution per trigger.
        Map<String, WorkflowExecution> latestExecutionByTriggerId = new LinkedHashMap<>();
        for (WorkflowExecution execution : workflowExecutionRepository
                .findByWorkflowTriggerIdInOrderByStartedAtDesc(new ArrayList<>(triggersById.keySet()))) {
            String triggerId = execution.getWorkflowTrigger() != null
                    ? execution.getWorkflowTrigger().getId()
                    : null;
            if (triggerId != null) {
                latestExecutionByTriggerId.putIfAbsent(triggerId, execution); // query is desc → first = latest
            }
        }

        for (WorkflowTrigger trigger : triggersById.values()) {
            WorkflowExecution execution = latestExecutionByTriggerId.get(trigger.getId());
            if (execution != null) {
                runsByKey.putIfAbsent(execution.getId(), buildExecutedRun(execution, trigger));
            } else {
                runsByKey.putIfAbsent("pending:" + trigger.getId(),
                        buildPendingRun(trigger, packageSessionByTriggerId.get(trigger.getId())));
            }
        }

        return new ArrayList<>(runsByKey.values());
    }

    private EnrollmentWorkflowRunDTO buildExecutedRun(WorkflowExecution execution, WorkflowTrigger trigger) {
        List<WorkflowExecutionLog> logs = workflowExecutionLogRepository
                .findByWorkflowExecutionIdOrderByCreatedAtAsc(execution.getId());
        Map<String, String> nodeNamesById = resolveNodeNames(
                logs.stream().map(WorkflowExecutionLog::getNodeTemplateId).collect(Collectors.toSet()));

        List<EnrollmentWorkflowRunDTO.Step> steps = logs.stream()
                .map(logEntity -> EnrollmentWorkflowRunDTO.Step.builder()
                        .logId(logEntity.getId())
                        .nodeTemplateId(logEntity.getNodeTemplateId())
                        .nodeName(resolveName(nodeNamesById, logEntity.getNodeTemplateId(),
                                logEntity.getNodeType()))
                        .nodeType(logEntity.getNodeType())
                        .status(logEntity.getStatus())
                        .errorMessage(logEntity.getErrorMessage())
                        .errorType(logEntity.getErrorType())
                        .startedAt(logEntity.getStartedAt())
                        .completedAt(logEntity.getCompletedAt())
                        .executionTimeMs(logEntity.getExecutionTimeMs())
                        .build())
                .collect(Collectors.toList());

        return EnrollmentWorkflowRunDTO.builder()
                .executionId(execution.getId())
                .workflowId(execution.getWorkflow() != null ? execution.getWorkflow().getId() : null)
                .workflowName(execution.getWorkflow() != null ? execution.getWorkflow().getName() : null)
                .eventName(trigger.getTriggerEventName())
                .eventId(trigger.getEventId())
                .status(execution.getStatus())
                .errorMessage(execution.getErrorMessage())
                .startedAt(execution.getStartedAt())
                .completedAt(execution.getCompletedAt())
                .steps(steps)
                .build();
    }

    /**
     * A workflow configured to run on enrollment but not yet executed for this
     * package session. Steps come from the workflow definition (node mappings →
     * node templates) with a null status (rendered as "pending" / waiting).
     */
    private EnrollmentWorkflowRunDTO buildPendingRun(WorkflowTrigger trigger, String packageSessionId) {
        Workflow workflow = trigger.getWorkflow();
        List<WorkflowNodeMapping> mappings = workflowNodeMappingRepository
                .findByWorkflowIdOrderByNodeOrderAsc(workflow.getId());
        Set<String> nodeTemplateIds = mappings.stream()
                .map(WorkflowNodeMapping::getNodeTemplateId).collect(Collectors.toSet());
        Map<String, String> nodeNamesById = resolveNodeNames(nodeTemplateIds);
        Map<String, String> nodeTypesById = resolveNodeTypes(nodeTemplateIds);

        List<EnrollmentWorkflowRunDTO.Step> steps = mappings.stream()
                .map(mapping -> EnrollmentWorkflowRunDTO.Step.builder()
                        .nodeTemplateId(mapping.getNodeTemplateId())
                        .nodeName(resolveName(nodeNamesById, mapping.getNodeTemplateId(),
                                nodeTypesById.get(mapping.getNodeTemplateId())))
                        .nodeType(nodeTypesById.get(mapping.getNodeTemplateId()))
                        .status(null) // null => not yet run (pending)
                        .build())
                .collect(Collectors.toList());

        return EnrollmentWorkflowRunDTO.builder()
                .workflowId(workflow.getId())
                .workflowName(workflow.getName())
                .eventName(trigger.getTriggerEventName())
                .eventId(trigger.getEventId() != null ? trigger.getEventId() : packageSessionId)
                .status(WorkflowExecutionStatus.PENDING)
                .steps(steps)
                .build();
    }

    private Map<String, String> resolveNodeNames(Set<String> nodeTemplateIds) {
        if (nodeTemplateIds == null || nodeTemplateIds.isEmpty()) {
            return Map.of();
        }
        Map<String, String> namesById = new LinkedHashMap<>();
        for (NodeTemplate template : nodeTemplateRepository.findAllById(nodeTemplateIds)) {
            namesById.put(template.getId(), template.getNodeName());
        }
        return namesById;
    }

    private Map<String, String> resolveNodeTypes(Set<String> nodeTemplateIds) {
        if (nodeTemplateIds == null || nodeTemplateIds.isEmpty()) {
            return Map.of();
        }
        Map<String, String> typesById = new LinkedHashMap<>();
        for (NodeTemplate template : nodeTemplateRepository.findAllById(nodeTemplateIds)) {
            typesById.put(template.getId(), template.getNodeType());
        }
        return typesById;
    }

    private String resolveName(Map<String, String> nodeNamesById, String nodeTemplateId, String fallback) {
        String name = nodeNamesById.get(nodeTemplateId);
        return StringUtils.hasText(name) ? name : fallback;
    }
}
