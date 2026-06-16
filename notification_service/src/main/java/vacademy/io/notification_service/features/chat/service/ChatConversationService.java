package vacademy.io.notification_service.features.chat.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import vacademy.io.notification_service.features.announcements.client.AdminCoreServiceClient;
import vacademy.io.notification_service.features.announcements.dto.AnnouncementEvent;
import vacademy.io.notification_service.features.announcements.enums.EventType;
import vacademy.io.notification_service.features.announcements.enums.ModeType;
import vacademy.io.notification_service.features.chat.dto.*;
import vacademy.io.notification_service.features.chat.entity.ChatConversation;
import vacademy.io.notification_service.features.chat.entity.ChatConversationMember;
import vacademy.io.notification_service.features.chat.entity.ChatMessage;
import vacademy.io.notification_service.features.chat.enums.ChatConversationType;
import vacademy.io.notification_service.features.chat.enums.ChatMemberRole;
import vacademy.io.notification_service.features.chat.event.ChatFanoutEvent;
import vacademy.io.notification_service.features.chat.repository.ChatConversationMemberRepository;
import vacademy.io.notification_service.features.chat.repository.ChatConversationRepository;
import vacademy.io.notification_service.features.chat.repository.ChatMessageRepository;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class ChatConversationService {

    private final ChatConversationRepository convRepo;
    private final ChatConversationMemberRepository memberRepo;
    private final ChatMessageRepository messageRepo;
    private final AdminCoreServiceClient adminCoreServiceClient;
    private final ChatPermissionService permissionService;
    private final ChatRulesService rulesService;
    private final ApplicationEventPublisher eventPublisher;
    private final ObjectMapper objectMapper;

    private static final long UNREAD_CAP = 100L;

    // ---------------------------------------------------------------------
    // Provisioning
    // ---------------------------------------------------------------------

    @Transactional
    public ChatConversation findOrCreateDirect(String instituteId, String callerId, String callerRole, String callerName,
                                               StartDirectRequest req) {
        if (!permissionService.isChatEnabled(instituteId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "CHAT_DISABLED");
        }
        String targetId = req.getTargetUserId();
        if (targetId == null || targetId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "TARGET_REQUIRED");
        }
        if (targetId.equals(callerId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "CANNOT_DM_SELF");
        }
        if (!permissionService.canDirectMessage(instituteId, callerRole, req.getTargetUserRole())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "DM_NOT_ALLOWED");
        }

        String pairKey = pairKey(callerId, targetId);
        Optional<ChatConversation> existing = convRepo.findByInstituteIdAndTypeAndPairKey(
                instituteId, ChatConversationType.DIRECT.name(), pairKey);
        if (existing.isPresent()) {
            return existing.get();
        }

        // saveAndFlush forces the partial-unique-index check NOW so a concurrent create throws
        // DataIntegrityViolationException here (not at commit). The exception poisons this transaction,
        // so recovery is NOT attempted inline — it propagates and the controller retries get-or-create,
        // which then finds the winner's row. See ChatConversationController.provisionWithRetry.
        ChatConversation conv = ChatConversation.builder()
                .type(ChatConversationType.DIRECT.name())
                .instituteId(instituteId)
                .pairKey(pairKey)
                .createdBy(callerId)
                .isActive(true)
                .lastMessageSeq(0L)
                .rulesVersion(0)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();
        conv = convRepo.saveAndFlush(conv);
        saveMember(conv.getId(), callerId, ChatPermissionService.normalizeRole(callerRole).toUpperCase(), ChatMemberRole.MEMBER);
        saveMember(conv.getId(), targetId, ChatPermissionService.normalizeRole(req.getTargetUserRole()).toUpperCase(), ChatMemberRole.MEMBER);
        return conv;
    }

    @Transactional
    public ChatConversation getOrProvisionBatch(String instituteId, String packageSessionId,
                                                String callerId, String callerRole, String callerName) {
        if (!permissionService.isChatEnabled(instituteId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "CHAT_DISABLED");
        }
        Optional<ChatConversation> existing = convRepo.findByInstituteIdAndTypeAndReferenceId(
                instituteId, ChatConversationType.BATCH_GROUP.name(), packageSessionId);
        ChatConversation conv;
        if (existing.isPresent()) {
            conv = existing.get();
        } else {
            // saveAndFlush surfaces a concurrent-create unique violation here; it propagates and the
            // controller retries get-or-create (then takes the existing branch). See provisionWithRetry.
            conv = ChatConversation.builder()
                    .type(ChatConversationType.BATCH_GROUP.name())
                    .instituteId(instituteId)
                    .referenceId(packageSessionId)
                    .createdBy(callerId)
                    .isActive(true)
                    .lastMessageSeq(0L)
                    .rulesVersion(0)
                    .createdAt(LocalDateTime.now())
                    .updatedAt(LocalDateTime.now())
                    .build();
            conv = convRepo.saveAndFlush(conv);
            materializeBatchMembers(conv.getId(), packageSessionId);
        }
        // Caller must belong to the batch; admins are granted access on demand.
        if (!memberRepo.existsByConversationIdAndUserIdAndIsActiveTrue(conv.getId(), callerId)) {
            if ("admin".equals(ChatPermissionService.normalizeRole(callerRole))) {
                ensureMember(conv, callerId, callerRole, ChatMemberRole.MODERATOR);
            } else {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "NOT_A_MEMBER");
            }
        }
        return conv;
    }

    @Transactional
    public ChatConversation getOrProvisionCommunity(String instituteId, String callerId, String callerRole, String callerName) {
        if (!permissionService.isChatEnabled(instituteId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "CHAT_DISABLED");
        }
        Optional<ChatConversation> existing = convRepo.findByInstituteIdAndType(instituteId, ChatConversationType.COMMUNITY.name());
        ChatConversation conv;
        if (existing.isPresent()) {
            conv = existing.get();
        } else {
            // saveAndFlush surfaces a concurrent-create unique violation here; it propagates and the
            // controller retries get-or-create (then takes the existing branch). See provisionWithRetry.
            conv = ChatConversation.builder()
                    .type(ChatConversationType.COMMUNITY.name())
                    .instituteId(instituteId)
                    .title("Community")
                    .createdBy(callerId)
                    .isActive(true)
                    .lastMessageSeq(0L)
                    .rulesVersion(0)
                    .createdAt(LocalDateTime.now())
                    .updatedAt(LocalDateTime.now())
                    .build();
            conv = convRepo.saveAndFlush(conv);
        }
        // Lazy member row for read-cursor + rules-acknowledgement state. Admins moderate by default.
        ChatMemberRole role = "admin".equals(ChatPermissionService.normalizeRole(callerRole))
                ? ChatMemberRole.MODERATOR : ChatMemberRole.MEMBER;
        ensureMember(conv, callerId, callerRole, role);
        return conv;
    }

    private void materializeBatchMembers(String conversationId, String packageSessionId) {
        // Only ever called right after the conversation is first created, so it has no member rows yet:
        // skip the per-user pre-SELECT and bulk-insert the whole resolved roster in one round-trip.
        Map<String, String> roleByUser = resolveBatchMembers(packageSessionId);
        if (roleByUser.isEmpty()) {
            return;
        }
        List<ChatConversationMember> rows = new ArrayList<>(roleByUser.size());
        for (Map.Entry<String, String> e : roleByUser.entrySet()) {
            rows.add(newMember(conversationId, e.getKey(), e.getValue(), ChatMemberRole.MEMBER));
        }
        memberRepo.saveAll(rows);
    }

    /** Resolve a batch (package session) into userId -> normalized role. Faculty wins over student. */
    public Map<String, String> resolveBatchMembers(String packageSessionId) {
        Map<String, String> map = new HashMap<>();
        try {
            adminCoreServiceClient.getStudentsByPackageSessions(List.of(packageSessionId))
                    .forEach(id -> map.put(id, "STUDENT"));
            adminCoreServiceClient.getFacultyByPackageSessions(List.of(packageSessionId))
                    .forEach(id -> map.put(id, "TEACHER"));
        } catch (Exception e) {
            log.warn("Failed to resolve batch members for {}: {}", packageSessionId, e.getMessage());
        }
        return map;
    }

    public ChatConversationMember ensureMember(ChatConversation conv, String userId, String userRole, ChatMemberRole memberRole) {
        Optional<ChatConversationMember> existing = memberRepo.findByConversationIdAndUserId(conv.getId(), userId);
        if (existing.isPresent()) {
            ChatConversationMember m = existing.get();
            if (!Boolean.TRUE.equals(m.getIsActive())) {
                m.setIsActive(true);
                memberRepo.save(m);
            }
            return m;
        }
        return saveMember(conv.getId(), userId, ChatPermissionService.normalizeRole(userRole).toUpperCase(), memberRole);
    }

    private ChatConversationMember saveMember(String conversationId, String userId, String userRole, ChatMemberRole memberRole) {
        return memberRepo.save(newMember(conversationId, userId, userRole, memberRole));
    }

    private ChatConversationMember newMember(String conversationId, String userId, String userRole, ChatMemberRole memberRole) {
        return ChatConversationMember.builder()
                .conversationId(conversationId)
                .userId(userId)
                .userRole(userRole)
                .memberRole(memberRole.name())
                .lastReadSeq(0L)
                .muted(false)
                .isActive(true)
                .rulesAcknowledgedVersion(0)
                .joinedAt(LocalDateTime.now())
                .build();
    }

    // ---------------------------------------------------------------------
    // Listing
    // ---------------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<ChatConversationResponse> listConversations(String userId, String instituteId, String callerRole,
                                                            String typeFilter, int limit) {
        if (!permissionService.isChatEnabled(instituteId)) {
            // Chat is off for this institute — surface a clean "disabled" state on the FE rather than
            // a stale list (old conversations from a previously-enabled period stay hidden).
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "CHAT_DISABLED");
        }
        List<ChatConversationMember> myMembers = memberRepo.findByUserIdAndIsActiveTrue(userId);
        Map<String, ChatConversationMember> memberByConv = myMembers.stream()
                .collect(Collectors.toMap(ChatConversationMember::getConversationId, m -> m, (a, b) -> a));

        List<String> convIds = new ArrayList<>(memberByConv.keySet());
        List<ChatConversation> convs = convIds.isEmpty()
                ? new ArrayList<>()
                : new ArrayList<>(convRepo.findByIdInOrderByLastMessageAtDesc(convIds));

        // Always surface the institute community channel, even if not yet opened.
        convRepo.findByInstituteIdAndType(instituteId, ChatConversationType.COMMUNITY.name())
                .ifPresent(community -> {
                    if (convs.stream().noneMatch(c -> c.getId().equals(community.getId()))) {
                        convs.add(community);
                    }
                });

        List<ChatConversation> visible = convs.stream()
                .filter(c -> instituteId.equals(c.getInstituteId()))
                .filter(c -> typeFilter == null || typeFilter.equalsIgnoreCase(c.getType()))
                .sorted(Comparator.comparing(ChatConversation::getLastMessageAt,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .limit(limit <= 0 ? 30 : limit)
                .collect(Collectors.toList());

        // Fetch every active member of the visible page in ONE query, grouped by conversation,
        // so mapConversation never has to look up DIRECT participants per-row.
        List<String> visibleIds = visible.stream().map(ChatConversation::getId).collect(Collectors.toList());
        Map<String, List<ChatConversationMember>> activeByConv = visibleIds.isEmpty()
                ? Collections.emptyMap()
                : memberRepo.findByConversationIdInAndIsActiveTrue(visibleIds).stream()
                        .collect(Collectors.groupingBy(ChatConversationMember::getConversationId));

        return visible.stream()
                .map(c -> mapConversation(c, userId, callerRole, memberByConv.get(c.getId()),
                        activeByConv.getOrDefault(c.getId(), Collections.emptyList())))
                .collect(Collectors.toList());
    }

    public ChatConversationResponse mapConversation(ChatConversation c, String callerId, String callerRole,
                                                    ChatConversationMember callerMember) {
        // Self-contained path (describe): resolve active members for this single conversation lazily.
        List<ChatConversationMember> activeMembers = ChatConversationType.DIRECT.name().equals(c.getType())
                ? memberRepo.findByConversationIdAndIsActiveTrue(c.getId())
                : Collections.emptyList();
        return mapConversation(c, callerId, callerRole, callerMember, activeMembers);
    }

    public ChatConversationResponse mapConversation(ChatConversation c, String callerId, String callerRole,
                                                    ChatConversationMember callerMember,
                                                    List<ChatConversationMember> activeMembers) {
        // Unread is pure arithmetic off the denormalized counters — zero queries, capped.
        long lastSeq = c.getLastMessageSeq() == null ? 0L : c.getLastMessageSeq();
        long readSeq = callerMember == null || callerMember.getLastReadSeq() == null ? 0L : callerMember.getLastReadSeq();
        long unread = Math.max(0, Math.min(UNREAD_CAP, lastSeq - readSeq));

        String otherUserId = null;
        boolean canPost;
        if (ChatConversationType.DIRECT.name().equals(c.getType())) {
            ChatConversationMember other = activeMembers.stream()
                    .filter(m -> !m.getUserId().equals(callerId)).findFirst().orElse(null);
            otherUserId = other != null ? other.getUserId() : null;
            canPost = permissionService.canDirectMessage(c.getInstituteId(), callerRole, other != null ? other.getUserRole() : null);
        } else if (ChatConversationType.BATCH_GROUP.name().equals(c.getType())) {
            canPost = permissionService.canPostToBatch(c.getInstituteId(), callerRole);
        } else {
            canPost = permissionService.canPostToCommunity(c.getInstituteId(), callerRole);
        }

        return ChatConversationResponse.builder()
                .id(c.getId())
                .type(c.getType())
                .instituteId(c.getInstituteId())
                .referenceId(c.getReferenceId())
                .title(c.getTitle())
                .otherUserId(otherUserId)
                .lastMessagePreview(c.getLastMessagePreview())
                .lastMessageSenderId(c.getLastMessageSenderId())
                .lastMessageAt(c.getLastMessageAt())
                .lastMessageSeq(c.getLastMessageSeq())
                .unreadCount(unread)
                .memberRole(callerMember != null ? callerMember.getMemberRole() : null)
                .rulesVersion(c.getRulesVersion())
                .canPost(canPost)
                .build();
    }

    // ---------------------------------------------------------------------
    // Read state
    // ---------------------------------------------------------------------

    @Transactional
    public void markRead(String conversationId, String userId, String upToMessageId) {
        ChatConversation conv = getConversationOrThrow(conversationId);
        ChatConversationMember member = memberRepo.findByConversationIdAndUserId(conversationId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "NOT_A_MEMBER"));

        long fallbackSeq = conv.getLastMessageSeq() == null ? 0L : conv.getLastMessageSeq();
        long targetSeq;
        if (upToMessageId != null && !upToMessageId.isBlank()) {
            // Scope the cursor to THIS conversation — seq is per-conversation, so a messageId from a
            // different (busier) conversation must not inject a foreign seq into the read cursor.
            targetSeq = messageRepo.findById(upToMessageId)
                    .filter(m -> conversationId.equals(m.getConversationId()))
                    .map(ChatMessage::getSeq)
                    .orElse(fallbackSeq);
        } else {
            targetSeq = fallbackSeq;
        }

        if (member.getLastReadSeq() == null || targetSeq > member.getLastReadSeq()) {
            member.setLastReadSeq(targetSeq);
            member.setLastReadMessageId(upToMessageId);
            member.setLastReadAt(LocalDateTime.now());
            memberRepo.save(member);

            // Read receipts only matter for DIRECT (and small batch); skip community fan-out.
            if (!ChatConversationType.COMMUNITY.name().equals(conv.getType())) {
                List<String> others = memberRepo.findByConversationIdAndIsActiveTrue(conversationId).stream()
                        .map(ChatConversationMember::getUserId)
                        .filter(id -> !id.equals(userId))
                        .collect(Collectors.toList());
                AnnouncementEvent event = AnnouncementEvent.builder()
                        .type(EventType.CHAT_READ)
                        .modeType(ModeType.CHAT)
                        .instituteId(conv.getInstituteId())
                        .data(ChatMessagePayload.builder()
                                .conversationId(conversationId)
                                .conversationType(conv.getType())
                                .readerUserId(userId)
                                .lastReadSeq(targetSeq)
                                .build())
                        .timestamp(LocalDateTime.now())
                        .eventId("chatread_" + conversationId + "_" + userId + "_" + targetSeq)
                        .build();
                eventPublisher.publishEvent(new ChatFanoutEvent(conv.getInstituteId(), conv.getType(), others, event));
            }
        }
    }

    // ---------------------------------------------------------------------
    // Rules
    // ---------------------------------------------------------------------

    @Transactional(readOnly = true)
    public ChatRulesResponse getRules(String conversationId, String userId) {
        ChatConversation conv = getConversationOrThrow(conversationId);
        ChatConversationMember member = memberRepo.findByConversationIdAndUserId(conversationId, userId).orElse(null);
        return ChatRulesResponse.builder()
                .rules(rulesService.getEffectiveRules(conv))
                .currentVersion(conv.getRulesVersion() == null ? 0 : conv.getRulesVersion())
                .acknowledged(rulesService.hasAcknowledged(conv, member))
                .isOverride(rulesService.isOverride(conv))
                .canEdit(isModerator(member))
                .build();
    }

    @Transactional
    public ChatRulesResponse updateRules(String conversationId, String userId, ChatRulesDto rules) {
        ChatConversation conv = getConversationOrThrow(conversationId);
        ChatConversationMember member = memberRepo.findByConversationIdAndUserId(conversationId, userId).orElse(null);
        if (!isModerator(member)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "NOT_A_MODERATOR");
        }
        @SuppressWarnings("unchecked")
        Map<String, Object> rulesMap = objectMapper.convertValue(rules, Map.class);
        conv.setRules(rulesMap);
        conv.setRulesVersion((conv.getRulesVersion() == null ? 0 : conv.getRulesVersion()) + 1);
        convRepo.save(conv);
        return getRules(conversationId, userId);
    }

    @Transactional
    public ChatRulesResponse acknowledgeRules(String conversationId, String userId, String userRole, String userName) {
        ChatConversation conv = getConversationOrThrow(conversationId);
        ChatConversationMember member = ensureMember(conv, userId, userRole,
                "admin".equals(ChatPermissionService.normalizeRole(userRole)) ? ChatMemberRole.MODERATOR : ChatMemberRole.MEMBER);
        member.setRulesAcknowledgedVersion(conv.getRulesVersion() == null ? 0 : conv.getRulesVersion());
        member.setRulesAcknowledgedAt(LocalDateTime.now());
        memberRepo.save(member);
        return getRules(conversationId, userId);
    }

    // ---------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------

    @Transactional(readOnly = true)
    public ChatConversationResponse describe(ChatConversation conv, String userId, String userRole) {
        ChatConversationMember member = memberRepo.findByConversationIdAndUserId(conv.getId(), userId).orElse(null);
        return mapConversation(conv, userId, userRole, member);
    }

    public ChatConversation getConversationOrThrow(String conversationId) {
        return convRepo.findById(conversationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "CONVERSATION_NOT_FOUND"));
    }

    public List<String> getActiveMemberIds(String conversationId) {
        return memberRepo.findActiveMemberIds(conversationId);
    }

    private boolean isModerator(ChatConversationMember member) {
        return member != null && (ChatMemberRole.MODERATOR.name().equals(member.getMemberRole())
                || ChatMemberRole.OWNER.name().equals(member.getMemberRole()));
    }

    private String pairKey(String a, String b) {
        return a.compareTo(b) <= 0 ? a + "::" + b : b + "::" + a;
    }
}
