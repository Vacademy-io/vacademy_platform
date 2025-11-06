package vacademy.io.admin_core_service.features.workflow.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.workflow.dto.PagedWorkflowScheduleResponseDTO;
import vacademy.io.admin_core_service.features.workflow.dto.WorkflowScheduleFilterDTO;
import vacademy.io.admin_core_service.features.workflow.dto.WorkflowScheduleProjection;
import vacademy.io.admin_core_service.features.workflow.dto.WorkflowScheduleResponseDTO;
import vacademy.io.admin_core_service.features.workflow.repository.WorkflowScheduleRepository;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class WorkflowScheduleQueryService {

    private final WorkflowScheduleRepository workflowScheduleRepository;

    private static final String DEFAULT_STATUS = "ACTIVE";
    private static final String NEXT_RUN_AT_COLUMN = "nextRunAt";

    private static final Map<String, String> COLUMN_MAPPING = Map.ofEntries(
            Map.entry("id", "id"),
            Map.entry("workflowId", "workflowId"),
            Map.entry("workflowName", "w.name"),
            Map.entry("scheduleType", "scheduleType"),
            Map.entry("status", "status"),
            Map.entry("lastRunAt", "lastRunAt"),
            Map.entry(NEXT_RUN_AT_COLUMN, NEXT_RUN_AT_COLUMN),
            Map.entry("createdAt", "createdAt"),
            Map.entry("updatedAt", "updatedAt"));

    @Transactional(readOnly = true)
    public PagedWorkflowScheduleResponseDTO getWorkflowSchedules(
            WorkflowScheduleFilterDTO filter,
            int pageNo,
            int pageSize) {

        if (filter.getInstituteId() == null || filter.getInstituteId().isBlank()) {
            throw new IllegalArgumentException("Institute ID is required");
        }

        List<String> statuses = (filter.getStatuses() == null || filter.getStatuses().isEmpty())
                ? List.of(DEFAULT_STATUS)
                : filter.getStatuses();

        Pageable pageable = createPageable(pageNo, pageSize, filter.getSortColumns());

        Page<WorkflowScheduleProjection> schedulePage = workflowScheduleRepository.findWorkflowSchedulesWithFilters(
                filter.getInstituteId(),
                filter.getWorkflowIds(),
                statuses,
                pageable);

        List<WorkflowScheduleResponseDTO> content = schedulePage.getContent().stream()
                .map(this::mapToResponse)
                .toList();

        return PagedWorkflowScheduleResponseDTO.builder()
                .content(content)
                .pageNumber(schedulePage.getNumber())
                .pageSize(schedulePage.getSize())
                .totalElements(schedulePage.getTotalElements())
                .totalPages(schedulePage.getTotalPages())
                .last(schedulePage.isLast())
                .first(schedulePage.isFirst())
                .build();
    }

    private Pageable createPageable(int pageNo, int pageSize, Map<String, String> sortColumns) {
        if (sortColumns == null || sortColumns.isEmpty()) {
            return PageRequest.of(pageNo, pageSize, Sort.by(Sort.Direction.DESC, NEXT_RUN_AT_COLUMN));
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

    private WorkflowScheduleResponseDTO mapToResponse(WorkflowScheduleProjection projection) {
        return WorkflowScheduleResponseDTO.builder()
                .id(projection.getId())
                .workflowId(projection.getWorkflowId())
                .workflowName(projection.getWorkflowName())
                .scheduleType(projection.getScheduleType())
                .cronExpression(projection.getCronExpression())
                .intervalMinutes(projection.getIntervalMinutes())
                .dayOfMonth(projection.getDayOfMonth())
                .timezone(projection.getTimezone())
                .startDate(projection.getStartDate())
                .endDate(projection.getEndDate())
                .status(projection.getStatus())
                .lastRunAt(projection.getLastRunAt())
                .nextRunAt(projection.getNextRunAt())
                .createdAt(projection.getCreatedAt())
                .updatedAt(projection.getUpdatedAt())
                .build();
    }
}
