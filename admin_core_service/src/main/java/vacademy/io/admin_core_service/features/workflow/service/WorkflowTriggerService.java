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
    public void handleTriggerEvent(String eventName,String eventId, String instituteId, Map<String, Object> contextData) {
        try {
            log.info("Trigger received: event='{}', instituteId='{}'", eventId, instituteId);

            List<WorkflowTrigger> triggers = workflowTriggerRepository.findByInstituteIdAndEventIdAnsEventTypeAndStatusIn(
                    instituteId,  eventId,eventName, List.of(StatusEnum.ACTIVE.name())
            );

            if (triggers.isEmpty()) {
                log.info("No active workflow triggers found for event='{}', instituteId='{}'", eventName, instituteId);
                return;
            }

            log.info("Found {} active workflow triggers for event='{}'", triggers.size(), eventName);

            for (WorkflowTrigger trigger : triggers) {
                String workflowId = trigger.getWorkflow().getId();
                log.info("Executing workflow '{}' for trigger '{}'", workflowId, trigger.getTriggerEventName());

                try {
                    Map<String, Object> seedContext = new HashMap<>(Optional.ofNullable(contextData).orElse(new HashMap<>()));
                    seedContext.put("triggerEvents", eventName);
                    seedContext.put("triggerId", trigger.getId());
                    seedContext.put("instituteId", instituteId);

                    // Use scheduleRunId = null for event-based executions
                    workflowEngineService.run(workflowId, seedContext);

                } catch (Exception e) {
                    log.error("Error executing workflow '{}' for trigger '{}'", workflowId, trigger.getTriggerEventName(), e);
                }
            }

        } catch (Exception e) {
            log.error("Error processing trigger event '{}'", eventName, e);
            e.printStackTrace();
        }
    }
}
