package vacademy.io.notification_service.features.chat.event;

import lombok.AllArgsConstructor;
import lombok.Getter;
import vacademy.io.notification_service.features.announcements.dto.AnnouncementEvent;

import java.util.List;

/**
 * Published after a chat write commits; consumed by ChatFanoutService to push over SSE.
 * For DIRECT/BATCH_GROUP, memberUserIds holds the recipients. For COMMUNITY it is null/empty
 * and the listener broadcasts to all online institute users instead.
 */
@Getter
@AllArgsConstructor
public class ChatFanoutEvent {
    private final String instituteId;
    private final String conversationType;
    private final List<String> memberUserIds;
    private final AnnouncementEvent event;
}
