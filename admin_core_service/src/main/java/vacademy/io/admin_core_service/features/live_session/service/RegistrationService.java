package vacademy.io.admin_core_service.features.live_session.service;

import jakarta.transaction.Transactional;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import vacademy.io.admin_core_service.features.live_session.dto.GuestRegistrationRequestDTO;
import vacademy.io.admin_core_service.features.common.entity.CustomFields;
import vacademy.io.admin_core_service.features.common.repository.CustomFieldRepository;
import vacademy.io.admin_core_service.features.live_session.entity.LiveSession;
import vacademy.io.admin_core_service.features.live_session.entity.SessionGuestRegistration;
import vacademy.io.admin_core_service.features.common.entity.CustomFieldValues;
import vacademy.io.admin_core_service.features.common.repository.CustomFieldValuesRepository;
import vacademy.io.admin_core_service.features.live_session.repository.LiveSessionRepository;
import vacademy.io.admin_core_service.features.live_session.repository.SessionGuestRegistrationRepository;
import vacademy.io.admin_core_service.features.live_session.util.GuestFormFieldResolver;
import vacademy.io.admin_core_service.features.workflow.enums.WorkflowTriggerEvent;
import vacademy.io.admin_core_service.features.workflow.service.WorkflowTriggerService;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Slf4j
public class RegistrationService {

    @Autowired
    SessionGuestRegistrationRepository sessionGuestRegistration;
    @Autowired
    CustomFieldValuesRepository customFieldValuesRepository;
    @Autowired
    CustomFieldRepository customFieldRepository;
    @Autowired
    LiveSessionRepository liveSessionRepository;
    @Autowired
    LiveSessionWorkflowAsyncHelper liveSessionWorkflowAsyncHelper;
    @Autowired
    WorkflowTriggerService workflowTriggerService;


    public String registerGuest(String email, String sessionId) {
        // Prevent duplicate
        boolean alreadyRegistered = sessionGuestRegistration.existsBySessionIdAndEmail(sessionId, email);
        if (alreadyRegistered) {
            throw new IllegalArgumentException("Guest already registered for this session");
        }

        SessionGuestRegistration registration = SessionGuestRegistration.builder()
                .id(UUID.randomUUID().toString())
                .sessionId(sessionId)
                .email(email)
                .registeredAt(LocalDateTime.now())
                .build();

        sessionGuestRegistration.save(registration);
        return registration.getId();
    }


    @Transactional
    public String saveGuestUserDetails(GuestRegistrationRequestDTO requestDto) {
        String guestUserId = registerGuest(requestDto.getEmail() , requestDto.getSessionId());

        for (GuestRegistrationRequestDTO.CustomFieldValueDTO fieldDto : requestDto.getCustomFields()) {
            CustomFieldValues value = CustomFieldValues.builder()
                    .id(UUID.randomUUID().toString())
                    .customFieldId(fieldDto.getCustomFieldId())
                    .sourceType("EXTERNAL_PARTICIPANT")  // or any logic you want
                    .sourceId(guestUserId) // passed as parameter or obtained elsewhere
                    .type("SESSION")      // optional
                    .typeId(null)         // or requestDto.getSessionId() if int, else convert
                    .value(fieldDto.getValue())
                    .build();

            customFieldValuesRepository.save(value);
        }

        scheduleFormSubmissionWorkflow(requestDto, guestUserId);
        return guestUserId;
    }

