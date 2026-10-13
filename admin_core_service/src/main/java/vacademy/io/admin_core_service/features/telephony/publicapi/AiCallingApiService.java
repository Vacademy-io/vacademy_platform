package vacademy.io.admin_core_service.features.telephony.publicapi;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.telephony.core.AiCallService;
import vacademy.io.admin_core_service.features.telephony.core.dto.AiCallRequestDTO;
import vacademy.io.admin_core_service.features.telephony.core.dto.AiCallResponseDTO;
import vacademy.io.admin_core_service.features.telephony.enums.CallTrigger;
import vacademy.io.admin_core_service.features.telephony.enums.ProviderType;
import vacademy.io.admin_core_service.features.telephony.persistence.entity.AiAgent;
import vacademy.io.admin_core_service.features.telephony.persistence.repository.AiAgentRepository;
import vacademy.io.admin_core_service.features.telephony.publicapi.entity.AiCallApiCall;
import vacademy.io.admin_core_service.features.telephony.publicapi.repository.AiCallApiCallRepository;
import vacademy.io.admin_core_service.features.telephony.queue.AiCallQueueDrainJob;
import vacademy.io.admin_core_service.features.telephony.queue.AiCallQueueService;
import vacademy.io.admin_core_service.features.telephony.queue.dto.AiCallQueueDTOs.EnqueueResult;
import vacademy.io.admin_core_service.features.telephony.queue.entity.AiCallQueueItem;
import vacademy.io.admin_core_service.features.telephony.queue.repository.AiCallQueueItemRepository;
import vacademy.io.admin_core_service.features.telephony.spi.dto.CallSubjectType;
import vacademy.io.common.exceptions.ConflictException;

