package vacademy.io.admin_core_service.features.workflow.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.workflow.dto.WorkflowResponseDTO;
import vacademy.io.admin_core_service.features.workflow.dto.WorkflowScheduleResponseDTO;
import vacademy.io.admin_core_service.features.workflow.dto.WorkflowWithScheduleProjection;
import vacademy.io.admin_core_service.features.workflow.dto.WorkflowWithSchedulesFilterDTO;
import vacademy.io.admin_core_service.features.workflow.dto.PagedWorkflowsResponseDTO;
import vacademy.io.admin_core_service.features.workflow.dto.WorkflowWithScheduleRowDTO;
import vacademy.io.admin_core_service.features.workflow.entity.Workflow;
import vacademy.io.admin_core_service.features.workflow.repository.WorkflowRepository;
import vacademy.io.common.exceptions.VacademyException;

import java.util.List;
import java.util.Map;
import java.util.ArrayList;
import java.util.LinkedHashMap;

@Slf4j
@Service
@RequiredArgsConstructor
public class WorkflowService {

    private final WorkflowRepository workflowRepository;

    public List<WorkflowResponseDTO> getActiveWorkflowsByInstituteId(String instituteId) {
        try {
            List<Workflow> workflows = workflowRepository.findByInstituteIdAndStatus(instituteId, "ACTIVE");
            return workflows.stream()
                .map(WorkflowResponseDTO::fromEntity)
                .toList();
        } catch (Exception e) {
            log.error("Error fetching active workflows for institute: {}", instituteId, e);
            throw new VacademyException("Failed to fetch active workflows");
        }
    }


    public PagedWorkflowsResponseDTO getWorkflowsWithSchedulesPaged(WorkflowWithSchedulesFilterDTO filter,
                                                                    int pageNo,
                                                                    int pageSize) {
        try {
            String searchName = filter.getSearchName();
            String trimmedSearch = searchName == null ? null : searchName.trim();
            String searchPattern = (trimmedSearch == null || trimmedSearch.isEmpty())
                ? null
                : "%" + trimmedSearch.toLowerCase() + "%";

            List<String> wfStatuses;
            List<String> schStatuses;
            List<String> trigStatuses;
            if (StringUtils.hasText(searchPattern)) {
                wfStatuses = null;
                schStatuses = null;
                trigStatuses = null;
            } else {
                wfStatuses = filter.getWorkflowStatuses() == null || filter.getWorkflowStatuses().isEmpty()
                    ? null
                    : filter.getWorkflowStatuses().stream().map(String::toUpperCase).toList();
                schStatuses = filter.getScheduleStatuses() == null
                    || filter.getScheduleStatuses().isEmpty()
                    ? null
                    : filter.getScheduleStatuses().stream().map(String::toUpperCase).toList();
                trigStatuses = filter.getTriggerStatuses() == null
                    || filter.getTriggerStatuses().isEmpty()
                    ? null
                    : filter.getTriggerStatuses().stream().map(String::toUpperCase).toList();
            }

            Pageable pageable = PageRequest.of(pageNo, pageSize);

            var page = workflowRepository.findWorkflowsWithSchedulesPage(
                filter.getInstituteId(), wfStatuses, schStatuses, trigStatuses, searchPattern, pageable);

            List<WorkflowWithScheduleRowDTO> content = page.getContent().stream()
                .map(row -> WorkflowWithScheduleRowDTO.builder()
                    .workflowId(row.getWorkflowId())
                    .workflowName(row.getWorkflowName())
                    .workflowDescription(row.getWorkflowDescription())
                    .workflowStatus(row.getWorkflowStatus())
                    .workflowType(row.getWorkflowType())
                    .createdByUserId(row.getCreatedByUserId())
                    .instituteId(row.getInstituteId())
                    .workflowCreatedAt(row.getWorkflowCreatedAt())
                    .workflowUpdatedAt(row.getWorkflowUpdatedAt())
                    .scheduleId(row.getScheduleId())
                    .scheduleType(row.getScheduleType())
                    .cronExpression(row.getCronExpression())
                    .intervalMinutes(row.getIntervalMinutes())
                    .dayOfMonth(row.getDayOfMonth())
                    .timezone(row.getTimezone())
                    .scheduleStartDate(row.getScheduleStartDate())
                    .scheduleEndDate(row.getScheduleEndDate())
                    .scheduleStatus(row.getScheduleStatus())
                    .lastRunAt(row.getLastRunAt())
                    .nextRunAt(row.getNextRunAt())
                    .scheduleCreatedAt(row.getScheduleCreatedAt())
                    .scheduleUpdatedAt(row.getScheduleUpdatedAt())
                    .triggerId(row.getTriggerId())
                    .triggerEventName(row.getTriggerEventName())
                    .triggerDescription(row.getTriggerDescription())
                    .triggerStatus(row.getTriggerStatus())
                    .triggerCreatedAt(row.getTriggerCreatedAt())
                    .triggerUpdatedAt(row.getTriggerUpdatedAt())
                    .build())
                .toList();

            return PagedWorkflowsResponseDTO.builder()
                .content(content)
                .pageNumber(page.getNumber())
                .pageSize(page.getSize())
                .totalElements(page.getTotalElements())
                .totalPages(page.getTotalPages())
                .last(page.isLast())
                .first(page.isFirst())
                .build();
        } catch (Exception e) {
            log.error("Error fetching paged workflows with schedules for institute: {}", filter.getInstituteId(), e);
            throw new VacademyException("Failed to fetch paged workflows with schedules");
        }
    }

    private List<String> transformStatuses(List<String> statuses) {
        return statuses.stream().map(String::toUpperCase).toList();
    }
}
