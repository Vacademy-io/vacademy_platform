package vacademy.io.community_service.feature.dashboardwidget.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;
import vacademy.io.community_service.feature.dashboardwidget.dto.DashboardWidgetDto;
import vacademy.io.community_service.feature.dashboardwidget.dto.UpsertWidgetRequest;
import vacademy.io.community_service.feature.dashboardwidget.entity.InstituteDashboardWidget;
import vacademy.io.community_service.feature.dashboardwidget.enums.WidgetStatus;
import vacademy.io.community_service.feature.dashboardwidget.enums.WidgetTargetType;
import vacademy.io.community_service.feature.dashboardwidget.enums.WidgetType;
import vacademy.io.community_service.feature.dashboardwidget.repository.InstituteDashboardWidgetRepository;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * CRUD for super-admin-managed dashboard widgets plus the institute-facing resolution. Mirrors the
 * support feature's jsonb handling: {@code payload}/{@code visibleRoles} are stored as jsonb strings
 * and (de)serialized here with Jackson.
 */
@Service
public class DashboardWidgetService {

    private static final TypeReference<List<String>> STRING_LIST = new TypeReference<>() {
    };
    private static final TypeReference<Map<String, Object>> OBJECT_MAP = new TypeReference<>() {
    };
    /** Default visibility when none is set — onboarding/info are admin-facing by nature. */
    private static final String DEFAULT_ROLE = "ADMIN";

    @Autowired
    private InstituteDashboardWidgetRepository widgetRepository;
    @Autowired
    private LeadTagResolver leadTagResolver;
    @Autowired
    private ObjectMapper objectMapper;

    // ---- super-admin authoring ---------------------------------------------------

