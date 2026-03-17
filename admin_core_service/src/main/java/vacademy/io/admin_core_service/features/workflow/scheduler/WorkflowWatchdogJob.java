package vacademy.io.admin_core_service.features.workflow.scheduler;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.workflow.entity.WorkflowExecution;
import vacademy.io.admin_core_service.features.workflow.entity.WorkflowSchedule;
import vacademy.io.admin_core_service.features.workflow.enums.WorkflowExecutionStatus;
import vacademy.io.admin_core_service.features.workflow.repository.WorkflowExecutionRepository;
import vacademy.io.admin_core_service.features.workflow.service.WorkflowScheduleService;
import vacademy.io.admin_core_service.features.notification_service.service.NotificationService;
import vacademy.io.common.notification.dto.GenericEmailRequest;
import vacademy.io.common.logging.SentryLogger;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class WorkflowWatchdogJob {

    private final WorkflowExecutionRepository workflowExecutionRepository;
    private final WorkflowScheduleService workflowScheduleService;
    private final NotificationService notificationService;

    private static final long STALE_THRESHOLD_MINUTES = 60;

    /**
     * Watchdog runs every 15 minutes to cleanup zombie executions
     */
    @Scheduled(fixedDelay = 900000) // 15 minutes
    public void monitorStaleExecutions() {
        log.info("Starting Workflow Watchdog...");

        try {
            Instant cutoffTime = Instant.now().minus(STALE_THRESHOLD_MINUTES, ChronoUnit.MINUTES);

            // Find executions stuck in PROCESSING for more than 60 mins
            List<WorkflowExecution> staleExecutions = workflowExecutionRepository.findStaleExecutions(
                    WorkflowExecutionStatus.PROCESSING, cutoffTime);

            if (staleExecutions.isEmpty()) {
                log.info("No stale workflow executions found.");
                return;
            }

            log.warn("Found {} stale workflow executions. Initiating recovery...", staleExecutions.size());

            for (WorkflowExecution execution : staleExecutions) {
                recoverStaleExecution(execution);
            }

        } catch (Exception e) {
            log.error("Error in Workflow Watchdog", e);
            SentryLogger.logError(e, "WorkflowWatchdog Failed", Map.of("operation", "monitorStaleExecutions"));
        }
    }

    @Transactional
    public void recoverStaleExecution(WorkflowExecution execution) {
        try {
            log.warn("Recovering stale execution: {} (Workflow: {})", execution.getId(),
                    execution.getWorkflow().getId());

            // 1. Mark as FAILED
            execution.setStatus(WorkflowExecutionStatus.FAILED);
            execution.setCompletedAt(Instant.now());
            execution.setErrorMessage("Watchdog: Execution timed out (Possible Zombie/Pod Crash)");
            workflowExecutionRepository.save(execution);

            // 2. Alert Team
            sendAlert(execution);

            // 3. Unblock Schedule (Force Advance)
            if (execution.getWorkflowSchedule() != null) {
                workflowScheduleService.forceAdvanceSchedule(execution.getWorkflowSchedule().getId());
            }

        } catch (Exception e) {
            log.error("Failed to recover stale execution: {}", execution.getId(), e);
            SentryLogger.logError(e, "WorkflowRecovery Failed", Map.of("executionId", execution.getId()));
        }
    }

    private void sendAlert(WorkflowExecution execution) {
        try {
            String subject = "CRITICAL: Workflow Execution Stalled - " + execution.getWorkflow().getName();
            String body = String.format(
                    "<h3>Workflow Watchdog Alert</h3>" +
                            "<p>A workflow execution has been detected as a zombie (stuck in PROCESSING > 60m).</p>" +
                            "<ul>" +
                            "<li><b>Workflow ID:</b> %s</li>" +
                            "<li><b>Execution ID:</b> %s</li>" +
                            "<li><b>Schedule ID:</b> %s</li>" +
                            "<li><b>Started At:</b> %s</li>" +
                            "</ul>" +
                            "<p><b>Action Taken:</b> Marked as FAILED and Schedule advanced to next future slot.</p>",
                    execution.getWorkflow().getId(),
                    execution.getId(),
                    execution.getWorkflowSchedule() != null ? execution.getWorkflowSchedule().getId() : "N/A",
                    execution.getStartedAt());

            List<String> recipients = List.of("shreyash@vidyayatan.com", "manshu@vidyayatan.com");

            for (String recipient : recipients) {
                GenericEmailRequest request = new GenericEmailRequest();
                request.setSubject(subject);
                request.setBody(body);
                request.setTo(recipient);

                // Pass instituteId for logging/billing if needed, or extract from workflow
                String instituteId = execution.getWorkflow().getInstituteId();
                notificationService.sendGenericHtmlMail(request, instituteId);
            }

            log.info("Alert sent for stale execution: {}", execution.getId());

        } catch (Exception e) {
            log.error("Failed to send watchdog alert", e);
        }
    }
}
