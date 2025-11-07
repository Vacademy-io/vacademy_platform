package vacademy.io.admin_core_service.features.workflow.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.workflow.dto.*;
import vacademy.io.admin_core_service.features.workflow.repository.WorkflowExecutionRepository;

import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class WorkflowExecutionService {

    private final WorkflowExecutionRepository workflowExecutionRepository;

    private static final String STARTED_AT_COLUMN = "startedAt";

    private static final Map<String, String> COLUMN_MAPPING = Map.of(
            "id", "id",
            "status", "status",
            STARTED_AT_COLUMN, STARTED_AT_COLUMN,
            "completedAt", "completedAt",
            "createdAt", "createdAt",
            "updatedAt", "updatedAt",
            "workflowName", "workflow.name",
            "idempotencyKey", "idempotencyKey");

    @Transactional(readOnly = true)
    public PagedWorkflowExecutionResponseDTO getWorkflowExecutions(
            WorkflowExecutionFilterDTO filter,
            int pageNo,
            int pageSize) {

        if (filter.getInstituteId() == null || filter.getInstituteId().isBlank()) {
            throw new IllegalArgumentException("Institute ID is required");
        }

        if (filter.getWorkflowIds() == null || filter.getWorkflowIds().isEmpty()) {
            throw new IllegalArgumentException("Workflow IDs are required");
        }

        Pageable pageable = createPageable(pageNo, pageSize, filter.getSortColumns());

        Instant startInstant = filter.getStartDate();

        Instant endInstant = filter.getEndDate();

        Page<WorkflowExecutionProjection> executionPage = workflowExecutionRepository.findWorkflowExecutionsWithFilters(
                filter.getInstituteId(),
                filter.getWorkflowIds(),
                filter.getStatuses(),
                startInstant,
                endInstant,
                pageable);

        List<WorkflowExecutionResponseDTO> content = executionPage.getContent().stream()
                .map(this::mapToResponse)
                .toList();

        return PagedWorkflowExecutionResponseDTO.builder()
                .content(content)
                .pageNumber(executionPage.getNumber())
                .pageSize(executionPage.getSize())
                .totalElements(executionPage.getTotalElements())
                .totalPages(executionPage.getTotalPages())
                .last(executionPage.isLast())
                .first(executionPage.isFirst())
                .build();
    }

    private Pageable createPageable(int pageNo, int pageSize, Map<String, String> sortColumns) {
        if (sortColumns == null || sortColumns.isEmpty()) {
            return PageRequest.of(pageNo, pageSize, Sort.by(Sort.Direction.DESC, STARTED_AT_COLUMN));
        }

        List<Sort.Order> orders = new ArrayList<>();
        for (Map.Entry<String, String> entry : sortColumns.entrySet()) {
            String column = entry.getKey();
            String direction = entry.getValue();

            String mappedColumn = COLUMN_MAPPING.getOrDefault(column, column);

            Sort.Direction sortDirection = "asc".equalsIgnoreCase(direction)
                    ? Sort.Direction.ASC
                    : Sort.Direction.DESC;

            orders.add(new Sort.Order(sortDirection, mappedColumn));
        }

        return PageRequest.of(pageNo, pageSize, Sort.by(orders));
    }

    private WorkflowExecutionResponseDTO mapToResponse(WorkflowExecutionProjection projection) {
        return WorkflowExecutionResponseDTO.builder()
                .id(projection.getId())
                .idempotencyKey(projection.getIdempotencyKey())
                .status(projection.getStatus())
                .errorMessage(projection.getErrorMessage())
                .startedAt(projection.getStartedAt())
                .completedAt(projection.getCompletedAt())
                .createdAt(projection.getCreatedAt())
                .updatedAt(projection.getUpdatedAt())
                .workflowId(projection.getWorkflowId())
                .workflowName(projection.getWorkflowName())
                .workflowScheduleId(projection.getWorkflowScheduleId())
                .build();
    }
}
