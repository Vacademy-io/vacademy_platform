package vacademy.io.admin_core_service.features.workflow.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.workflow.dto.PagedWorkflowScheduleResponseDTO;
import vacademy.io.admin_core_service.features.workflow.dto.WorkflowResponseDTO;
import vacademy.io.admin_core_service.features.workflow.dto.WorkflowScheduleFilterDTO;
import vacademy.io.admin_core_service.features.workflow.service.WorkflowScheduleQueryService;
import vacademy.io.admin_core_service.features.workflow.service.WorkflowService;
import vacademy.io.common.auth.config.PageConstants;

import java.util.List;

import static vacademy.io.common.auth.config.PageConstants.DEFAULT_PAGE_NUMBER;

@Slf4j
@RestController
@RequestMapping("/admin-core-service/v1/workflow")
@RequiredArgsConstructor
public class WorkflowController {

    private final WorkflowService workflowService;
    private final WorkflowScheduleQueryService workflowScheduleQueryService;

    @GetMapping("/institute/{instituteId}")
    public ResponseEntity<List<WorkflowResponseDTO>> getActiveWorkflowsByInstituteId(
            @PathVariable String instituteId) {

        List<WorkflowResponseDTO> workflows = workflowService.getActiveWorkflowsByInstituteId(instituteId);
        return ResponseEntity.ok(workflows);
    }

    @PostMapping("/schedule/list")
    public ResponseEntity<PagedWorkflowScheduleResponseDTO> getWorkflowSchedules(
            @RequestBody WorkflowScheduleFilterDTO filter,
            @RequestParam(value = "pageNo", defaultValue = DEFAULT_PAGE_NUMBER, required = false) int pageNo,
            @RequestParam(value = "pageSize", defaultValue = PageConstants.DEFAULT_PAGE_SIZE, required = false) int pageSize) {

        log.info("Getting workflow schedules for instituteId: {}, workflowIds: {}, statuses: {}, page: {}, size: {}",
                filter.getInstituteId(), filter.getWorkflowIds(), filter.getStatuses(), pageNo, pageSize);

        PagedWorkflowScheduleResponseDTO response = workflowScheduleQueryService.getWorkflowSchedules(filter, pageNo,
                pageSize);

        log.info("Retrieved {} workflow schedules out of {} total",
                response.getContent().size(), response.getTotalElements());

        return ResponseEntity.ok(response);
    }
}
