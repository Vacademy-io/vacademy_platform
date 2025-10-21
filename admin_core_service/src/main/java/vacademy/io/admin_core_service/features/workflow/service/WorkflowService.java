package vacademy.io.admin_core_service.features.workflow.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.workflow.dto.WorkflowResponseDTO;
import vacademy.io.admin_core_service.features.workflow.entity.Workflow;
import vacademy.io.admin_core_service.features.workflow.repository.WorkflowRepository;
import vacademy.io.common.exceptions.VacademyException;

import java.util.List;
import java.util.stream.Collectors;

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
                    .collect(Collectors.toList());
        } catch (Exception e) {
            log.error("Error fetching active workflows for institute: {}", instituteId, e);
            throw new VacademyException("Failed to fetch active workflows");
        }
    }
}
