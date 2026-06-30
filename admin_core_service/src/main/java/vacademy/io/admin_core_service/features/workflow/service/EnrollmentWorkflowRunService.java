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
 * <p>The list is <b>authoritative</b>: it starts from the workflow triggers
 * <i>configured</i> to fire on enrollment for the package session (the same
 * resolution the engine does — package-session-specific triggers take priority
 * over institute-global ones), so a workflow that <i>will</i> run shows up even
 * before it has executed (as a PENDING run whose steps come from the workflow
 * definition). Where an execution already exists it is overlaid, replacing the
 * definition steps with the real per-node statuses/errors from
 * {@code workflow_execution_log}.
 *
 * <p>Executions are tied to a package session through the idempotency key
 * ({@code trigger_<triggerId>_eventType_<eventName>_eventId_<eventId>}, eventId =
 * packageSessionId) — there is no dedicated FK.
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

        // Dedup runs across (workflow, packageSession); an executed run wins over a
        // pending one, and a single execution shared across package sessions is shown once.
        Map<String, EnrollmentWorkflowRunDTO> runsByKey = new LinkedHashMap<>();

        for (String packageSessionId : packageSessionIds) {
            if (!StringUtils.hasText(packageSessionId)) {
                continue;
            }

            // Executions already recorded for this package session, indexed by workflow id.
            String keyPattern = "%eventId_" + packageSessionId + "%";
            Map<String, WorkflowExecution> executionByWorkflowId = new LinkedHashMap<>();
            for (WorkflowExecution execution : workflowExecutionRepository
                    .findEnrollmentRunsByEventIdPattern(instituteId, keyPattern)) {
                String workflowId = execution.getWorkflow() != null ? execution.getWorkflow().getId() : null;
                if (workflowId != null) {
                    executionByWorkflowId.putIfAbsent(workflowId, execution);
                }
            }

            // Resolve the workflows configured to fire on enrollment for this package
            // session — package-session-specific triggers take priority; when none
            // exist the institute-global triggers fire (mirrors WorkflowTriggerService).
            for (String eventName : ENROLLMENT_EVENTS) {
                List<WorkflowTrigger> triggers = workflowTriggerRepository
                        .findSpecificTriggers(instituteId, packageSessionId, eventName, ACTIVE_STATUSES);
                if (triggers.isEmpty()) {
                    triggers = workflowTriggerRepository
                            .findGlobalTriggers(instituteId, eventName, ACTIVE_STATUSES);
                }

                for (WorkflowTrigger trigger : triggers) {
                    Workflow workflow = trigger.getWorkflow();
                    if (workflow == null) {
                        continue;
                    }
                    WorkflowExecution execution = executionByWorkflowId.get(workflow.getId());
                    if (execution != null) {
                        runsByKey.putIfAbsent(execution.getId(), buildExecutedRun(execution));
                    } else {
                        String pendingKey = "pending:" + workflow.getId() + ":" + packageSessionId;
                        runsByKey.putIfAbsent(pendingKey,
                                buildPendingRun(workflow, eventName, packageSessionId));
                    }
                }
            }

            // Defensive: surface executions for this package session whose configured
            // trigger has since been removed/deactivated, so historical runs aren't lost.
            for (WorkflowExecution execution : executionByWorkflowId.values()) {
                runsByKey.putIfAbsent(execution.getId(), buildExecutedRun(execution));
            }
        }

        return new ArrayList<>(runsByKey.values());
    }

    private EnrollmentWorkflowRunDTO buildExecutedRun(WorkflowExecution execution) {
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
                .eventName(parseKeyPart(execution.getIdempotencyKey(), "eventType_", "_eventId_"))
                .eventId(parseKeyPart(execution.getIdempotencyKey(), "eventId_", null))
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
    private EnrollmentWorkflowRunDTO buildPendingRun(Workflow workflow, String eventName, String packageSessionId) {
        List<WorkflowNodeMapping> mappings = workflowNodeMappingRepository
                .findByWorkflowIdOrderByNodeOrderAsc(workflow.getId());
        Map<String, String> nodeNamesById = resolveNodeNames(
                mappings.stream().map(WorkflowNodeMapping::getNodeTemplateId).collect(Collectors.toSet()));
        Map<String, String> nodeTypesById = resolveNodeTypes(
                mappings.stream().map(WorkflowNodeMapping::getNodeTemplateId).collect(Collectors.toSet()));

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
                .eventName(eventName)
                .eventId(packageSessionId)
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

    /**
     * Extracts the substring after {@code prefix} up to {@code endMarker} (or the
     * end of the string when {@code endMarker} is null). Returns null when the
     * prefix is absent.
     */
    private String parseKeyPart(String idempotencyKey, String prefix, String endMarker) {
        if (!StringUtils.hasText(idempotencyKey)) {
            return null;
        }
        int start = idempotencyKey.indexOf(prefix);
        if (start < 0) {
            return null;
        }
        start += prefix.length();
        if (endMarker == null) {
            return idempotencyKey.substring(start);
        }
        int end = idempotencyKey.indexOf(endMarker, start);
        return end < 0 ? idempotencyKey.substring(start) : idempotencyKey.substring(start, end);
    }
}
