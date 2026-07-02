package vacademy.io.community_service.feature.dashboardwidget.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;
import vacademy.io.community_service.feature.dashboardwidget.dto.WidgetInteractionDto;
import vacademy.io.community_service.feature.dashboardwidget.entity.InstituteDashboardWidget;
import vacademy.io.community_service.feature.dashboardwidget.entity.InstituteWidgetInteraction;
import vacademy.io.community_service.feature.dashboardwidget.enums.InteractionType;
import vacademy.io.community_service.feature.dashboardwidget.enums.WidgetTargetType;
import vacademy.io.community_service.feature.dashboardwidget.repository.InstituteWidgetInteractionRepository;

import java.util.List;
import java.util.stream.Collectors;

/** Institute-side comments and milestone confirmations on a widget. */
@Service
public class WidgetInteractionService {

    @Autowired
    private InstituteWidgetInteractionRepository interactionRepository;
    @Autowired
    private DashboardWidgetService widgetService;

    @Transactional(readOnly = true)
    public List<WidgetInteractionDto> listForWidget(String widgetId) {
        return interactionRepository.findByWidgetIdOrderByCreatedAtAsc(widgetId).stream()
                .map(this::toDto).collect(Collectors.toList());
    }

    @Transactional
    public WidgetInteractionDto addComment(String widgetId, String instituteId, String userId, String userName,
                                           String message, String milestoneId) {
        if (!StringUtils.hasText(message)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "message is required for a comment");
        }
        InstituteDashboardWidget widget = widgetService.requireWidget(widgetId);
        assertInstituteOwnsWidget(widget, instituteId);
        return save(widgetId, instituteId, userId, userName, InteractionType.COMMENT, message.trim(), milestoneId);
    }

    @Transactional
    public WidgetInteractionDto confirmMilestone(String widgetId, String milestoneId, String instituteId,
                                                 String userId, String userName, String message) {
        if (!StringUtils.hasText(milestoneId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "milestoneId is required");
        }
        InstituteDashboardWidget widget = widgetService.requireWidget(widgetId);
        assertInstituteOwnsWidget(widget, instituteId);
        return save(widgetId, instituteId, userId, userName, InteractionType.CONFIRM,
                StringUtils.hasText(message) ? message.trim() : null, milestoneId);
    }

    /**
     * A widget belongs to the caller's institute if it targets that institute directly, or is a
     * lead-tag broadcast (interaction on broadcasts is still scoped by the recorded institute_id).
     */
    private void assertInstituteOwnsWidget(InstituteDashboardWidget widget, String instituteId) {
        if (widget.getTargetType() == WidgetTargetType.INSTITUTE
                && !widget.getTargetValue().equals(instituteId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Widget does not belong to this institute");
        }
    }

    private WidgetInteractionDto save(String widgetId, String instituteId, String userId, String userName,
                                      InteractionType type, String message, String milestoneId) {
        InstituteWidgetInteraction interaction = InstituteWidgetInteraction.builder()
                .widgetId(widgetId)
                .milestoneId(milestoneId)
                .interactionType(type)
                .message(message)
                .userId(userId)
                .userName(userName)
                .instituteId(instituteId)
                .build();
        return toDto(interactionRepository.save(interaction));
    }

    private WidgetInteractionDto toDto(InstituteWidgetInteraction i) {
        return WidgetInteractionDto.builder()
                .id(i.getId())
                .widgetId(i.getWidgetId())
                .milestoneId(i.getMilestoneId())
                .interactionType(i.getInteractionType() != null ? i.getInteractionType().name() : null)
                .message(i.getMessage())
                .userId(i.getUserId())
                .userName(i.getUserName())
                .instituteId(i.getInstituteId())
                .createdAt(i.getCreatedAt() != null ? i.getCreatedAt().getTime() : null)
                .build();
    }
}
