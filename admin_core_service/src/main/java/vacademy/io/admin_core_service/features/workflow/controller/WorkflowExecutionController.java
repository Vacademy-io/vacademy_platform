package vacademy.io.admin_core_service.features.workflow.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.workflow.dto.PagedWorkflowExecutionResponseDTO;
import vacademy.io.admin_core_service.features.workflow.dto.WorkflowExecutionFilterDTO;
import vacademy.io.admin_core_service.features.workflow.service.WorkflowExecutionService;
import vacademy.io.common.auth.config.PageConstants;

import static vacademy.io.common.auth.config.PageConstants.DEFAULT_PAGE_NUMBER;

@Slf4j
@RestController
@RequestMapping("/admin-core-service/v1/workflow-execution")
@RequiredArgsConstructor
public class WorkflowExecutionController {

    private final WorkflowExecutionService workflowExecutionService;

    @PostMapping("/list")
    public ResponseEntity<PagedWorkflowExecutionResponseDTO> getWorkflowExecutions(
            @RequestBody WorkflowExecutionFilterDTO filter,
            @RequestParam(value = "pageNo", defaultValue = DEFAULT_PAGE_NUMBER, required = false) int pageNo,
            @RequestParam(value = "pageSize", defaultValue = PageConstants.DEFAULT_PAGE_SIZE, required = false) int pageSize) {

        log.info("Getting workflow executions for instituteId: {}, workflowIds: {}, statuses: {}, page: {}, size: {}",
                filter.getInstituteId(), filter.getWorkflowIds(), filter.getStatuses(), pageNo, pageSize);

        PagedWorkflowExecutionResponseDTO response = workflowExecutionService.getWorkflowExecutions(filter, pageNo,
                pageSize);

        log.info("Retrieved {} workflow executions out of {} total",
                response.getContent().size(), response.getTotalElements());

        return ResponseEntity.ok(response);
    }
}
