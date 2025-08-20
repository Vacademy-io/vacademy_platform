package vacademy.io.admin_core_service.features.workflow.scheduler;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.quartz.Job;
import org.quartz.JobExecutionContext;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.workflow.entity.WorkflowSchedule;
import vacademy.io.admin_core_service.features.workflow.entity.WorkflowScheduleRun;
import vacademy.io.admin_core_service.features.workflow.repository.WorkflowScheduleRepository;
import vacademy.io.admin_core_service.features.workflow.repository.WorkflowScheduleRunRepository;
import vacademy.io.admin_core_service.features.workflow.service.WorkflowEngineService;

import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.*;

@Component
@RequiredArgsConstructor
@Slf4j
public class WorkflowDispatchJob implements Job {

    private final WorkflowScheduleRepository scheduleRepository;
    private final WorkflowScheduleRunRepository runRepository;
    private final WorkflowEngineService engineService;

    @Override
    public void execute(JobExecutionContext context) {
        List<WorkflowSchedule> active = scheduleRepository.findAll().stream()
                .filter(s -> "ACTIVE".equalsIgnoreCase(s.getStatus()))
                .toList();

        for (WorkflowSchedule s : active) {
            try {
                // Just use "now" instead of planned 4 AM
                Date plannedAt = new Date();

                // Try to find existing run (avoid duplicate creation if same instant)
                Optional<WorkflowScheduleRun> existing = runRepository.findByScheduleIdAndPlannedRunAt(s.getId(), plannedAt);
                WorkflowScheduleRun run = existing.orElseGet(() -> {
                    WorkflowScheduleRun r = WorkflowScheduleRun.builder()
                            .id(UUID.randomUUID().toString())
                            .scheduleId(s.getId())
                            .workflowId(s.getWorkflowId())
                            .plannedRunAt(plannedAt)
                            .firedAt(new Date())
                            .status("CREATED")
                            .dedupeKey(s.getId() + "|" + plannedAt.toString())
                            .build();
                    runRepository.save(r);
                    return r;
                });

                if (!"CREATED".equalsIgnoreCase(run.getStatus())) {
                    continue;
                }

                // Seed context for this run
                Map<String, Object> seed = new HashMap<>();
                seed.put("schedule_run_id", run.getId());

                // Always run engine
                engineService.run(s.getWorkflowId(), run.getId(), seed);

                run.setStatus("DISPATCHED");
                runRepository.save(run);

            } catch (Exception e) {
                log.error("Dispatch error for schedule {}", s.getId(), e);
            }
        }
    }
}