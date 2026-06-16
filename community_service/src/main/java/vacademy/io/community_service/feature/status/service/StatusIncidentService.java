package vacademy.io.community_service.feature.status.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.community_service.feature.status.dto.AddIncidentUpdateRequest;
import vacademy.io.community_service.feature.status.dto.CreateIncidentRequest;
import vacademy.io.community_service.feature.status.dto.StatusIncidentDto;
import vacademy.io.community_service.feature.status.dto.StatusIncidentUpdateDto;
import vacademy.io.community_service.feature.status.dto.UpdateIncidentRequest;
import vacademy.io.community_service.feature.status.entity.StatusIncident;
import vacademy.io.community_service.feature.status.enums.IncidentSeverity;
import vacademy.io.community_service.feature.status.enums.IncidentStatus;
import vacademy.io.community_service.feature.status.repository.StatusIncidentRepository;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Date;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class StatusIncidentService {

    private static final TypeReference<List<StatusIncidentUpdateDto>> UPDATE_LIST_TYPE =
            new TypeReference<List<StatusIncidentUpdateDto>>() {
            };

    @Autowired
    private StatusIncidentRepository incidentRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public List<StatusIncidentDto> listIncidents() {
        return incidentRepository.findAllByOrderByStartedAtDesc().stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public StatusIncidentDto createIncident(CustomUserDetails user, CreateIncidentRequest request) {
        if (request == null || !StringUtils.hasText(request.getTitle())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "title is required");
        }

        IncidentStatus status = request.getStatus() != null ? request.getStatus() : IncidentStatus.INVESTIGATING;

        List<StatusIncidentUpdateDto> updates = new ArrayList<>();
        if (StringUtils.hasText(request.getMessage())) {
            updates.add(newUpdate(status, request.getMessage(), user));
        }

        StatusIncident incident = StatusIncident.builder()
                .title(request.getTitle().trim())
                .status(status)
                .severity(request.getSeverity() != null ? request.getSeverity() : IncidentSeverity.MINOR)
                .affectedComponents(toComponentString(request.getAffectedComponents()))
                .updates(writeUpdates(updates))
                .startedAt(request.getStartedAt() != null ? request.getStartedAt() : new Date())
                .createdBy(user != null ? user.getUserId() : null)
                .createdByName(user != null ? user.getFullName() : null)
                .build();
        if (status == IncidentStatus.RESOLVED) {
            incident.setResolvedAt(new Date());
        }

        return toDto(incidentRepository.save(incident));
    }

    @Transactional
    public StatusIncidentDto updateIncident(String id, UpdateIncidentRequest request) {
        StatusIncident incident = getOrThrow(id);
        if (request == null) {
            return toDto(incident);
        }

        if (StringUtils.hasText(request.getTitle())) {
            incident.setTitle(request.getTitle().trim());
        }
        if (request.getSeverity() != null) {
            incident.setSeverity(request.getSeverity());
        }
        if (request.getAffectedComponents() != null) {
            incident.setAffectedComponents(toComponentString(request.getAffectedComponents()));
        }
        if (request.getStartedAt() != null) {
            incident.setStartedAt(request.getStartedAt());
        }
        if (request.getStatus() != null) {
            applyStatus(incident, request.getStatus());
        }
        // Explicit resolved_at override wins over the auto-stamp above.
        if (request.getResolvedAt() != null) {
            incident.setResolvedAt(request.getResolvedAt());
        }

        return toDto(incidentRepository.save(incident));
    }

    @Transactional
    public StatusIncidentDto addUpdate(String id, CustomUserDetails user, AddIncidentUpdateRequest request) {
        if (request == null || !StringUtils.hasText(request.getMessage())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "message is required");
        }
        StatusIncident incident = getOrThrow(id);

        // A timeline entry carries the status it represents; default to the incident's current one.
        IncidentStatus entryStatus = request.getStatus() != null ? request.getStatus() : incident.getStatus();

        List<StatusIncidentUpdateDto> updates = parseUpdates(incident.getUpdates());
        updates.add(0, newUpdate(entryStatus, request.getMessage(), user)); // newest-first
        incident.setUpdates(writeUpdates(updates));

        if (request.getStatus() != null) {
            applyStatus(incident, request.getStatus());
        }

        return toDto(incidentRepository.save(incident));
    }

    @Transactional
    public void deleteIncident(String id) {
        incidentRepository.delete(getOrThrow(id));
    }

    // ---------------------------------------------------------------------

    private StatusIncident getOrThrow(String id) {
        return incidentRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Incident not found: " + id));
    }

    /** Move the incident to a new status, auto-stamping resolved_at on first resolve. */
    private void applyStatus(StatusIncident incident, IncidentStatus newStatus) {
        incident.setStatus(newStatus);
        if (newStatus == IncidentStatus.RESOLVED) {
            if (incident.getResolvedAt() == null) {
                incident.setResolvedAt(new Date());
            }
        } else {
            incident.setResolvedAt(null);
        }
    }

    private StatusIncidentUpdateDto newUpdate(IncidentStatus status, String message, CustomUserDetails user) {
        return StatusIncidentUpdateDto.builder()
                .id(UUID.randomUUID().toString())
                .status(status != null ? status.name() : null)
                .message(message.trim())
                .createdBy(user != null ? user.getUserId() : null)
                .createdByName(user != null ? user.getFullName() : null)
                .createdAt(new Date())
                .build();
    }

    private StatusIncidentDto toDto(StatusIncident incident) {
        return StatusIncidentDto.builder()
                .id(incident.getId())
                .title(incident.getTitle())
                .status(incident.getStatus() != null ? incident.getStatus().name() : null)
                .severity(incident.getSeverity() != null ? incident.getSeverity().name() : null)
                .affectedComponents(toComponentList(incident.getAffectedComponents()))
                .updates(parseUpdates(incident.getUpdates()))
                .startedAt(incident.getStartedAt())
                .resolvedAt(incident.getResolvedAt())
                .createdBy(incident.getCreatedBy())
                .createdByName(incident.getCreatedByName())
                .createdAt(incident.getCreatedAt())
                .updatedAt(incident.getUpdatedAt())
                .build();
    }

    private List<StatusIncidentUpdateDto> parseUpdates(String json) {
        if (!StringUtils.hasText(json)) {
            return new ArrayList<>();
        }
        try {
            List<StatusIncidentUpdateDto> parsed = objectMapper.readValue(json, UPDATE_LIST_TYPE);
            return parsed != null ? parsed : new ArrayList<>();
        } catch (Exception e) {
            // Defensive: a malformed row should not break the whole listing.
            return new ArrayList<>();
        }
    }

    private String writeUpdates(List<StatusIncidentUpdateDto> updates) {
        try {
            return objectMapper.writeValueAsString(updates != null ? updates : Collections.emptyList());
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to serialize incident updates");
        }
    }

    private String toComponentString(List<String> components) {
        if (components == null || components.isEmpty()) {
            return null;
        }
        String joined = components.stream()
                .filter(StringUtils::hasText)
                .map(String::trim)
                .collect(Collectors.joining(","));
        return StringUtils.hasText(joined) ? joined : null;
    }

    private List<String> toComponentList(String components) {
        if (!StringUtils.hasText(components)) {
            return Collections.emptyList();
        }
        return Arrays.stream(components.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toList());
    }
}
