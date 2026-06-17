package vacademy.io.community_service.feature.support.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;
import vacademy.io.community_service.feature.support.dto.GlobalSettingsDto;
import vacademy.io.community_service.feature.support.dto.InstituteSupportConfigDto;
import vacademy.io.community_service.feature.support.dto.SupportConfigDto;
import vacademy.io.community_service.feature.support.dto.SupportEngineerDto;
import vacademy.io.community_service.feature.support.dto.SupportPlanDto;
import vacademy.io.community_service.feature.support.dto.UpsertInstituteConfigRequest;
import vacademy.io.community_service.feature.support.entity.InstituteEngineerAssignment;
import vacademy.io.community_service.feature.support.entity.InstituteSupportConfig;
import vacademy.io.community_service.feature.support.entity.SupportEngineer;
import vacademy.io.community_service.feature.support.entity.SupportGlobalSettings;
import vacademy.io.community_service.feature.support.enums.SupportPlan;
import vacademy.io.community_service.feature.support.enums.TicketStatus;
import vacademy.io.community_service.feature.support.repository.InstituteEngineerAssignmentRepository;
import vacademy.io.community_service.feature.support.repository.InstituteSupportConfigRepository;
import vacademy.io.community_service.feature.support.repository.SupportEngineerRepository;
import vacademy.io.community_service.feature.support.repository.SupportGlobalSettingsRepository;
import vacademy.io.community_service.feature.support.repository.SupportTicketRepository;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class SupportConfigService {

    /** Statuses that count as an institute's "open" tickets. */
    public static final List<TicketStatus> ACTIVE_STATUSES =
            List.of(TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.WAITING_ON_CUSTOMER);

    private static final TypeReference<List<String>> STRING_LIST = new TypeReference<>() {
    };

    @Autowired
    private InstituteSupportConfigRepository configRepository;
    @Autowired
    private InstituteEngineerAssignmentRepository assignmentRepository;
    @Autowired
    private SupportEngineerRepository engineerRepository;
    @Autowired
    private SupportGlobalSettingsRepository globalSettingsRepository;
    @Autowired
    private SupportTicketRepository ticketRepository;
    @Autowired
    private ObjectMapper objectMapper;

    // ---- plan resolution ---------------------------------------------------------

    @Transactional(readOnly = true)
    public SupportPlan resolvePlan(String instituteId) {
        return configRepository.findByInstituteId(instituteId)
                .map(InstituteSupportConfig::getPlan)
                .orElse(SupportPlan.DEFAULT);
    }

    // ---- institute (admin) self-view ---------------------------------------------

    @Transactional(readOnly = true)
    public SupportConfigDto getAdminConfig(String instituteId) {
        SupportPlan plan = resolvePlan(instituteId);
        long openCount = ticketRepository.countByInstituteIdAndStatusIn(instituteId, ACTIVE_STATUSES);
        return SupportConfigDto.builder()
                .instituteId(instituteId)
                .plan(SupportPlanDto.from(plan))
                .dedicatedEngineerNames(plan.isDedicatedEngineer() ? dedicatedEngineerNames(instituteId)
                        : Collections.emptyList())
                .openTicketCount(openCount)
                .build();
    }

    // ---- super-admin view / editor ----------------------------------------------

    @Transactional(readOnly = true)
    public InstituteSupportConfigDto getSuperAdminConfig(String instituteId, String instituteNameHint) {
        Optional<InstituteSupportConfig> config = configRepository.findByInstituteId(instituteId);
        SupportPlan plan = config.map(InstituteSupportConfig::getPlan).orElse(SupportPlan.DEFAULT);
        return InstituteSupportConfigDto.builder()
                .instituteId(instituteId)
                .instituteName(instituteNameHint)
                .plan(plan.name())
                .planDetail(SupportPlanDto.from(plan))
                .alertEmails(config.map(c -> parseStringList(c.getAlertEmails())).orElse(Collections.emptyList()))
                .engineers(assignedEngineerDtos(instituteId))
                .openTicketCount(ticketRepository.countByInstituteIdAndStatusIn(instituteId, ACTIVE_STATUSES))
                .build();
    }

    @Transactional
    public InstituteSupportConfigDto upsertConfig(String instituteId, UpsertInstituteConfigRequest request) {
        if (!StringUtils.hasText(instituteId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "instituteId is required");
        }
        InstituteSupportConfig config = configRepository.findByInstituteId(instituteId)
                .orElseGet(() -> InstituteSupportConfig.builder()
                        .instituteId(instituteId)
                        .plan(SupportPlan.DEFAULT)
                        .build());

        if (request != null && StringUtils.hasText(request.getPlan())) {
            config.setPlan(SupportPlan.fromName(request.getPlan()));
        }
        if (request != null && request.getAlertEmails() != null) {
            config.setAlertEmails(writeStringList(cleanEmails(request.getAlertEmails())));
        }
        configRepository.save(config);

        if (request != null && request.getEngineerIds() != null) {
            replaceAssignments(instituteId, request.getEngineerIds(), request.getPrimaryEngineerId());
        }

        String nameHint = request != null ? request.getInstituteName() : null;
        return getSuperAdminConfig(instituteId, nameHint);
    }

    private void replaceAssignments(String instituteId, List<String> engineerIds, String primaryEngineerId) {
        assignmentRepository.deleteByInstituteId(instituteId);
        List<String> distinctIds = engineerIds.stream()
                .filter(StringUtils::hasText)
                .distinct()
                .collect(Collectors.toList());
        // Validate the ids exist before assigning.
        Map<String, SupportEngineer> byId = engineerRepository.findAllById(distinctIds).stream()
                .collect(Collectors.toMap(SupportEngineer::getId, e -> e));
        List<InstituteEngineerAssignment> toSave = new ArrayList<>();
        for (String engineerId : distinctIds) {
            if (!byId.containsKey(engineerId)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown engineer id: " + engineerId);
            }
            toSave.add(InstituteEngineerAssignment.builder()
                    .instituteId(instituteId)
                    .engineerId(engineerId)
                    .primary(engineerId.equals(primaryEngineerId))
                    .build());
        }
        assignmentRepository.saveAll(toSave);
    }

    // ---- alert routing -----------------------------------------------------------

    /** Recipients for a new-issue alert: global list + per-institute override + assigned engineers. */
    @Transactional(readOnly = true)
    public List<String> resolveAlertEmails(String instituteId) {
        Set<String> recipients = new LinkedHashSet<>();
        recipients.addAll(getGlobalAlertEmails());
        configRepository.findByInstituteId(instituteId)
                .ifPresent(c -> recipients.addAll(parseStringList(c.getAlertEmails())));
        for (SupportEngineer engineer : assignedEngineers(instituteId)) {
            if (engineer.isActive() && StringUtils.hasText(engineer.getEmail())) {
                recipients.add(engineer.getEmail().trim());
            }
        }
        return new ArrayList<>(recipients);
    }

    @Transactional(readOnly = true)
    public List<String> dedicatedEngineerNames(String instituteId) {
        return assignedEngineers(instituteId).stream()
                .filter(SupportEngineer::isActive)
                .map(SupportEngineer::getName)
                .collect(Collectors.toList());
    }

    // ---- global settings ---------------------------------------------------------

    @Transactional(readOnly = true)
    public GlobalSettingsDto getGlobalSettings() {
        return GlobalSettingsDto.builder().alertEmails(getGlobalAlertEmails()).build();
    }

    @Transactional
    public GlobalSettingsDto updateGlobalSettings(List<String> alertEmails) {
        SupportGlobalSettings settings = globalSettingsRepository.findById(SupportGlobalSettings.SINGLETON_ID)
                .orElseGet(() -> SupportGlobalSettings.builder().id(SupportGlobalSettings.SINGLETON_ID).build());
        settings.setAlertEmails(writeStringList(cleanEmails(alertEmails == null ? List.of() : alertEmails)));
        globalSettingsRepository.save(settings);
        return getGlobalSettings();
    }

    private List<String> getGlobalAlertEmails() {
        return globalSettingsRepository.findById(SupportGlobalSettings.SINGLETON_ID)
                .map(s -> parseStringList(s.getAlertEmails()))
                .orElse(Collections.emptyList());
    }

    // ---- internals ---------------------------------------------------------------

    private List<SupportEngineer> assignedEngineers(String instituteId) {
        List<String> ids = assignmentRepository.findByInstituteId(instituteId).stream()
                .map(InstituteEngineerAssignment::getEngineerId)
                .collect(Collectors.toList());
        if (ids.isEmpty()) {
            return Collections.emptyList();
        }
        return engineerRepository.findAllById(ids);
    }

    private List<SupportEngineerDto> assignedEngineerDtos(String instituteId) {
        List<InstituteEngineerAssignment> assignments = assignmentRepository.findByInstituteId(instituteId);
        if (assignments.isEmpty()) {
            return Collections.emptyList();
        }
        Map<String, Boolean> primaryById = assignments.stream()
                .collect(Collectors.toMap(InstituteEngineerAssignment::getEngineerId,
                        InstituteEngineerAssignment::isPrimary, (a, b) -> a || b));
        return engineerRepository.findAllById(primaryById.keySet()).stream()
                .map(e -> SupportEngineerDto.builder()
                        .id(e.getId()).name(e.getName()).email(e.getEmail())
                        .userId(e.getUserId()).active(e.isActive())
                        .primary(primaryById.getOrDefault(e.getId(), false))
                        .build())
                .collect(Collectors.toList());
    }

    private List<String> cleanEmails(List<String> emails) {
        return emails.stream()
                .filter(StringUtils::hasText)
                .map(String::trim)
                .distinct()
                .collect(Collectors.toList());
    }

    private List<String> parseStringList(String json) {
        if (!StringUtils.hasText(json)) {
            return new ArrayList<>();
        }
        try {
            List<String> parsed = objectMapper.readValue(json, STRING_LIST);
            return parsed != null ? parsed : new ArrayList<>();
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    private String writeStringList(List<String> values) {
        try {
            return objectMapper.writeValueAsString(values != null ? values : Collections.emptyList());
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to serialize list");
        }
    }
}
