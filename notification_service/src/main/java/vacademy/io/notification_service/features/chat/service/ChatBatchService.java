package vacademy.io.notification_service.features.chat.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import vacademy.io.notification_service.features.announcements.client.AdminCoreServiceClient;
import vacademy.io.notification_service.features.chat.dto.ChatBatchResponse;
import vacademy.io.notification_service.features.chat.dto.ChatBatchSearchResponse;
import vacademy.io.notification_service.features.chat.entity.ChatConversation;
import vacademy.io.notification_service.features.chat.enums.ChatConversationType;
import vacademy.io.notification_service.features.chat.repository.ChatConversationRepository;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

/**
 * "Find a batch to message" — backs the chat search box's batch results and the "start a new batch
 * conversation" flow. Role-scoped: an admin can search every batch in the institute; a teacher only
 * their faculty-mapped batches; students get nothing here (their enrolled batches already list).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ChatBatchService {

    private final ChatPermissionService permissionService;
    private final AdminCoreServiceClient adminCoreServiceClient;
    private final ChatConversationRepository convRepo;

    public ChatBatchSearchResponse search(String instituteId, String callerId, String callerRole,
                                          String nameQuery, int pageSize) {
        if (!permissionService.isChatEnabled(instituteId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "CHAT_DISABLED");
        }
        String role = ChatPermissionService.normalizeRole(callerRole);

        List<String> scopeIds; // null = all institute batches (admin); a list scopes to those ids (teacher)
        if ("admin".equals(role)) {
            scopeIds = null;
        } else if ("teacher".equals(role)) {
            scopeIds = adminCoreServiceClient.getFacultyPackageSessions(callerId, instituteId);
            if (scopeIds == null || scopeIds.isEmpty()) {
                return emptyResponse();
            }
        } else {
            return emptyResponse(); // students don't start batch conversations
        }

        int size = pageSize <= 0 ? 30 : Math.min(pageSize, 50);
        List<Map<String, String>> found = adminCoreServiceClient.searchBatches(instituteId, nameQuery, scopeIds, size);
        if (found == null || found.isEmpty()) {
            return emptyResponse();
        }

        List<String> packageSessionIds = found.stream()
                .map(m -> m.get("packageSessionId")).filter(Objects::nonNull).collect(Collectors.toList());

        // Which of these batches already have a conversation (so the FE can show/open it directly).
        Map<String, String> convIdByRef = packageSessionIds.isEmpty()
                ? Map.of()
                : convRepo.findByInstituteIdAndTypeAndReferenceIdInAndIsActiveTrue(
                                instituteId, ChatConversationType.BATCH_GROUP.name(), packageSessionIds).stream()
                        .filter(c -> c.getReferenceId() != null)
                        .collect(Collectors.toMap(ChatConversation::getReferenceId, ChatConversation::getId, (a, b) -> a));

        List<ChatBatchResponse> batches = new ArrayList<>(found.size());
        for (Map<String, String> m : found) {
            String psId = m.get("packageSessionId");
            if (psId == null) continue;
            batches.add(ChatBatchResponse.builder()
                    .packageSessionId(psId)
                    .name(m.get("name"))
                    .conversationId(convIdByRef.get(psId))
                    .build());
        }

        ChatBatchSearchResponse resp = new ChatBatchSearchResponse();
        resp.setBatches(batches);
        return resp;
    }

    private ChatBatchSearchResponse emptyResponse() {
        ChatBatchSearchResponse resp = new ChatBatchSearchResponse();
        resp.setBatches(List.of());
        return resp;
    }
}
