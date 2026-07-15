package vacademy.io.community_service.feature.support.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.community_service.feature.support.dto.AddMessageRequest;
import vacademy.io.community_service.feature.support.dto.AssignEngineerRequest;
import vacademy.io.community_service.feature.support.dto.AttachmentDto;
import vacademy.io.community_service.feature.support.dto.CreateSupportTicketRequest;
import vacademy.io.community_service.feature.support.dto.CreateTicketRequest;
import vacademy.io.community_service.feature.support.dto.PageResponseDto;
import vacademy.io.community_service.feature.support.dto.SupportTicketDto;
import vacademy.io.community_service.feature.support.dto.SupportTicketMessageDto;
import vacademy.io.community_service.feature.support.dto.UpdateTicketStatusRequest;
import vacademy.io.community_service.feature.support.entity.SupportEngineer;
import vacademy.io.community_service.feature.support.entity.SupportTicket;
import vacademy.io.community_service.feature.support.entity.SupportTicketMessage;
import vacademy.io.community_service.feature.support.enums.SenderType;
import vacademy.io.community_service.feature.support.enums.SupportPlan;
import vacademy.io.community_service.feature.support.enums.TicketCategory;
import vacademy.io.community_service.feature.support.enums.TicketPriority;
import vacademy.io.community_service.feature.support.enums.TicketSource;
import vacademy.io.community_service.feature.support.enums.TicketStatus;
import vacademy.io.community_service.feature.support.repository.SupportTicketMessageRepository;
import vacademy.io.community_service.feature.support.repository.SupportTicketRepository;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class SupportTicketService {

    private static final long HOUR_MS = 3_600_000L;
    private static final int MAX_ATTACHMENTS = 10;
    private static final int MAX_ATTACHMENT_FIELD_LEN = 2048;
    private static final int MAX_CONTEXT_KEYS = 50;
    private static final int MAX_CONTEXT_JSON_LEN = 16384;
    private static final TypeReference<List<AttachmentDto>> ATTACHMENT_LIST = new TypeReference<>() {
    };

    @Autowired
    private SupportTicketRepository ticketRepository;
    @Autowired
    private SupportTicketMessageRepository messageRepository;
    @Autowired
    private SupportConfigService configService;
    @Autowired
    private SupportEngineerService engineerService;
    @Autowired
    private SupportAlertService alertService;
    @Autowired
    private ObjectMapper objectMapper;

    // ============================ INSTITUTE (ADMIN) ============================

    @Transactional
    public SupportTicketDto createTicket(String instituteId, String instituteName, String raiserUserId,
                                         String raiserName, String raiserEmail, String raisedByRole,
                                         Map<String, Object> clientContext, CreateTicketRequest request) {
        if (request == null || !StringUtils.hasText(request.getSubject())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "subject is required");
        }
        if (!StringUtils.hasText(request.getMessage())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "message is required");
        }

        SupportPlan plan = configService.resolvePlan(instituteId);
        TicketPriority priority = TicketPriority.fromName(request.getPriority(), TicketPriority.MINOR);
        TicketCategory category = TicketCategory.fromName(request.getCategory(), TicketCategory.QUESTION);
        Date now = new Date();

        SupportTicket ticket = SupportTicket.builder()
                .instituteId(instituteId)
                .instituteName(instituteName)
                .raisedByUserId(raiserUserId)
                .raisedByName(raiserName)
                .raisedByEmail(raiserEmail)
                .raisedByRole(raisedByRole)
                .subject(request.getSubject().trim())
                .category(category)
                .priority(priority)
                .status(TicketStatus.OPEN)
                .planAtCreation(plan)
                .source(TicketSource.PORTAL)
                .firstResponseDueAt(computeDue(now, plan, priority))
                .lastMessageAt(now)
                .messageCount(1)
                .clientContext(writeClientContext(clientContext))
                .build();
        ticket = ticketRepository.save(ticket);

        SupportTicketMessage first = SupportTicketMessage.builder()
                .ticketId(ticket.getId())
                .senderType(SenderType.CUSTOMER)
                .senderUserId(ticket.getRaisedByUserId())
                .senderName(ticket.getRaisedByName())
                .body(request.getMessage().trim())
                .attachments(writeAttachments(request.getAttachments()))
                .internalNote(false)
                .build();
        messageRepository.save(first);

        alertService.onNewTicket(ticket, request.getMessage().trim(),
                configService.resolveAlertEmails(instituteId));

        return toDetailDto(ticket, false);
    }

    @Transactional(readOnly = true)
    public PageResponseDto<SupportTicketDto> listForInstitute(String instituteId, String statusFilter,
                                                              Pageable pageable) {
        TicketStatus status = TicketStatus.fromName(statusFilter, null);
        Page<SupportTicket> page = (status == null)
                ? ticketRepository.findByInstituteIdOrderByLastMessageAtDesc(instituteId, pageable)
                : ticketRepository.findByInstituteIdAndStatusOrderByLastMessageAtDesc(instituteId, status, pageable);
        Map<String, String> names = engineerNames(page);
        return PageResponseDto.of(page, t -> toSummaryDto(t, names));
    }

    @Transactional(readOnly = true)
    public SupportTicketDto getForInstitute(String instituteId, String ticketId) {
        SupportTicket ticket = getOrThrow(ticketId);
        requireInstitute(ticket, instituteId);
        return toDetailDto(ticket, false);
    }

    @Transactional
    public SupportTicketDto addCustomerMessage(String instituteId, String ticketId, CustomUserDetails user,
                                               AddMessageRequest request) {
        SupportTicket ticket = getOrThrow(ticketId);
        requireInstitute(ticket, instituteId);
        if (request == null || !StringUtils.hasText(request.getBody())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "body is required");
        }
        Date now = new Date();

        SupportTicketMessage message = SupportTicketMessage.builder()
                .ticketId(ticket.getId())
                .senderType(SenderType.CUSTOMER)
                .senderUserId(user != null ? user.getUserId() : ticket.getRaisedByUserId())
                .senderName(user != null ? user.getFullName() : ticket.getRaisedByName())
                .body(request.getBody().trim())
                .attachments(writeAttachments(request.getAttachments()))
                .internalNote(false)
                .build();
        messageRepository.save(message);

        // A customer reply reopens a closed ticket and brings a waiting ticket back to us.
        if (ticket.getStatus().isTerminal()) {
            ticket.setStatus(TicketStatus.OPEN);
            ticket.setResolvedAt(null);
        } else if (ticket.getStatus() == TicketStatus.WAITING_ON_CUSTOMER) {
            ticket.setStatus(TicketStatus.IN_PROGRESS);
        }
        ticket.setLastMessageAt(now);
        ticket.setMessageCount(ticket.getMessageCount() + 1);
        ticketRepository.save(ticket);

        return toDetailDto(ticket, false);
    }

    @Transactional
    public SupportTicketDto setStatusByCustomer(String instituteId, String ticketId, String statusFilter) {
        SupportTicket ticket = getOrThrow(ticketId);
        requireInstitute(ticket, instituteId);
        TicketStatus target = TicketStatus.fromName(statusFilter, null);
        // Customers may only resolve/close or reopen their own ticket.
        if (target != TicketStatus.RESOLVED && target != TicketStatus.CLOSED && target != TicketStatus.OPEN) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported status change");
        }
        applyStatus(ticket, target);
        ticketRepository.save(ticket);
        return toDetailDto(ticket, false);
    }

    // ============================== SUPER-ADMIN ===============================

    /**
     * The support team logs a ticket on an institute's behalf (issue reported over email / WhatsApp,
     * etc.). Attributed to "Vacademy Support" but attached to the chosen institute, so it surfaces in
     * that institute's own support panel like any client-raised ticket. The opening message is a
     * visible SUPPORT message carrying the reported issue text; because support is already engaged we
     * stamp firstRespondedAt so it is never flagged overdue against a first-response SLA.
     */
    @Transactional
    public SupportTicketDto createBySupport(CreateSupportTicketRequest request, CustomUserDetails user) {
        if (request == null || !StringUtils.hasText(request.getInstituteId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "instituteId is required");
        }
        if (!StringUtils.hasText(request.getSubject())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "subject is required");
        }
        if (!StringUtils.hasText(request.getMessage())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "message is required");
        }
        String instituteId = request.getInstituteId().trim();
        SupportPlan plan = configService.resolvePlan(instituteId);
        TicketPriority priority = TicketPriority.fromName(request.getPriority(), TicketPriority.MINOR);
        TicketCategory category = TicketCategory.fromName(request.getCategory(), TicketCategory.QUESTION);
        TicketSource source = TicketSource.fromName(request.getSource(), TicketSource.MANUAL);
        Date now = new Date();

        String engineerId = null;
        if (StringUtils.hasText(request.getAssignedEngineerId())) {
            engineerId = engineerService.getOrThrow(request.getAssignedEngineerId().trim()).getId();
        }

        SupportTicket ticket = SupportTicket.builder()
                .instituteId(instituteId)
                .instituteName(StringUtils.hasText(request.getInstituteName()) ? request.getInstituteName().trim() : null)
                .raisedByUserId(user != null ? user.getUserId() : null)
                .raisedByName("Vacademy Support")
                .raisedByRole("SUPPORT")
                .subject(request.getSubject().trim())
                .category(category)
                .priority(priority)
                .status(TicketStatus.OPEN)
                .planAtCreation(plan)
                .source(source)
                .eta(request.getEta())
                .assignedEngineerId(engineerId)
                // support authored the first message → treat first response as already given (no SLA clock).
                .firstRespondedAt(now)
                .lastMessageAt(now)
                .messageCount(1)
                .build();
        ticket = ticketRepository.save(ticket);

        SupportTicketMessage first = SupportTicketMessage.builder()
                .ticketId(ticket.getId())
                .senderType(SenderType.SUPPORT)
                .senderUserId(user != null ? user.getUserId() : null)
                .senderName(user != null && StringUtils.hasText(user.getFullName()) ? user.getFullName() : "Vacademy Support")
                .body(request.getMessage().trim())
                .attachments(writeAttachments(request.getAttachments()))
                .internalNote(false)
                .build();
        messageRepository.save(first);

        return toDetailDto(ticket, true);
    }

    @Transactional
    public SupportTicketDto setEta(String ticketId, Date eta) {
        SupportTicket ticket = getOrThrow(ticketId);
        ticket.setEta(eta);
        ticketRepository.save(ticket);
        return toDetailDto(ticket, true);
    }

    @Transactional(readOnly = true)
    public PageResponseDto<SupportTicketDto> search(String instituteId, String statusFilter, String engineerId,
                                                    boolean onlyOverdue, Pageable pageable) {
        TicketStatus status = TicketStatus.fromName(statusFilter, null);
        Page<SupportTicket> page = ticketRepository.searchTickets(
                StringUtils.hasText(instituteId) ? instituteId : null,
                status,
                StringUtils.hasText(engineerId) ? engineerId : null,
                onlyOverdue,
                new Date(),
                pageable);
        Map<String, String> names = engineerNames(page);
        return PageResponseDto.of(page, t -> toSummaryDto(t, names));
    }

    @Transactional(readOnly = true)
    public SupportTicketDto getByIdForSupport(String ticketId) {
        return toDetailDto(getOrThrow(ticketId), true);
    }

    @Transactional
    public SupportTicketDto addSupportMessage(String ticketId, CustomUserDetails user, AddMessageRequest request) {
        SupportTicket ticket = getOrThrow(ticketId);
        if (request == null || !StringUtils.hasText(request.getBody())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "body is required");
        }
        boolean internal = request.isInternalNote();
        Date now = new Date();

        SupportTicketMessage message = SupportTicketMessage.builder()
                .ticketId(ticket.getId())
                .senderType(SenderType.SUPPORT)
                .senderUserId(user != null ? user.getUserId() : null)
                .senderName(user != null ? user.getFullName() : "Support")
                .body(request.getBody().trim())
                .attachments(writeAttachments(request.getAttachments()))
                .internalNote(internal)
                .build();
        messageRepository.save(message);

        if (!internal) {
            if (ticket.getFirstRespondedAt() == null) {
                ticket.setFirstRespondedAt(now);
            }
            // Customer-facing reply: the ball is now in the customer's court (or reopens a closed one).
            ticket.setStatus(ticket.getStatus().isTerminal()
                    ? TicketStatus.IN_PROGRESS : TicketStatus.WAITING_ON_CUSTOMER);
            ticket.setResolvedAt(null);
            ticket.setLastMessageAt(now);
            ticket.setMessageCount(ticket.getMessageCount() + 1);
            ticketRepository.save(ticket);
            alertService.onSupportReply(ticket, request.getBody().trim());
        } else {
            ticketRepository.save(ticket); // touch updated_at only
        }
        return toDetailDto(ticket, true);
    }

    @Transactional
    public SupportTicketDto assignEngineer(String ticketId, AssignEngineerRequest request) {
        SupportTicket ticket = getOrThrow(ticketId);
        if (request != null && StringUtils.hasText(request.getEngineerId())) {
            SupportEngineer engineer = engineerService.getOrThrow(request.getEngineerId().trim());
            ticket.setAssignedEngineerId(engineer.getId());
        } else {
            ticket.setAssignedEngineerId(null);
        }
        if (request != null && StringUtils.hasText(request.getStatus())) {
            applyStatus(ticket, TicketStatus.fromName(request.getStatus(), ticket.getStatus()));
        }
        ticketRepository.save(ticket);
        return toDetailDto(ticket, true);
    }

    @Transactional
    public SupportTicketDto updateStatus(String ticketId, UpdateTicketStatusRequest request) {
        SupportTicket ticket = getOrThrow(ticketId);
        if (request == null) {
            return toDetailDto(ticket, true);
        }
        if (StringUtils.hasText(request.getPriority())) {
            TicketPriority newPriority = TicketPriority.fromName(request.getPriority(), ticket.getPriority());
            ticket.setPriority(newPriority);
            // Re-derive the response-due time while we still owe a first response.
            if (ticket.getFirstRespondedAt() == null && ticket.getPlanAtCreation() != null && ticket.getCreatedAt() != null) {
                ticket.setFirstResponseDueAt(computeDue(ticket.getCreatedAt(), ticket.getPlanAtCreation(), newPriority));
            }
        }
        if (StringUtils.hasText(request.getStatus())) {
            applyStatus(ticket, TicketStatus.fromName(request.getStatus(), ticket.getStatus()));
        }
        ticketRepository.save(ticket);
        return toDetailDto(ticket, true);
    }

    @Transactional(readOnly = true)
    public Map<String, Long> inboxCounts() {
        Map<String, Long> counts = new LinkedHashMap<>();
        counts.put("open", ticketRepository.countByStatus(TicketStatus.OPEN));
        counts.put("inProgress", ticketRepository.countByStatus(TicketStatus.IN_PROGRESS));
        counts.put("waitingOnCustomer", ticketRepository.countByStatus(TicketStatus.WAITING_ON_CUSTOMER));
        counts.put("active", ticketRepository.countByStatusIn(SupportConfigService.ACTIVE_STATUSES));
        counts.put("overdue", ticketRepository.countOverdue(new Date()));
        return counts;
    }

    // ============================== INTERNALS =================================

    private SupportTicket getOrThrow(String ticketId) {
        return ticketRepository.findById(ticketId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Ticket not found: " + ticketId));
    }

    private void requireInstitute(SupportTicket ticket, String instituteId) {
        if (instituteId == null || !instituteId.equals(ticket.getInstituteId())) {
            // Do not reveal that the ticket exists for another institute.
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Ticket not found");
        }
    }

    private void applyStatus(SupportTicket ticket, TicketStatus newStatus) {
        if (newStatus == null) {
            return;
        }
        ticket.setStatus(newStatus);
        if (newStatus.isTerminal()) {
            if (ticket.getResolvedAt() == null) {
                ticket.setResolvedAt(new Date());
            }
        } else {
            ticket.setResolvedAt(null);
        }
    }

    private Date computeDue(Date from, SupportPlan plan, TicketPriority priority) {
        if (plan == null) {
            return null;
        }
        Integer hours = plan.slaHours(priority);
        if (hours == null || from == null) {
            return null;
        }
        return new Date(from.getTime() + hours * HOUR_MS);
    }

    private boolean isOverdue(SupportTicket t) {
        return t.getFirstRespondedAt() == null
                && t.getFirstResponseDueAt() != null
                && t.getFirstResponseDueAt().before(new Date())
                && !t.getStatus().isTerminal();
    }

    private Map<String, String> engineerNames(Page<SupportTicket> page) {
        Set<String> ids = page.getContent().stream()
                .map(SupportTicket::getAssignedEngineerId)
                .filter(StringUtils::hasText)
                .collect(Collectors.toSet());
        return engineerService.mapByIds(ids).entrySet().stream()
                .collect(Collectors.toMap(Map.Entry::getKey, e -> e.getValue().getName()));
    }

    private SupportTicketDto toSummaryDto(SupportTicket t, Map<String, String> engineerNames) {
        return baseDto(t)
                .assignedEngineerName(t.getAssignedEngineerId() != null
                        ? engineerNames.get(t.getAssignedEngineerId()) : null)
                .build();
    }

    private SupportTicketDto toDetailDto(SupportTicket t, boolean includeInternal) {
        List<SupportTicketMessageDto> messages = messageRepository.findByTicketIdOrderByCreatedAtAsc(t.getId()).stream()
                .filter(m -> includeInternal || !m.isInternalNote())
                .map(this::toMessageDto)
                .collect(Collectors.toList());
        SupportTicketDto dto = baseDto(t)
                .assignedEngineerName(engineerService.nameOf(t.getAssignedEngineerId()))
                .messages(messages)
                .build();
        // Diagnostics (incl. IP) are surfaced only to the support team, never the customer view.
        if (includeInternal) {
            dto.setClientContext(readClientContext(t.getClientContext()));
        }
        return dto;
    }

    private SupportTicketDto.SupportTicketDtoBuilder baseDto(SupportTicket t) {
        return SupportTicketDto.builder()
                .id(t.getId())
                .instituteId(t.getInstituteId())
                .instituteName(t.getInstituteName())
                .raisedByUserId(t.getRaisedByUserId())
                .raisedByName(t.getRaisedByName())
                .raisedByEmail(t.getRaisedByEmail())
                .raisedByRole(t.getRaisedByRole())
                .subject(t.getSubject())
                .category(t.getCategory() != null ? t.getCategory().name() : null)
                .priority(t.getPriority() != null ? t.getPriority().name() : null)
                .status(t.getStatus() != null ? t.getStatus().name() : null)
                .planAtCreation(t.getPlanAtCreation() != null ? t.getPlanAtCreation().name() : null)
                .assignedEngineerId(t.getAssignedEngineerId())
                .source(t.getSource() != null ? t.getSource().name() : null)
                .eta(t.getEta())
                .firstResponseDueAt(t.getFirstResponseDueAt())
                .firstRespondedAt(t.getFirstRespondedAt())
                .resolvedAt(t.getResolvedAt())
                .lastMessageAt(t.getLastMessageAt())
                .messageCount(t.getMessageCount())
                .overdue(isOverdue(t))
                .createdAt(t.getCreatedAt())
                .updatedAt(t.getUpdatedAt());
    }

    private SupportTicketMessageDto toMessageDto(SupportTicketMessage m) {
        return SupportTicketMessageDto.builder()
                .id(m.getId())
                .ticketId(m.getTicketId())
                .senderType(m.getSenderType() != null ? m.getSenderType().name() : null)
                .senderName(m.getSenderName())
                .senderUserId(m.getSenderUserId())
                .body(m.getBody())
                .attachments(parseAttachments(m.getAttachments()))
                .internalNote(m.isInternalNote())
                .createdAt(m.getCreatedAt())
                .build();
    }

    private List<AttachmentDto> parseAttachments(String json) {
        if (!StringUtils.hasText(json)) {
            return Collections.emptyList();
        }
        try {
            List<AttachmentDto> parsed = objectMapper.readValue(json, ATTACHMENT_LIST);
            return parsed != null ? parsed : Collections.emptyList();
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }

    /**
     * Attachment descriptors arrive from the client body, so they are untrusted: keep only http(s)
     * URLs (drops {@code javascript:}/{@code data:} which would otherwise be an XSS sink when later
     * rendered into an href/src — including in the privileged super-admin console), bound the field
     * lengths, and cap the count.
     */
    private List<AttachmentDto> sanitizeAttachments(List<AttachmentDto> attachments) {
        if (attachments == null || attachments.isEmpty()) {
            return Collections.emptyList();
        }
        List<AttachmentDto> cleaned = new ArrayList<>();
        for (AttachmentDto a : attachments) {
            if (a == null) {
                continue;
            }
            String url = a.getUrl();
            if (url != null && !url.matches("(?i)^https?://.*")) {
                url = null; // reject non-http(s) schemes outright
            }
            cleaned.add(AttachmentDto.builder()
                    .fileId(truncate(a.getFileId(), MAX_ATTACHMENT_FIELD_LEN))
                    .fileName(truncate(a.getFileName(), MAX_ATTACHMENT_FIELD_LEN))
                    .url(truncate(url, MAX_ATTACHMENT_FIELD_LEN))
                    .build());
            if (cleaned.size() >= MAX_ATTACHMENTS) {
                break;
            }
        }
        return cleaned;
    }

    private String truncate(String value, int max) {
        if (value == null) {
            return null;
        }
        return value.length() > max ? value.substring(0, max) : value;
    }

    private String writeAttachments(List<AttachmentDto> attachments) {
        List<AttachmentDto> cleaned = sanitizeAttachments(attachments);
        if (cleaned.isEmpty()) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(cleaned);
        } catch (Exception e) {
            return null;
        }
    }

    private String writeClientContext(Map<String, Object> ctx) {
        if (ctx == null || ctx.isEmpty()) {
            return null;
        }
        try {
            // Bound the client-supplied diagnostics blob: cap key count and total serialized size
            // so an admin can't bloat the shared DB with a multi-MB / deeply-nested context.
            Map<String, Object> bounded = ctx;
            if (ctx.size() > MAX_CONTEXT_KEYS) {
                bounded = new LinkedHashMap<>();
                int i = 0;
                for (Map.Entry<String, Object> e : ctx.entrySet()) {
                    if (i++ >= MAX_CONTEXT_KEYS) {
                        break;
                    }
                    bounded.put(e.getKey(), e.getValue());
                }
            }
            String json = objectMapper.writeValueAsString(bounded);
            return json.length() > MAX_CONTEXT_JSON_LEN ? null : json;
        } catch (Exception e) {
            return null;
        }
    }

    private Object readClientContext(String json) {
        if (!StringUtils.hasText(json)) {
            return null;
        }
        try {
            return objectMapper.readValue(json, Object.class);
        } catch (Exception e) {
            return null;
        }
    }
}