import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * The public AI calling API (Telleo API v1): create calls and batches, read them back,
 * cancel waiting calls, list agents.
 *
 * <p>Every real call goes through the AI call queue with {@link CallTrigger#API}, so it
 * inherits calling hours, line capacity and fairness between institutes, the institute
 * and per-number daily caps, the recall gap and the duplicate window. A single call is
 * queued at interactive priority and dialled on the request thread when a line is free.
 * Test calls ({@code test: true}) never dial: they run through the MOCK provider, which
 * fabricates an outcome through the same result pipeline.
 *
 * <p>The contact is {@link CallSubjectType#API_CONTACT} with subjectId = the public call
 * id: the client's CRM owns it, so the outcome is stored, billed and delivered to the
 * webhook, and no lead in our CRM is assigned or re-statused.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AiCallingApiService {

    public static final int MAX_BATCH = 1000;
    static final int MAX_VARIABLES = 50;
    static final int MAX_VARIABLE_VALUE = 500;
    static final int MAX_METADATA_BYTES = 8192;
    static final Pattern E164 = Pattern.compile("^\\+[1-9][0-9]{7,14}$");
    static final Pattern VARIABLE_KEY = Pattern.compile("^[A-Za-z][A-Za-z0-9_ ]{0,39}$");
    static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");
    static final Pattern PLACEHOLDER = Pattern.compile("\\{\\{\\s*([a-zA-Z0-9_ ]+?)\\s*\\}\\}");
    /** Placeholders the platform fills itself (bot.py _fill_placeholders): not client variables. */
    static final Set<String> BUILT_IN_PLACEHOLDERS = Set.of(
            "name", "lead_name", "institute_name", "lead_source", "lead_source_line", "booked_slot",
            "day", "today", "date", "time", "datetime", "now", "tomorrow", "year", "month");
    static final String SOURCE = "API";

    private static final SecureRandom RANDOM = new SecureRandom();

    private final AiAgentRepository agentRepository;
    private final AiCallApiCallRepository callRepository;
    private final AiCallQueueService queueService;
    private final AiCallQueueDrainJob drainJob;
    private final AiCallQueueItemRepository queueRepository;
    private final AiCallService aiCallService;
    private final AiCallingApiViews views;
    private final ObjectMapper objectMapper = new ObjectMapper();

    // ── Requests ─────────────────────────────────────────────────────────────────

    /** One call. Fields are snake_case on the wire (see the controller's DTOs). */
    public record CallInput(String agentId, String phoneNumber, String contactName, String contactEmail,
                            String externalId, Map<String, Object> variables, Map<String, Object> metadata) {
    }

    // ── Create ───────────────────────────────────────────────────────────────────

    public Map<String, Object> createCall(AiCallingApiAuth.Principal p, CallInput in, boolean test,
                                          String idempotencyKey) {
        String idem = normaliseIdempotencyKey(idempotencyKey);
        if (idem != null) {
            Optional<AiCallApiCall> prior = callRepository.findByInstituteIdAndIdempotencyKey(p.instituteId(), idem);
            if (prior.isPresent()) return replay(prior.get(), in);
        }
        Validated v = validate(p.instituteId(), in, null);
        if (!v.errors().isEmpty()) {
            throw AiCallingApiException.invalid(v.errors().get(0).get("message"), Map.of("errors", v.errors()));
        }
        if (!test && !aiCallService.canAffordCall(p.instituteId())) {
            throw new AiCallingApiException(HttpStatus.PAYMENT_REQUIRED, "insufficient_credits",
                    "This account is out of AI calling credits. Top up to place calls.");
        }
        AiCallApiCall call = newCall(p, v, null, test, idem);
        try {
            call = callRepository.saveAndFlush(call);
        } catch (org.springframework.dao.DataIntegrityViolationException race) {
            // A concurrent request with the same Idempotency-Key won the insert.
            if (idem != null) {
                return callRepository.findByInstituteIdAndIdempotencyKey(p.instituteId(), idem)
                        .map(prior -> replay(prior, in)).orElseThrow(() -> race);
            }
            throw race;
        }
        if (test) {
            placeTestCall(call, v);
        } else {
            EnqueueResult q = queueService.enqueue(toRequest(call, v, ProviderType.VACADEMY_AI),
                    CallTrigger.API, SOURCE, null, null, true);
            if (!q.isQueued()) {
                callRepository.delete(call);
                throw alreadyQueued(p.instituteId(), q.getQueueItemId(), v.phone());
            }
            call.setQueueItemId(q.getQueueItemId());
            call = callRepository.save(call);
            tryDialNow(call);
        }
        return views.call(callRepository.findById(call.getId()).orElse(call), false);
    }

    public Map<String, Object> createBatch(AiCallingApiAuth.Principal p, String agentId,
                                           List<CallInput> rows, boolean test) {
        if (rows == null || rows.isEmpty()) throw AiCallingApiException.invalid("calls must contain at least one call.");
        if (rows.size() > MAX_BATCH) {
            throw AiCallingApiException.invalid("A batch holds at most " + MAX_BATCH + " calls; split it.",
                    Map.of("max_calls", MAX_BATCH, "received", rows.size()));
        }
        AiAgent agent = requireAgent(p.instituteId(), agentId);
        if (!test && !aiCallService.canAffordCall(p.instituteId())) {
            throw new AiCallingApiException(HttpStatus.PAYMENT_REQUIRED, "insufficient_credits",
                    "This account is out of AI calling credits. Top up to place calls.");
        }
        String batchId = newId("batch_");
        List<Map<String, Object>> accepted = new ArrayList<>();
        List<Map<String, Object>> rejected = new ArrayList<>();
        Set<String> seenPhones = new HashSet<>();
        for (int i = 0; i < rows.size(); i++) {
            CallInput row = rows.get(i);
            CallInput withAgent = new CallInput(agent.getId(), row == null ? null : row.phoneNumber(),
                    row == null ? null : row.contactName(), row == null ? null : row.contactEmail(),
                    row == null ? null : row.externalId(), row == null ? null : row.variables(),
                    row == null ? null : row.metadata());
            Validated v = validate(p.instituteId(), withAgent, agent);
            if (!v.errors().isEmpty()) {
                rejected.add(rejection(i, withAgent.phoneNumber(), "invalid_request", v.errors().get(0).get("message")));
                continue;
            }
            if (!seenPhones.add(v.phone())) {
                rejected.add(rejection(i, v.phone(), "duplicate_in_batch", "This number appears earlier in the batch."));
                continue;
            }
            AiCallApiCall call = callRepository.save(newCall(p, v, batchId, test, null));
            if (test) {
                placeTestCall(call, v);
            } else {
                EnqueueResult q = queueService.enqueue(toRequest(call, v, ProviderType.VACADEMY_AI),
                        CallTrigger.API, SOURCE, batchId, null, false);
                if (!q.isQueued()) {
                    callRepository.delete(call);
                    Map<String, Object> r = rejection(i, v.phone(), "call_already_queued",
                            "This number already has a call waiting for a line.");
                    String existing = existingCallForQueueItem(p.instituteId(), q.getQueueItemId());
                    if (existing != null) r.put("call_id", existing);
                    rejected.add(r);
                    continue;
                }
                call.setQueueItemId(q.getQueueItemId());
                callRepository.save(call);
            }
            Map<String, Object> a = new LinkedHashMap<>();
            a.put("index", i);
            a.put("id", call.getId());
            a.put("phone_number", v.phone());
            if (call.getExternalId() != null) a.put("external_id", call.getExternalId());
            accepted.add(a);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", batchId);
        out.put("object", "batch");
        out.put("agent_id", agent.getId());
        out.put("test", test);
        out.put("accepted_count", accepted.size());
        out.put("rejected_count", rejected.size());
        out.put("calls", accepted);
        out.put("rejected", rejected);
        return out;
    }

    // ── Read ─────────────────────────────────────────────────────────────────────

    public Map<String, Object> getCall(AiCallingApiAuth.Principal p, String id) {
        AiCallApiCall call = callRepository.findByIdAndInstituteId(id, p.instituteId())
                .orElseThrow(() -> AiCallingApiException.notFound("Call " + id));
        return views.call(call, false);
    }

    public Map<String, Object> listCalls(AiCallingApiAuth.Principal p, String batchId, String externalId,
                                         Instant since, int limit, String startingAfter) {
        int lim = Math.max(1, Math.min(100, limit <= 0 ? 25 : limit));
        Instant beforeTs = null;
        String beforeId = null;
        if (startingAfter != null && !startingAfter.isBlank()) {
            AiCallApiCall cursor = callRepository.findByIdAndInstituteId(startingAfter.trim(), p.instituteId())
                    .orElseThrow(() -> AiCallingApiException.invalid("starting_after is not a call of this account."));
            beforeTs = cursor.getCreatedAt();
            beforeId = cursor.getId();
        }
        List<AiCallApiCall> rows = callRepository.page(p.instituteId(), blankToNull(batchId),
                blankToNull(externalId), since, beforeTs, beforeId, lim + 1);
        boolean hasMore = rows.size() > lim;
        List<Map<String, Object>> data = new ArrayList<>();
        for (AiCallApiCall c : rows.subList(0, Math.min(lim, rows.size()))) data.add(views.call(c, false));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("object", "list");
        out.put("data", data);
        out.put("has_more", hasMore);
        return out;
    }

    public Map<String, Object> getBatch(AiCallingApiAuth.Principal p, String batchId) {
        List<AiCallApiCall> calls = callRepository.findByBatchIdAndInstituteIdOrderByCreatedAtAsc(batchId, p.instituteId());
        if (calls.isEmpty()) throw AiCallingApiException.notFound("Batch " + batchId);
        Map<String, Integer> byStatus = new TreeMap<>();
        for (AiCallApiCall c : calls) {
            String s = String.valueOf(views.call(c, true).get("status"));
            byStatus.merge(s, 1, Integer::sum);
        }
        int done = 0;
        for (Map.Entry<String, Integer> e : byStatus.entrySet()) {
            if (AiCallingApiViews.FINAL_STATUSES.contains(e.getKey())) done += e.getValue();
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", batchId);
        out.put("object", "batch");
        out.put("agent_id", calls.get(0).getAgentId());
        out.put("test", calls.get(0).isTestMode());
        out.put("total", calls.size());
        out.put("finished", done);
        out.put("counts", byStatus);
        out.put("created_at", calls.get(0).getCreatedAt().toString());
        return out;
    }

    public Map<String, Object> cancel(AiCallingApiAuth.Principal p, String id) {
        AiCallApiCall call = callRepository.findByIdAndInstituteId(id, p.instituteId())
                .orElseThrow(() -> AiCallingApiException.notFound("Call " + id));
        if (call.getQueueItemId() == null
                || queueRepository.cancelIfQueued(call.getQueueItemId(), "Canceled through the API.") == 0) {
            Map<String, Object> current = views.call(call, true);
            throw new AiCallingApiException(HttpStatus.CONFLICT, "call_not_cancelable",
                    "Only a call that is still waiting can be canceled; this one is " + current.get("status") + ".",
                    Map.of("status", current.get("status")));
        }
        return views.call(call, false);
    }

    public Map<String, Object> listAgents(AiCallingApiAuth.Principal p) {
        List<Map<String, Object>> data = new ArrayList<>();
        for (AiAgent a : agentRepository.findByInstituteIdOrderByCreatedAtDesc(p.instituteId())) {
            if (!Boolean.TRUE.equals(a.getEnabled())) continue;
            if ("INBOUND".equalsIgnoreCase(a.getDirection())) continue;
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", a.getId());
            m.put("object", "agent");
            m.put("name", a.getName());
            m.put("language", a.getLanguage());
            Set<String> used = placeholders(a.getOpeningLine(), a.getSystemPrompt());
            m.put("uses_contact_name", used.contains("name") || used.contains("lead_name"));
            List<String> vars = new ArrayList<>();
            for (String u : used) if (!BUILT_IN_PLACEHOLDERS.contains(u)) vars.add(u);
            m.put("variables", vars);
            data.add(m);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("object", "list");
        out.put("data", data);
        out.put("has_more", false);
        return out;
    }

    // ── Internals ────────────────────────────────────────────────────────────────

    record Validated(String phone, AiAgent agent, String name, String email, String externalId,
                     Map<String, String> variables, Map<String, Object> metadata,
                     List<Map<String, String>> errors) {
    }

    Validated validate(String instituteId, CallInput in, AiAgent knownAgent) {
        List<Map<String, String>> errors = new ArrayList<>();
        AiAgent agent = knownAgent;
        if (agent == null) {
            if (in == null || in.agentId() == null || in.agentId().isBlank()) {
                errors.add(err("agent_id", "agent_id is required. List your agents with GET /v1/agents."));
            } else {
                agent = requireAgent(instituteId, in.agentId());
            }
        }
        String phone = normalisePhone(in == null ? null : in.phoneNumber());
        if (phone == null) {
            errors.add(err("phone_number", "phone_number must be in E.164 format, e.g. +919876543210."));
        }
        String name = trimTo(in == null ? null : in.contactName(), 120);
        String email = trimTo(in == null ? null : in.contactEmail(), 254);
        if (email != null && !EMAIL.matcher(email).matches()) errors.add(err("contact.email", "contact.email is not a valid email address."));
        String externalId = trimTo(in == null ? null : in.externalId(), 255);
        Map<String, String> vars = new LinkedHashMap<>();
        if (in != null && in.variables() != null) {
            if (in.variables().size() > MAX_VARIABLES) {
                errors.add(err("variables", "At most " + MAX_VARIABLES + " variables per call."));
            } else {
                for (Map.Entry<String, Object> e : in.variables().entrySet()) {
                    String k = e.getKey() == null ? "" : e.getKey().trim();
                    if (!VARIABLE_KEY.matcher(k).matches()) {
                        errors.add(err("variables." + k, "Variable names start with a letter and use letters, digits, spaces or underscores (max 40)."));
                        continue;
                    }
                    Object val = e.getValue();
                    if (val instanceof Map || val instanceof Collection) {
                        errors.add(err("variables." + k, "Variable values must be text, numbers or booleans."));
                        continue;
                    }
                    String s = val == null ? "" : String.valueOf(val).trim();
                    if (s.length() > MAX_VARIABLE_VALUE) {
                        errors.add(err("variables." + k, "Variable values are at most " + MAX_VARIABLE_VALUE + " characters."));
                        continue;
                    }
                    vars.put(k, s);
                }
            }
        }
        Map<String, Object> metadata = in == null ? null : in.metadata();
        if (metadata != null) {
            try {
                if (objectMapper.writeValueAsBytes(metadata).length > MAX_METADATA_BYTES) {
                    errors.add(err("metadata", "metadata is at most " + MAX_METADATA_BYTES + " bytes as JSON."));
                }
            } catch (Exception e) {
                errors.add(err("metadata", "metadata must be a JSON object."));
            }
        }
        return new Validated(phone, agent, name, email, externalId, vars.isEmpty() ? null : vars,
                metadata == null || metadata.isEmpty() ? null : metadata, errors);
    }

    AiAgent requireAgent(String instituteId, String agentId) {
        if (agentId == null || agentId.isBlank()) {
            throw AiCallingApiException.invalid("agent_id is required. List your agents with GET /v1/agents.");
        }
        AiAgent a = agentRepository.findByIdAndInstituteId(agentId.trim(), instituteId)
                .orElseThrow(() -> new AiCallingApiException(HttpStatus.NOT_FOUND, "agent_not_found",
                        "No agent " + agentId + " in this account. List your agents with GET /v1/agents."));
        if (!Boolean.TRUE.equals(a.getEnabled())) {
            throw new AiCallingApiException(HttpStatus.CONFLICT, "agent_disabled", "Agent " + agentId + " is turned off.");
        }
        if ("INBOUND".equalsIgnoreCase(a.getDirection())) {
            throw new AiCallingApiException(HttpStatus.CONFLICT, "agent_inbound_only",
                    "Agent " + agentId + " only answers incoming calls.");
        }
        return a;
    }

    private AiCallApiCall newCall(AiCallingApiAuth.Principal p, Validated v, String batchId, boolean test, String idem) {
        return AiCallApiCall.builder()
                .id(newId("call_"))
                .instituteId(p.instituteId())
                .apiKeyId(p.keyId())
                .batchId(batchId)
                .agentId(v.agent().getId())
                .phoneNumber(v.phone())
                .contactName(v.name())
                .contactEmail(v.email())
                .externalId(v.externalId())
                .variables(v.variables())
                .metadata(v.metadata())
                .testMode(test)
                .idempotencyKey(idem)
                .webhookAttempts(0)
                .build();
    }

    private AiCallRequestDTO toRequest(AiCallApiCall call, Validated v, String provider) {
        AiCallRequestDTO r = new AiCallRequestDTO();
        r.setInstituteId(call.getInstituteId());
        r.setProvider(provider);
        r.setPhoneNumber(call.getPhoneNumber());
        r.setUserId(contactUserId(call.getInstituteId(), call.getPhoneNumber()));
        r.setCampaignId(call.getAgentId());
        r.setSubjectType(CallSubjectType.API_CONTACT.name());
        r.setSubjectId(call.getId());
        r.setCustomerName(call.getContactName());
        r.setCustomerEmail(call.getContactEmail());
        Map<String, Object> md = new LinkedHashMap<>();
        md.put("apiCallId", call.getId());
        if (call.getBatchId() != null) md.put("apiBatchId", call.getBatchId());
        r.setMetadata(md);
        return r;
    }

    /**
     * A stable pseudo user id per (institute, number). The per-number daily cap, the
     * recall gap and the duplicate window all key on the user, so two API calls to the
     * same number are recognised as the same person. It never exists in auth_service.
     */
    static String contactUserId(String instituteId, String phone) {
        return UUID.nameUUIDFromBytes(("ai-calling-api:" + instituteId + ":" + phone)
                .getBytes(StandardCharsets.UTF_8)).toString();
    }

    private void placeTestCall(AiCallApiCall call, Validated v) {
        AiCallResponseDTO r = aiCallService.placeCall(toRequest(call, v, ProviderType.MOCK), null, CallTrigger.API);
        if (r != null && r.getCallLogId() != null) {
            call.setCallLogId(r.getCallLogId());
            callRepository.save(call);
        }
    }

    private void tryDialNow(AiCallApiCall call) {
        try {
            drainJob.dispatchNowIfLineFree(call.getQueueItemId()).ifPresent(resp -> {
                if (resp.getCallLogId() != null) {
                    call.setCallLogId(resp.getCallLogId());
                    callRepository.save(call);
                }
            });
        } catch (ConflictException e) {
            // Credits ran out between the pre-check and the dial: the queue has parked the
            // call (it resumes after a top-up). GET /v1/calls/{id} shows the reason.
            log.info("ai-calling-api: call {} parked: {}", call.getId(), e.getMessage());
        } catch (RuntimeException e) {
            log.warn("ai-calling-api: immediate dial failed for {} (stays queued): {}", call.getId(), e.getMessage());
        }
    }

    private Map<String, Object> replay(AiCallApiCall prior, CallInput in) {
        String phone = normalisePhone(in == null ? null : in.phoneNumber());
        boolean same = in != null && Objects.equals(prior.getPhoneNumber(), phone)
                && (in.agentId() == null || Objects.equals(prior.getAgentId(), in.agentId().trim()));
        if (!same) {
            throw new AiCallingApiException(HttpStatus.CONFLICT, "idempotency_key_reused",
                    "This Idempotency-Key was already used for a different call.",
                    Map.of("call_id", prior.getId()));
        }
        Map<String, Object> view = views.call(prior, false);
        view.put("idempotent_replay", true);
        return view;
    }

    private AiCallingApiException alreadyQueued(String instituteId, String queueItemId, String phone) {
        Map<String, Object> d = new LinkedHashMap<>();
        d.put("phone_number", phone);
        if (queueItemId != null) {
            String existing = existingCallForQueueItem(instituteId, queueItemId);
            if (existing != null) d.put("call_id", existing);
        }
        return new AiCallingApiException(HttpStatus.CONFLICT, "call_already_queued",
                "This number already has a call waiting for a line.", d);
    }

    private String existingCallForQueueItem(String instituteId, String queueItemId) {
        AiCallQueueItem item = queueRepository.findById(queueItemId).orElse(null);
        if (item == null || !instituteId.equals(item.getInstituteId())) return null;
        if (CallSubjectType.API_CONTACT.name().equals(item.getSubjectType())) return item.getSubjectId();
        return null;
    }

    static Set<String> placeholders(String... texts) {
        Set<String> out = new LinkedHashSet<>();
        for (String t : texts) {
            if (t == null) continue;
            Matcher m = PLACEHOLDER.matcher(t);
            while (m.find()) out.add(m.group(1).trim().toLowerCase(Locale.ROOT));
        }
        return out;
    }

    static String normalisePhone(String raw) {
        if (raw == null) return null;
        String s = raw.trim().replaceAll("[\\s\\-().]", "");
        if (s.startsWith("00")) s = "+" + s.substring(2);
        return E164.matcher(s).matches() ? s : null;
    }

    static String normaliseIdempotencyKey(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String k = raw.trim();
        if (k.length() > 255) throw AiCallingApiException.invalid("Idempotency-Key is at most 255 characters.");
        return k;
    }

    static String newId(String prefix) {
        byte[] b = new byte[12];
        RANDOM.nextBytes(b);
        return prefix + HexFormat.of().formatHex(b);
    }

    private static Map<String, String> err(String field, String message) {
        Map<String, String> m = new LinkedHashMap<>();
        m.put("field", field);
        m.put("message", message);
        return m;
    }

    private static Map<String, Object> rejection(int index, String phone, String code, String message) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("index", index);
        if (phone != null) m.put("phone_number", phone);
        m.put("code", code);
        m.put("message", message);
        return m;
    }

    private static String trimTo(String s, int max) {
        if (s == null || s.isBlank()) return null;
        String t = s.trim();
        return t.length() > max ? t.substring(0, max) : t;
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