    @Transactional(readOnly = true)
    public List<DashboardWidgetDto> listForInstitute(String instituteId) {
        return widgetRepository
                .findByTargetTypeAndTargetValueOrderByPositionAscCreatedAtAsc(WidgetTargetType.INSTITUTE, instituteId)
                .stream().map(this::toDto).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<DashboardWidgetDto> listForLeadTag(String leadTag) {
        return widgetRepository
                .findByTargetTypeAndTargetValueOrderByPositionAscCreatedAtAsc(WidgetTargetType.LEAD_TAG, normalizeTag(leadTag))
                .stream().map(this::toDto).collect(Collectors.toList());
    }

    @Transactional
    public DashboardWidgetDto create(UpsertWidgetRequest request, String createdByUserId) {
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Request body is required");
        }
        WidgetType type = WidgetType.fromName(request.getWidgetType());
        if (type == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "widgetType must be ONBOARDING_TRACKER or INFO_CARD");
        }
        if (!StringUtils.hasText(request.getTitle())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "title is required");
        }
        WidgetTargetType targetType = WidgetTargetType.fromName(request.getTargetType());
        String targetValue = resolveTargetValue(targetType, request.getTargetValue());
        enforceTargetTypeRules(type, targetType);

        InstituteDashboardWidget widget = InstituteDashboardWidget.builder()
                .widgetType(type)
                .targetType(targetType)
                .targetValue(targetValue)
                .title(request.getTitle().trim())
                .visibleRoles(writeRoles(request.getVisibleRoles()))
                .payload(writePayload(request.getPayload()))
                .status(WidgetStatus.fromName(request.getStatus()))
                .position(request.getPosition() != null ? request.getPosition() : 0)
                .createdBy(createdByUserId)
                .build();
        return toDto(widgetRepository.save(widget));
    }

    @Transactional
    public DashboardWidgetDto update(String id, UpsertWidgetRequest request) {
        InstituteDashboardWidget widget = widgetRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Widget not found: " + id));
        if (request == null) {
            return toDto(widget);
        }
        if (StringUtils.hasText(request.getTitle())) {
            widget.setTitle(request.getTitle().trim());
        }
        if (request.getVisibleRoles() != null) {
            widget.setVisibleRoles(writeRoles(request.getVisibleRoles()));
        }
        if (request.getPayload() != null) {
            widget.setPayload(writePayload(request.getPayload()));
        }
        if (StringUtils.hasText(request.getStatus())) {
            widget.setStatus(WidgetStatus.fromName(request.getStatus()));
        }
        if (request.getPosition() != null) {
            widget.setPosition(request.getPosition());
        }
        // Retargeting is allowed but must keep the LEAD_TAG-only-for-INFO_CARD invariant.
        if (StringUtils.hasText(request.getTargetType()) || StringUtils.hasText(request.getTargetValue())) {
            WidgetTargetType targetType = StringUtils.hasText(request.getTargetType())
                    ? WidgetTargetType.fromName(request.getTargetType()) : widget.getTargetType();
            String targetValue = StringUtils.hasText(request.getTargetValue())
                    ? resolveTargetValue(targetType, request.getTargetValue()) : widget.getTargetValue();
            enforceTargetTypeRules(widget.getWidgetType(), targetType);
            widget.setTargetType(targetType);
            widget.setTargetValue(targetValue);
        }
        return toDto(widgetRepository.save(widget));
    }

    @Transactional
    public void delete(String id) {
        if (!widgetRepository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Widget not found: " + id);
        }
        widgetRepository.deleteById(id);
    }

    @Transactional(readOnly = true)
    public InstituteDashboardWidget requireWidget(String id) {
        return widgetRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Widget not found: " + id));
    }

    // ---- institute read path -----------------------------------------------------

    /**
     * Published widgets visible to the caller: those targeting their institute directly plus those
     * broadcast to their lead-tag group, filtered to widgets whose visible roles intersect the
     * caller's roles (empty visible roles => ADMIN only).
     */
    @Transactional(readOnly = true)
    public List<DashboardWidgetDto> resolveForInstitute(String instituteId, Collection<String> callerRoles) {
        List<InstituteDashboardWidget> matched = new ArrayList<>(
                widgetRepository.findByTargetTypeAndTargetValueAndStatusOrderByPositionAscCreatedAtAsc(
                        WidgetTargetType.INSTITUTE, instituteId, WidgetStatus.PUBLISHED));

        String leadTag = leadTagResolver.resolve(instituteId);
        if (StringUtils.hasText(leadTag)) {
            matched.addAll(widgetRepository.findByTargetTypeAndTargetValueAndStatusOrderByPositionAscCreatedAtAsc(
                    WidgetTargetType.LEAD_TAG, normalizeTag(leadTag), WidgetStatus.PUBLISHED));
        }

        List<String> roles = callerRoles == null ? List.of()
                : callerRoles.stream().filter(StringUtils::hasText).map(r -> r.trim().toUpperCase())
                .collect(Collectors.toList());

        return matched.stream()
                .filter(w -> isVisibleToRoles(w, roles))
                .sorted((a, b) -> Integer.compare(a.getPosition(), b.getPosition()))
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    private boolean isVisibleToRoles(InstituteDashboardWidget widget, List<String> callerRoles) {
        List<String> visible = parseRoles(widget.getVisibleRoles());
        if (visible.isEmpty()) {
            visible = List.of(DEFAULT_ROLE);
        }
        return visible.stream().map(r -> r.trim().toUpperCase()).anyMatch(callerRoles::contains);
    }

    // ---- mapping / jsonb ---------------------------------------------------------

    public DashboardWidgetDto toDto(InstituteDashboardWidget w) {
        List<String> roles = parseRoles(w.getVisibleRoles());
        return DashboardWidgetDto.builder()
                .id(w.getId())
                .widgetType(w.getWidgetType() != null ? w.getWidgetType().name() : null)
                .targetType(w.getTargetType() != null ? w.getTargetType().name() : null)
                .targetValue(w.getTargetValue())
                .visibleRoles(roles.isEmpty() ? List.of(DEFAULT_ROLE) : roles)
                .title(w.getTitle())
                .payload(parsePayload(w.getPayload()))
                .status(w.getStatus() != null ? w.getStatus().name() : null)
                .position(w.getPosition())
                .createdAt(epoch(w.getCreatedAt()))
                .updatedAt(epoch(w.getUpdatedAt()))
                .build();
    }

    private void enforceTargetTypeRules(WidgetType type, WidgetTargetType targetType) {
        if (targetType == WidgetTargetType.LEAD_TAG && type == WidgetType.ONBOARDING_TRACKER) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "An onboarding tracker is per-institute and cannot target a lead-tag group");
        }
    }

    private String resolveTargetValue(WidgetTargetType targetType, String raw) {
        if (!StringUtils.hasText(raw)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "targetValue is required");
        }
        return targetType == WidgetTargetType.LEAD_TAG ? normalizeTag(raw) : raw.trim();
    }

    private String normalizeTag(String tag) {
        return tag == null ? null : tag.trim().toUpperCase();
    }

    private List<String> parseRoles(String json) {
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

    private String writeRoles(List<String> roles) {
        if (roles == null) {
            return null;
        }
        List<String> cleaned = roles.stream().filter(StringUtils::hasText).map(String::trim).distinct()
                .collect(Collectors.toList());
        try {
            return objectMapper.writeValueAsString(cleaned);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to serialize roles");
        }
    }

    private Map<String, Object> parsePayload(String json) {
        if (!StringUtils.hasText(json)) {
            return new LinkedHashMap<>();
        }
        try {
            Map<String, Object> parsed = objectMapper.readValue(json, OBJECT_MAP);
            return parsed != null ? parsed : new LinkedHashMap<>();
        } catch (Exception e) {
            return new LinkedHashMap<>();
        }
    }

    private String writePayload(Map<String, Object> payload) {
        try {
            return objectMapper.writeValueAsString(payload != null ? payload : new LinkedHashMap<>());
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to serialize payload");
        }
    }

    private Long epoch(Date date) {
        return date != null ? date.getTime() : null;
    }
}
