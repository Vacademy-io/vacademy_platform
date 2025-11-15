package vacademy.io.admin_core_service.features.workflow.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.common.enums.StatusEnum;
import vacademy.io.admin_core_service.features.workflow.entity.WorkflowTrigger;
import vacademy.io.admin_core_service.features.workflow.repository.WorkflowTriggerRepository;

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

    @Async
    public void handleTriggerEvent(String eventName, String eventId, String instituteId, Map<String, Object> contextData) {
        log.info("---- Workflow Trigger Event START ----");
        log.info("Incoming trigger params: eventName='{}', eventId='{}', instituteId='{}'", eventName, eventId, instituteId);

        try {
            // Log context data if present
            if (contextData == null || contextData.isEmpty()) {
                log.warn("Context data is EMPTY or NULL");
            } else {
                log.info("Context data received ({} keys): {}", contextData.size(), contextData);
            }

            log.info("Calling repository: findByInstituteIdAndEventIdAnsEventTypeAndStatusIn(instituteId='{}', eventId='{}', eventType='{}')",
                    instituteId, eventId, eventName);

            List<WorkflowTrigger> triggers = workflowTriggerRepository.findByInstituteIdAndEventIdAnsEventTypeAndStatusIn(
                    instituteId, eventId, eventName, List.of(StatusEnum.ACTIVE.name())
            );

            log.info("Repository returned {} triggers for event='{}', eventId='{}', instituteId='{}'",
                    triggers.size(), eventName, eventId, instituteId);

            if (triggers.isEmpty()) {
                log.info("No ACTIVE workflow triggers found. Exiting execution.");
                log.info("---- Workflow Trigger Event END ----");
                return;
            }

            int count = 0;

            for (WorkflowTrigger trigger : triggers) {
                count++;
                log.info("Processing trigger {} of {} | TriggerId='{}', TriggerEventName='{}', WorkflowId='{}'",
                        count, triggers.size(), trigger.getId(), trigger.getTriggerEventName(), trigger.getWorkflow().getId());

                try {
                    Map<String, Object> seedContext = new HashMap<>(Optional.ofNullable(contextData).orElse(new HashMap<>()));
                    seedContext.put("triggerEvents", eventName);
                    seedContext.put("triggerId", trigger.getId());
                    seedContext.put("instituteId", instituteId);

                    log.info("Seed context prepared for workflow run ({} keys): {}", seedContext.size(), seedContext);
                    log.info("Starting workflowEngineService.run for workflowId='{}'", trigger.getWorkflow().getId());

                    workflowEngineService.run(trigger.getWorkflow().getId(), seedContext);

                    log.info("Workflow execution completed for workflowId='{}'", trigger.getWorkflow().getId());

                } catch (Exception ex) {
                    log.error("Error executing workflowId='{}' for triggerId='{}'",
                            trigger.getWorkflow().getId(), trigger.getId(), ex);
                }
            }

            log.info("Completed processing {} workflow triggers.", triggers.size());

        } catch (Exception e) {
            log.error("Unexpected error while processing trigger event='{}', eventId='{}'", eventName, eventId, e);
        }

        log.info("---- Workflow Trigger Event END ----");
    }
}