    /**
     * Schedules the {@code LIVE_SESSION_FORM_SUBMISSION} emit to run strictly AFTER the
     * registration commits.
     *
     * <p>Nothing in the emit — not even the trigger-existence lookup — runs inside the
     * registration transaction. That matters: a JPQL read here would force Hibernate to
     * flush the just-inserted guest rows early, so a genuine constraint failure (dangling
     * custom_field_id, the unique (session_id, email) race, a session deleted mid-submit)
     * would surface at our query and be swallowed instead of surfacing cleanly at commit.
     * Running post-commit keeps the registration's own success/failure path byte-for-byte
     * unchanged, and {@code afterCommit} only fires when the commit actually succeeded, so
     * a rolled-back registration never emits.
     */
    private void scheduleFormSubmissionWorkflow(GuestRegistrationRequestDTO requestDto, String guestUserId) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    emitFormSubmissionWorkflow(requestDto, guestUserId);
                }
            });
        } else {
            // No active transaction (defensive): the writes above auto-committed, emit now.
            emitFormSubmissionWorkflow(requestDto, guestUserId);
        }
    }

    /**
     * Emits {@code LIVE_SESSION_FORM_SUBMISSION} so admins can hang a workflow (e.g. a
     * WhatsApp seat-confirmation) off a public registration form. Runs after commit.
     *
     * <p>Never throws — a notification problem must not fail or disturb the registration,
     * which has already committed by the time this runs.
     *
     * <p>Gated on an existing trigger so this is inert for every institute/session that
     * hasn't configured one: the only cost on that (overwhelmingly common) path is a
     * session lookup plus one indexed trigger lookup — no context is built and no async
     * thread is spawned.
     */
    private void emitFormSubmissionWorkflow(GuestRegistrationRequestDTO requestDto, String guestUserId) {
        try {
            Optional<LiveSession> sessionOpt = liveSessionRepository.findById(requestDto.getSessionId());
            if (sessionOpt.isEmpty()) {
                log.warn("Skipping LIVE_SESSION_FORM_SUBMISSION: no live session for id={}", requestDto.getSessionId());
                return;
            }
            LiveSession session = sessionOpt.get();
            String instituteId = session.getInstituteId();
            if (instituteId == null || instituteId.isBlank()) {
                log.warn("Skipping LIVE_SESSION_FORM_SUBMISSION: session {} has no instituteId", session.getId());
                return;
            }

            boolean triggerConfigured = workflowTriggerService
                    .findByInstituteIdEventNameAndEventId(
                            instituteId,
                            WorkflowTriggerEvent.LIVE_SESSION_FORM_SUBMISSION.name(),
                            session.getId())
                    .isPresent();
            if (!triggerConfigured) {
                return;
            }

            Map<String, Object> contextData = buildContext(requestDto, guestUserId, session, instituteId);
            dispatchFormSubmissionWorkflow(session.getId(), instituteId, contextData);
        } catch (Exception e) {
            log.warn("Failed to emit LIVE_SESSION_FORM_SUBMISSION for sessionId={}: {}",
                    requestDto.getSessionId(), e.getMessage(), e);
        }
    }

    /**
     * Hands the trigger to the async helper, swallowing any dispatch-time failure
     * (e.g. executor rejection). The async work itself is fire-and-forget; the guest's
     * registration has already committed and must not be affected either way.
     */
    private void dispatchFormSubmissionWorkflow(String sessionId, String instituteId,
                                                Map<String, Object> contextData) {
        try {
            liveSessionWorkflowAsyncHelper.fireLiveSessionFormSubmissionWorkflow(
                    sessionId, instituteId, contextData);
        } catch (Exception e) {
            log.warn("Failed to dispatch LIVE_SESSION_FORM_SUBMISSION workflow for sessionId={}: {}",
                    sessionId, e.getMessage(), e);
        }
    }

    /**
     * Builds the workflow context for one guest submission.
     *
     * <p>The form is entirely admin-defined custom fields, so the guest's name and phone
     * are resolved via {@link GuestFormFieldResolver} rather than read from fixed columns.
     * Answers are exposed under both their field key and their (lowercased) label so a
     * workflow can reference whichever is stable for that institute, and {@code guests}
     * is a single-element list so a SEND_WHATSAPP node can iterate it the same way it
     * iterates a QUERY result.
     */
    private Map<String, Object> buildContext(GuestRegistrationRequestDTO requestDto,
                                             String guestUserId,
                                             LiveSession session,
                                             String instituteId) {
        List<GuestRegistrationRequestDTO.CustomFieldValueDTO> submitted =
                requestDto.getCustomFields() == null ? List.of() : requestDto.getCustomFields();

        List<String> fieldIds = submitted.stream()
                .map(GuestRegistrationRequestDTO.CustomFieldValueDTO::getCustomFieldId)
                .filter(java.util.Objects::nonNull)
                .collect(Collectors.toList());

        Map<String, CustomFields> fieldsById = new HashMap<>();
        if (!fieldIds.isEmpty()) {
            for (CustomFields field : customFieldRepository.findAllById(fieldIds)) {
                fieldsById.put(field.getId(), field);
            }
        }

        Map<String, Object> byKey = new LinkedHashMap<>();
        Map<String, Object> byName = new LinkedHashMap<>();
        String fullName = null;
        String mobileNumber = null;
        String email = requestDto.getEmail();

        for (GuestRegistrationRequestDTO.CustomFieldValueDTO answer : submitted) {
            CustomFields field = fieldsById.get(answer.getCustomFieldId());
            if (field == null) continue;

            String value = answer.getValue();
            if (field.getFieldKey() != null) byKey.put(field.getFieldKey(), value);
            if (field.getFieldName() != null) byName.put(field.getFieldName().toLowerCase().trim(), value);

            if (value == null || value.isBlank()) continue;
            switch (GuestFormFieldResolver.classify(field.getFieldKey(), field.getFieldName())) {
                case NAME -> {
                    if (fullName == null) fullName = value.trim();
                }
                case PHONE -> {
                    if (mobileNumber == null) mobileNumber = value.trim();
                }
                case EMAIL -> {
                    if (email == null || email.isBlank()) email = value.trim();
                }
                default -> {
                }
            }
        }

        Map<String, Object> guest = new LinkedHashMap<>();
        guest.put("guestRegistrationId", guestUserId);
        guest.put("fullName", fullName);
        guest.put("mobileNumber", mobileNumber);
        guest.put("email", email);
        guest.put("sessionId", session.getId());
        guest.put("sessionTitle", session.getTitle());
        guest.putAll(byName);

        List<Map<String, Object>> guests = new ArrayList<>();
        guests.add(guest);

        Map<String, Object> contextData = new HashMap<>();
        contextData.put("instituteId", instituteId);
        contextData.put("instituteIdForWhatsapp", instituteId);
        contextData.put("sessionId", session.getId());
        contextData.put("sessionTitle", session.getTitle());
        contextData.put("guestRegistrationId", guestUserId);
        contextData.put("fullName", fullName);
        contextData.put("mobileNumber", mobileNumber);
        contextData.put("email", email);
        contextData.put("customFields", byKey);
        contextData.put("customFieldsByName", byName);
        contextData.put("liveSession", session);
        contextData.put("guests", guests);
        return contextData;
    }
}
