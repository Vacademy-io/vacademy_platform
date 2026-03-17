package vacademy.io.admin_core_service.features.workflow.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;

import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.common.enums.StatusEnum;
import vacademy.io.admin_core_service.features.workflow.entity.WorkflowTrigger;
import vacademy.io.admin_core_service.features.workflow.repository.WorkflowTriggerRepository;
import vacademy.io.common.logging.SentryLogger;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
@Slf4j
public class WorkflowTriggerService {

    @Autowired
    private WorkflowTriggerRepository workflowTriggerRepository;

    @Autowired
    private WorkflowEngineService workflowEngineService;

    @Autowired
    private IdempotencyService idempotencyService;

    @Autowired
    private vacademy.io.admin_core_service.features.workflow.service.idempotency.IdempotencyStrategyFactory idempotencyStrategyFactory;

    public Map<String, Object> handleTriggerEvents(String eventName, String eventId, String instituteId,
            Map<String, Object> contextData) {
        log.info("---- Workflow Trigger Event START ----");
        log.info("Incoming trigger params: eventName='{}', eventId='{}', instituteId='{}'", eventName, eventId,
                instituteId);
        Map<String, Object> response = new HashMap<>();
        try {
            // Log context data if present
            if (contextData == null || contextData.isEmpty()) {
                log.warn("Context data is EMPTY or NULL");
            } else {
                log.info("Context data received ({} keys): {}", contextData.size(), contextData);
            }

            log.info(
                    "Calling repository: findByInstituteIdAndEventIdAnsEventTypeAndStatusIn(instituteId='{}', eventId='{}', eventType='{}')",
                    instituteId, eventId, eventName);

            List<WorkflowTrigger> triggers = workflowTriggerRepository
                    .findByInstituteIdAndEventIdAnsEventTypeAndStatusIn(
                            instituteId, eventId, eventName, List.of(StatusEnum.ACTIVE.name()));

            log.info("Repository returned {} triggers for event='{}', eventId='{}', instituteId='{}'",
                    triggers.size(), eventName, eventId, instituteId);

            if (triggers.isEmpty()) {
                log.info("No ACTIVE workflow triggers found. Exiting execution.");
                log.info("---- Workflow Trigger Event END ----");
                return response;
            }

            int count = 0;

            for (WorkflowTrigger trigger : triggers) {
                count++;
                log.info("Processing trigger {} of {} | TriggerId='{}', TriggerEventName='{}', WorkflowId='{}'",
                        count, triggers.size(), trigger.getId(), trigger.getTriggerEventName(),
                        trigger.getWorkflow().getId());

                try {
                    // Generate idempotency key based on trigger's configuration
                    String idempotencyKey;
                    try {
                        idempotencyKey = idempotencyStrategyFactory.generateKey(
                                trigger, eventName, eventId, contextData);
                        log.info("Generated idempotency key: {} for trigger: {}", idempotencyKey, trigger.getId());
                    } catch (Exception e) {
                        log.error("Failed to generate idempotency key for trigger: {}", trigger.getId(), e);
                        SentryLogger.SentryEventBuilder.error(e)
                                .withMessage("Failed to generate idempotency key")
                                .withTag("trigger.id", trigger.getId())
                                .withTag("trigger.event", eventName)
                                .withTag("institute.id", instituteId)
                                .send();
                        continue; // Skip this trigger
                    }

                    // Try to mark as processing (will fail if duplicate key exists)
                    vacademy.io.admin_core_service.features.workflow.entity.WorkflowExecution execution;
                    try {
                        execution = idempotencyService.markAsProcessingForTrigger(
                                idempotencyKey,
                                trigger.getWorkflow().getId(),
                                trigger.getId());
                        log.info("Marked workflow execution as PROCESSING (EVENT_DRIVEN): {}", execution.getId());
                    } catch (org.springframework.dao.DataIntegrityViolationException e) {
                        log.warn(
                                "Workflow already executed or in progress (duplicate idempotency key): {} for trigger: {}",
                                idempotencyKey, trigger.getId());
                        continue; // Skip duplicate execution
                    }

                    // Build seed context
                    Map<String, Object> seedContext = new HashMap<>(
                            Optional.ofNullable(contextData).orElse(new HashMap<>()));
                    seedContext.put("triggerEvents", eventName);
                    seedContext.put("triggerId", trigger.getId());
                    seedContext.put("instituteId", instituteId);
                    seedContext.put("executionId", execution.getId());
                    log.info("Seed context prepared for workflow run ({} keys): {}", seedContext.size(), seedContext);
                    log.info("Starting workflowEngineService.run for workflowId='{}'", trigger.getWorkflow().getId());

                    // Execute workflow
                    Map<String, Object> result = workflowEngineService.run(trigger.getWorkflow().getId(), seedContext);

                    log.info("Workflow execution completed for workflowId='{}'", trigger.getWorkflow().getId());

                    // Mark as completed
                    idempotencyService.markAsCompleted(idempotencyKey, result);
                    response.putAll(result);

                } catch (Exception ex) {
                    log.error("Error executing workflowId='{}' for triggerId='{}'",
                            trigger.getWorkflow().getId(), trigger.getId(), ex);

                    // Mark as failed
                    try {
                        String idempotencyKey = idempotencyStrategyFactory.generateKey(
                                trigger, eventName, eventId, contextData);
                        idempotencyService.markAsFailed(idempotencyKey, ex.getMessage());
                    } catch (Exception e) {
                        log.error("Failed to mark execution as failed", e);
                    }

                    SentryLogger.SentryEventBuilder.error(ex)
                            .withMessage("Workflow execution failed for trigger")
                            .withTag("workflow.id", trigger.getWorkflow().getId().toString())
                            .withTag("trigger.id", trigger.getId().toString())
                            .withTag("trigger.event", eventName)
                            .withTag("institute.id", instituteId)
                            .withTag("operation", "workflowExecution")
                            .send();
                }
            }

            log.info("Completed processing {} workflow triggers.", triggers.size());
            return response;
        } catch (Exception e) {
            log.error("Unexpected error while processing trigger event='{}', eventId='{}'", eventName, eventId, e);
            SentryLogger.SentryEventBuilder.error(e)
                    .withMessage("Unexpected error during trigger event processing")
                    .withTag("trigger.event", eventName)
                    .withTag("event.id", eventId)
                    .withTag("institute.id", instituteId)
                    .withTag("operation", "handleTriggerEvents")
                    .send();
        }

        log.info("---- Workflow Trigger Event END ----");
        return response;
    }

    public Optional<WorkflowTrigger> findByInstituteIdEventNameAndEventId(String instituteId, String eventName,
            String eventId) {
        List<WorkflowTrigger> res = workflowTriggerRepository.findByInstituteIdAndEventIdAnsEventTypeAndStatusIn(
                instituteId, eventId, eventName, List.of(StatusEnum.ACTIVE.name()));
        if (res.size() > 0) {
            return Optional.of(res.get(0));
        }
        return Optional.empty();
    }
}
