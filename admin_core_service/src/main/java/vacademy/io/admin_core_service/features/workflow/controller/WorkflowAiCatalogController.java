package vacademy.io.admin_core_service.features.workflow.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * AI-grade grounding schema for the workflow drafter (see WORKFLOW_AI_ASSIST_DESIGN.md).
 *
 * The plain {@code /catalog/*} endpoints describe query INPUTS for the human builder's
 * dropdowns. An LLM that generates a whole workflow JSON needs more: each query's OUTPUT
 * keys and per-item field names, which nodes are safe / mutating / dead, the hard
 * generation rules, and the exact workflow JSON shape. This endpoint returns all of that
 * as one document so the drafter can ground a single completion.
 *
 * This is static, code-grounded metadata (verified against QueryServiceImpl and the node
 * handlers on 2026-07-07). Institute-specific grounding (real audiences / batches /
 * templates) is assembled by the drafter at request time, not here.
 */
@Slf4j
@RestController
@RequestMapping("/admin-core-service/v1/workflow/ai-catalog")
@RequiredArgsConstructor
public class WorkflowAiCatalogController {

    @GetMapping
    public ResponseEntity<Map<String, Object>> getAiCatalog() {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("version", "2026-07-07");
        out.put("workflowJsonShape", workflowJsonShape());
        out.put("generationRules", generationRules());
        out.put("nodeTypes", nodeTypes());
        out.put("readQueries", readQueries());
        out.put("mutatingQueryKeys", List.of(
                "createLiveSession", "createSessionSchedule", "createSessionParticipent",
                "upsertUserCustomField", "updateSSIGMRemaingDaysByOne"));
        out.put("unsafeInDryRun", List.of(
                "QUERY (any mutating prebuiltKey — QueryNodeHandler has no dryRun gate)",
                "SET_LEAD_STATUS (mutates lead status even in Test Run)",
                "COMBOT (sends real WhatsApp even in Test Run)"));
        out.put("avoidNodeTypes", m(
                "ROUTER", "In the enum + FE palette but has NO handler — a workflow containing it cannot execute that node.",
                "SEND_PUSH_NOTIFICATION", "Stub — logs and returns status 'dispatched' without sending. Do not use."));
        out.put("commonTriggers", commonTriggers());
        out.put("references", m(
                "allTriggerEvents", "/admin-core-service/v1/workflow/catalog/trigger-events",
                "leadContextVariables", "/admin-core-service/v1/workflow/catalog/trigger-context-variables",
                "allQueryParams", "/admin-core-service/v1/workflow/catalog/query-keys",
                "actions", "/admin-core-service/v1/workflow/catalog/actions"));
        return ResponseEntity.ok(out);
    }

    /** The exact JSON the drafter must emit, matching what the builder persists. */
    private Map<String, Object> workflowJsonShape() {
        Map<String, Object> shape = new LinkedHashMap<>();
        shape.put("name", "string");
        shape.put("description", "string");
        shape.put("workflow_type", "EVENT_DRIVEN | SCHEDULED");
        shape.put("trigger", m(
                "trigger_event_name", "e.g. AUDIENCE_LEAD_SUBMISSION (EVENT_DRIVEN only)",
                "event_applied_type", "e.g. AUDIENCE (metadata only — does NOT scope matching)",
                "event_id", "specific entity id, or null for 'all'"));
        shape.put("schedule", m(
                "schedule_type", "CRON (SCHEDULED only)",
                "cron_expression", "Quartz 6-field, e.g. 0 0 9 * * ? = 9AM daily",
                "timezone", "e.g. Asia/Kolkata"));
        shape.put("nodes", List.of(m(
                "id", "client-generated uuid (referenced by edges + routing)",
                "name", "human label",
                "node_type", "TRIGGER | QUERY | SEND_EMAIL | ... (flat field, NOT nested under data)",
                "config", m("...", "per-node config incl. routing[]"),
                "position_x", 250,
                "position_y", 80,
                "is_start_node", "true for the TRIGGER / first node, else false")));
        shape.put("edges", List.of(m(
                "id", "client-generated uuid",
                "source_node_id", "<nodeId>",
                "target_node_id", "<nodeId>")));
        return shape;
    }

    /** Hard rules the generator must obey — each encodes an audited failure mode. */
    private List<String> generationRules() {
        return List.of(
            "QUERY 'resultKey' is IGNORED — reference a query's real output keys (e.g. 'students', 'leads', 'ssigm_list'), never a made-up key. Two queries emitting the same key clobber each other.",
            "SEND_EMAIL / SEND_WHATSAPP 'on' must resolve to a List. Wrap a single object as a SpEL list literal: \"{#ctx['user']}\".",
            "Recipient and templateVars field names must exist in the source query's output item fields. Casing differs per query (snake_case vs camelCase) — copy from readQueries[].itemFields.",
            "Trigger scoping is by event_id only; event_applied_type is metadata and does NOT scope. Set event_id to a real institute-owned entity, or null for 'all'.",
            "For at-least-once event emitters, set idempotency strategy EVENT_BASED (default UUID = no dedup, double-fires).",
            "Never emit a mutating prebuiltKey in a workflow the admin will Test Run — QueryNodeHandler has no dryRun gate. See mutatingQueryKeys.",
            "Never use ROUTER (no handler) or SEND_PUSH_NOTIFICATION (stub). See avoidNodeTypes.",
            "DELAY config is nested: config.delay.{value,unit}. Never flat delayValue/delayUnit (executes as 0-delay).",
            "Every node must be reachable from the start node; every path must reach a routing {type:end}; every routing targetNodeId must reference a real node id.",
            "templateName must reference an ACTIVE institute template of the right channel (EMAIL/WHATSAPP). If none exists, ask the admin to create it rather than inventing one.",
            "All entity ids (event_id, batchId, audienceId, ...) must belong to the requesting institute — never cross-tenant.",
            "Warn (in rationale) when using INVITE_FORM_FILL (fires on invite-page view, not submit) or LIVE_SESSION_START/END (5-min scan approximations).");
    }

    private List<Map<String, Object>> nodeTypes() {
        List<Map<String, Object>> nodes = new ArrayList<>();
        nodes.add(node("TRIGGER", "Marks the start node; no execution behavior.", true, false,
                "{\"triggerEvent\":\"AUDIENCE_LEAD_SUBMISSION\",\"routing\":[{\"type\":\"goto\",\"targetNodeId\":\"...\"}]}",
                "isStartNode=true on its mapping."));
        nodes.add(node("QUERY", "Runs a prebuilt query; flat-merges output keys into context.", true, false,
                "{\"prebuiltKey\":\"fetch_students_by_batch\",\"params\":{\"batchId\":\"#ctx['packageSessionIds']\"},\"routing\":[{\"type\":\"goto\",\"targetNodeId\":\"...\"}]}",
                "resultKey ignored. instituteId auto-injected. NO dryRun gate — mutating keys run for real."));
        nodes.add(node("SEND_EMAIL", "Iterates 'on' (a List) and sends one email per item.", true, false,
                "{\"templateName\":\"...\",\"on\":\"#ctx['students']\",\"forEach\":{\"operation\":\"SEND_EMAIL\",\"eval\":\"#ctx['item']\"},\"recipientField\":\"email\",\"templateVars\":{\"fullName\":\"fullName\"},\"routing\":[{\"type\":\"end\"}]}",
                "'on' must be a List. Recipient resolved from recipientField then to/email/... Rate-limited."));
        nodes.add(node("SEND_WHATSAPP", "Like SEND_EMAIL for WhatsApp; mobile-based recipients.", true, false,
                "{\"templateName\":\"...\",\"on\":\"#ctx['leads']\",\"forEach\":{\"operation\":\"SEND_WHATSAPP\",\"eval\":\"#ctx['item']\"},\"templateVars\":{},\"routing\":[{\"type\":\"end\"}]}",
                "'on' must be a List. Mobile from mobileNumber/mobile/phone/to. Rate-limited."));
        nodes.add(node("HTTP_REQUEST", "Generic HTTP call; response namespaced under resultKey.", true, false,
                "{\"resultKey\":\"httpResult\",\"config\":{\"requestType\":\"EXTERNAL\",\"method\":\"POST\",\"url\":\"...\",\"body\":{}},\"routing\":[{\"type\":\"end\"}]}",
                "Response at #ctx['<resultKey>']['body']. Optional SpEL 'condition' to skip."));
        nodes.add(node("DELAY", "Pauses; >60s persists and resumes via Quartz (survives restart).", true, false,
                "{\"delay\":{\"value\":3,\"unit\":\"DAYS\"},\"routing\":[{\"type\":\"goto\",\"targetNodeId\":\"...\"}]}",
                "Nested delay.{value,unit}. Units SECONDS/MINUTES/HOURS/DAYS."));
        nodes.add(node("CONDITION", "Boolean SpEL branch.", true, false,
                "{\"condition\":\"#ctx['enrolled'] == false\",\"routing\":[{\"type\":\"conditional\",\"trueNodeId\":\"...\",\"falseNodeId\":\"...\"}]}",
                "Sets conditionResult; routes on trueNodeId/falseNodeId."));
        nodes.add(node("FILTER", "Filters a list by a per-item SpEL predicate.", true, false,
                "{\"source\":\"#ctx['leads']\",\"condition\":\"#item['age'] > 18\",\"resultKey\":\"adults\",\"routing\":[{\"type\":\"goto\",\"targetNodeId\":\"...\"}]}",
                "Output under resultKey (FILTER does honor it)."));
        nodes.add(node("TRANSFORM", "Computes context fields via SpEL (outputDataPoints).", true, false,
                "{\"outputDataPoints\":[{\"fieldName\":\"whatsappMessages\",\"compute\":\"...SpEL...\"}],\"routing\":[{\"type\":\"goto\",\"targetNodeId\":\"...\"}]}",
                "Returns only the diff, flat-merged."));
        nodes.add(node("SET_LEAD_STATUS", "Sets a CRM lead's status.", false, true,
                "{\"statusKey\":\"INTERESTED\",\"routing\":[{\"type\":\"end\"}]}",
                "Resolves lead by responseId/leadId. NO dryRun gate — mutates in Test Run."));
        nodes.add(node("COMBOT", "Meta Cloud-API WhatsApp send.", false, true,
                "{\"templateName\":\"...\",\"on\":\"#ctx['leads']\",\"routing\":[{\"type\":\"end\"}]}",
                "No dryRun/rate-limit/log/dedup — sends real messages in Test Run. Prefer SEND_WHATSAPP."));
        return nodes;
    }

    /** Read-only queries the generator will actually compose with, plus their output shapes. */
    private List<Map<String, Object>> readQueries() {
        List<Map<String, Object>> q = new ArrayList<>();
        q.add(query("fetch_audience_responses_filtered",
                List.of("instituteId"), List.of("audienceId", "daysAgo", "startDate", "endDate"),
                List.of("leads"),
                "leads[]: email, parentEmail, parentName, mobileNumber, userId, instituteName + all custom fields in RAW case"));
        q.add(query("fetch_audience_responses_by_day_difference",
                List.of("instituteId", "audienceId", "daysAgo"), List.of("conversionStatus"),
                List.of("leads"),
                "leads[]: same as filtered but custom-field keys are LOWERCASED. Matches responses exactly N days ago."));
        q.add(query("fetch_batch_attendance_report",
                List.of("instituteId"), List.of("batchId", "daysBack"),
                List.of("students", "totalStudents", "batchCount", "startDate", "endDate"),
                "students[]: studentId, fullName, email, mobileNumber, attendancePercentage, sessionsAttended, totalDurationMinutes, totalChats, totalHandRaises, parentsEmail, guardianEmail, sessionsTableHtml (camelCase)"));
        q.add(query("fetch_students_by_batch",
                List.of("instituteId"), List.of("batchId"),
                List.of("students", "totalStudents"),
                "students[]: userId, fullName, email, mobileNumber, parentsEmail, guardianEmail (camelCase; lightweight, no attendance)"));
        q.add(query("fetch_ssigm_by_package",
                List.of("instituteId"), List.of("batchId", "statusList"),
                List.of("ssigm_list", "mapping_count"),
                "ssigm_list[]: mapping_id, user_id, expiry_date, full_name, mobile_number, email, username, package_session_id (snake_case)"));
        q.add(query("fetch_institute_admin_emails",
                List.of("instituteId"), List.of("roles"),
                List.of("adminContacts"),
                "adminContacts[]: userId, email, fullName, mobileNumber, role (roles default 'ADMIN,TEACHER')"));
        q.add(query("fetch_expiring_memberships",
                List.of("instituteId"), List.of("daysUntilExpiry"),
                List.of("expiringMemberships", "expiringCount"),
                "expiringMemberships[]: userPlanId, userId, email, fullName, mobileNumber, endDate (institute-scoped, ACTIVE plans expiring within N days)"));
        q.add(query("fetch_live_session_attendance",
                List.of("sessionId", "scheduleId"), List.of(),
                List.of("presentStudents", "absentStudents", "presentCount", "absentCount", "sessionTitle"),
                "present/absentStudents[]: fullName, email, mobileNumber, joinTime, attendedMinutes, attendancePercentage, attendanceBlockHtml"));
        q.add(query("fetch_enrollment_details",
                List.of("userId"), List.of("packageSessionId", "packageSessionIds", "instituteId"),
                List.of("(flat enrollment + payment fields)"),
                "flat camelCase map of the learner's enrollment + payment status; used to gate abandoned-cart / webhook flows"));
        q.add(query("fetch_upcoming_fee_installments",
                List.of("instituteId"), List.of("daysBeforeWindow", "daysAfterWindow"),
                List.of("feePaymentList"),
                "feePaymentList[]: learner fee installments due in the window (camelCase)"));
        return q;
    }

    private List<Map<String, Object>> commonTriggers() {
        List<Map<String, Object>> t = new ArrayList<>();
        t.add(trigger("AUDIENCE_LEAD_SUBMISSION", "AUDIENCE", "audienceId (or null=all)",
                "lead, customFields, respondentEmailRequests, adminEmailRequests, instituteName, campaignName",
                "Fires once per form submission with that single lead's data."));
        t.add(trigger("LEARNER_BATCH_ENROLLMENT", "PACKAGE_SESSION", "packageSessionId (or null=all)",
                "user (UserDTO), packageSessionIds, packageId, subOrg",
                null));
        t.add(trigger("LIVE_SESSION_CREATE", "LIVE_SESSION", "liveSessionId (or null=all)",
                "liveSession (title, startTime, defaultMeetLink...), createdBy, instituteId",
                "No student emails in context — add a QUERY to fetch recipients."));
        t.add(trigger("ABANDONED_CART", "ENROLL_INVITE", "enrollInviteId (or null=all)",
                "user, userPlanId, packageSessionId, packageId",
                null));
        t.add(trigger("PAYMENT_FAILED", "ENROLL_INVITE", "enrollInviteId (or null=all)",
                "paymentLog, user, userPlanId, packageSessionIds, enrollInviteId",
                null));
        t.add(trigger("MEMBERSHIP_EXPIRY", "USER_PLAN", "null (institute-wide, daily 09:00 cron)",
                "expiring plan context",
                "Emitted by a daily scheduler; use EVENT_BASED idempotency."));
        t.add(trigger("LEAD_ASSIGNED_TO_COUNSELOR", "AUDIENCE", "audienceId or poolId",
                "see /catalog/trigger-context-variables (leadName, counselorEmail, tat, ...)",
                null));
        return t;
    }

    // ---- small builders --------------------------------------------------

    private Map<String, Object> node(String type, String purpose, boolean dryRunSafe, boolean mutating,
                                     String configExample, String notes) {
        Map<String, Object> n = new LinkedHashMap<>();
        n.put("type", type);
        n.put("purpose", purpose);
        n.put("dryRunSafe", dryRunSafe);
        n.put("mutating", mutating);
        n.put("configExample", configExample);
        n.put("notes", notes);
        return n;
    }

    private Map<String, Object> query(String key, List<String> required, List<String> optional,
                                      List<String> outputKeys, String itemFields) {
        Map<String, Object> q = new LinkedHashMap<>();
        q.put("key", key);
        q.put("requiredParams", required);
        q.put("optionalParams", optional);
        q.put("outputKeys", outputKeys);
        q.put("itemFields", itemFields);
        return q;
    }

    private Map<String, Object> trigger(String event, String appliedType, String eventIdMeaning,
                                        String producedContextKeys, String notes) {
        Map<String, Object> t = new LinkedHashMap<>();
        t.put("event", event);
        t.put("eventAppliedType", appliedType);
        t.put("eventIdMeaning", eventIdMeaning);
        t.put("producedContextKeys", producedContextKeys);
        if (notes != null) t.put("notes", notes);
        return t;
    }

    /** Ordered map from alternating key/value pairs (avoids Map.of's 10-entry cap + null rejection). */
    private Map<String, Object> m(Object... kv) {
        Map<String, Object> map = new LinkedHashMap<>();
        for (int i = 0; i + 1 < kv.length; i += 2) {
            map.put(String.valueOf(kv[i]), kv[i + 1]);
        }
        return map;
    }
}
