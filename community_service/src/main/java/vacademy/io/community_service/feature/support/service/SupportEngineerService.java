package vacademy.io.community_service.feature.support.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;
import vacademy.io.community_service.feature.support.dto.SupportEngineerDto;
import vacademy.io.community_service.feature.support.dto.UpsertEngineerRequest;
import vacademy.io.community_service.feature.support.entity.InstituteEngineerAssignment;
import vacademy.io.community_service.feature.support.entity.SupportEngineer;
import vacademy.io.community_service.feature.support.repository.InstituteEngineerAssignmentRepository;
import vacademy.io.community_service.feature.support.repository.SupportEngineerRepository;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class SupportEngineerService {

    @Autowired
    private SupportEngineerRepository engineerRepository;

    @Autowired
    private InstituteEngineerAssignmentRepository assignmentRepository;

    @Transactional(readOnly = true)
    public List<SupportEngineerDto> listAll() {
        Map<String, Long> assignedCounts = assignmentRepository.findAll().stream()
                .collect(Collectors.groupingBy(InstituteEngineerAssignment::getEngineerId, Collectors.counting()));
        return engineerRepository.findAllByOrderByNameAsc().stream()
                .map(e -> toDto(e, assignedCounts.getOrDefault(e.getId(), 0L).intValue(), null))
                .collect(Collectors.toList());
    }

    @Transactional
    public SupportEngineerDto create(UpsertEngineerRequest request) {
        if (request == null || !StringUtils.hasText(request.getName()) || !StringUtils.hasText(request.getEmail())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "name and email are required");
        }
        SupportEngineer engineer = SupportEngineer.builder()
                .name(request.getName().trim())
                .email(request.getEmail().trim())
                .userId(StringUtils.hasText(request.getUserId()) ? request.getUserId().trim() : null)
                .active(request.getActive() == null || request.getActive())
                .build();
        return toDto(engineerRepository.save(engineer), 0, null);
    }

    @Transactional
    public SupportEngineerDto update(String id, UpsertEngineerRequest request) {
        SupportEngineer engineer = getOrThrow(id);
        if (request != null) {
            if (StringUtils.hasText(request.getName())) {
                engineer.setName(request.getName().trim());
            }
            if (StringUtils.hasText(request.getEmail())) {
                engineer.setEmail(request.getEmail().trim());
            }
            if (request.getUserId() != null) {
                engineer.setUserId(StringUtils.hasText(request.getUserId()) ? request.getUserId().trim() : null);
            }
            if (request.getActive() != null) {
                engineer.setActive(request.getActive());
            }
        }
        return toDto(engineerRepository.save(engineer), null, null);
    }

    @Transactional
    public void delete(String id) {
        SupportEngineer engineer = getOrThrow(id);
        assignmentRepository.deleteByEngineerId(id);
        engineerRepository.delete(engineer);
    }

    // ---- helpers used by other services -----------------------------------------

    public SupportEngineer getOrThrow(String id) {
        return engineerRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Engineer not found: " + id));
    }

    public Map<String, SupportEngineer> mapByIds(Collection<String> ids) {
        if (ids == null || ids.isEmpty()) {
            return Map.of();
        }
        return engineerRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(SupportEngineer::getId, Function.identity()));
    }

    public String nameOf(String engineerId) {
        if (!StringUtils.hasText(engineerId)) {
            return null;
        }
        return engineerRepository.findById(engineerId).map(SupportEngineer::getName).orElse(null);
    }

    public SupportEngineerDto toDto(SupportEngineer e, Integer assignedCount, Boolean primary) {
        return SupportEngineerDto.builder()
                .id(e.getId())
                .name(e.getName())
                .email(e.getEmail())
                .userId(e.getUserId())
                .active(e.isActive())
                .assignedInstituteCount(assignedCount)
                .primary(primary)
                .build();
    }
}
