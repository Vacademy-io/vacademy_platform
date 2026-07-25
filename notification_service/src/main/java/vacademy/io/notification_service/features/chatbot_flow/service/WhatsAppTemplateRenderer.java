package vacademy.io.notification_service.features.chatbot_flow.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import vacademy.io.notification_service.features.chatbot_flow.entity.NotificationTemplate;
import vacademy.io.notification_service.features.chatbot_flow.repository.NotificationTemplateRepository;
import vacademy.io.notification_service.features.notification_log.entity.NotificationLog;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Rebuilds the real message a recipient saw for an outgoing WhatsApp <b>template</b> send.
 *
 * <p>Template sends are stored on {@link NotificationLog} with an opaque summary body
 * ("WhatsApp Template: launchoffer | Provider: META | Status: SUCCESS | Params: {...}"), while the
 * structured send context (templateName + bodyParams + provider) is preserved separately on
 * {@link NotificationLog#getMessagePayload()}. Joining that payload with the stored template body and
 * substituting the params reconstructs the actual text — retroactively for every historical row and
 * without ever mutating stored data.
 *
 * <p>Shared by every surface that lists these logs (WhatsApp Inbox, per-student communication
 * timeline) so the substitution logic lives in exactly one place. Callers create a short-lived
 * {@link #newCache()} per request and pass it into each {@link #render} call so templates are loaded
 * once per institute, not once per message.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class WhatsAppTemplateRenderer {

    private final NotificationTemplateRepository notificationTemplateRepository;

    private static final ObjectMapper objectMapper = new ObjectMapper();
    /** Matches {{1}} / {{ name }} placeholders (token filled in per-call). */
    private static final String PLACEHOLDER_FMT = "\\{\\{\\s*%s\\s*\\}\\}";

    /** Result of rebuilding a template message. */
    public static class Rendered {
        /** Rebuilt message text, or {@code null} when the template is no longer on file. */
        public String body;
        public String templateName;
        public String provider;
        /** SUCCESS or FAILED — whether the provider accepted the send. */
        public String deliveryStatus;
        /** Provider rejection reason, when deliveryStatus == FAILED. */
        public String error;
        /** Template header type: NONE, TEXT, IMAGE, VIDEO, DOCUMENT. */
        public String headerType;
    }

    /** Create a fresh per-request template cache (institute id → its templates). */
    public Map<String, InstituteTemplates> newCache() {
        return new HashMap<>();
    }

    /**
     * Rebuilds the message body for an outgoing template send. Returns {@code null} for anything
     * that isn't a structured template send (incoming messages, free-text replies, other payload
     * shapes), and a {@link Rendered} whose {@code body} is {@code null} when the template can't be
     * found (caller then falls back to the stored summary body).
     *
     * @param fallbackInstituteId used when the log row itself has no institute stamped (legacy rows)
     */
    public Rendered render(NotificationLog nl, String fallbackInstituteId,
                           Map<String, InstituteTemplates> cache) {
        if (nl == null || nl.getNotificationType() == null
                || !nl.getNotificationType().contains("OUTGOING")) {
            return null;
        }
        String payloadJson = nl.getMessagePayload();
        if (payloadJson == null || payloadJson.isBlank()) return null;

        try {
            Map<String, Object> payload = objectMapper.readValue(payloadJson,
                    new TypeReference<Map<String, Object>>() {});
            Object templateNameObj = payload.get("templateName");
            if (templateNameObj == null) return null;

            Rendered rm = new Rendered();
            rm.templateName = templateNameObj.toString();
            rm.provider = asString(payload.get("provider"));
            rm.error = asString(payload.get("error"));
            rm.deliveryStatus = rm.error != null ? "FAILED" : "SUCCESS";

            Map<String, String> bodyParams = asStringMap(payload.get("bodyParams"));
            Map<String, String> headerParams = asStringMap(payload.get("headerParams"));
            String language = asString(payload.get("languageCode"));

            String instituteId = (nl.getInstituteId() != null && !nl.getInstituteId().isBlank())
                    ? nl.getInstituteId() : fallbackInstituteId;

            NotificationTemplate tmpl = lookupTemplate(instituteId, rm.templateName, language, cache);
            if (tmpl != null) {
                rm.headerType = tmpl.getHeaderType();
                rm.body = composeMessage(tmpl, bodyParams, headerParams);
            }
            return rm;
        } catch (Exception e) {
            log.debug("Failed to render template message {}: {}", nl.getId(), e.getMessage());
            return null;
        }
    }

    /** Convenience: rendered message text, or the stored body when it can't be rebuilt. */
    public String displayBody(NotificationLog nl, String fallbackInstituteId,
                              Map<String, InstituteTemplates> cache) {
        Rendered rm = render(nl, fallbackInstituteId, cache);
        return (rm != null && rm.body != null) ? rm.body : (nl != null ? nl.getBody() : null);
    }

    // ==================== Rendering ====================

    /** Header text + substituted body + footer, joined the way it renders in WhatsApp. */
    private String composeMessage(NotificationTemplate tmpl, Map<String, String> bodyParams,
                                  Map<String, String> headerParams) {
        StringBuilder sb = new StringBuilder();

        String headerType = tmpl.getHeaderType();
        if ("TEXT".equalsIgnoreCase(headerType) && isNotBlank(tmpl.getHeaderText())) {
            String header = substitute(tmpl.getHeaderText(), null, headerParams).trim();
            if (!header.isEmpty()) sb.append(header).append("\n\n");
        } else if (isMediaHeader(headerType)) {
            sb.append("[").append(headerType.substring(0, 1).toUpperCase())
                    .append(headerType.substring(1).toLowerCase()).append("]\n\n");
        }

        String body = substitute(tmpl.getBodyText(), tmpl.getBodyVariableNames(), bodyParams);
        if (isNotBlank(body)) sb.append(body.trim());

        if (isNotBlank(tmpl.getFooterText())) {
            sb.append("\n\n").append(tmpl.getFooterText().trim());
        }

        String out = sb.toString().trim();
        return out.isEmpty() ? null : out;
    }

    /**
     * Substitutes template placeholders with param values. Covers both flavours WhatsApp templates
     * use: named ({@code {{name}}}) and positional ({@code {{1}}}). Positional mapping uses the
     * template's ordered variable-name array — position i maps to {@code {{i+1}}}.
     */
    private String substitute(String text, String orderingJson, Map<String, String> params) {
        if (text == null || params == null || params.isEmpty()) return text;

        String result = text;
        // Named-style placeholders — also covers positional templates whose params are keyed "1","2".
        for (Map.Entry<String, String> e : params.entrySet()) {
            if (e.getKey() == null) continue;
            String value = e.getValue() != null ? e.getValue() : "";
            result = replacePlaceholder(result, e.getKey(), value);
            result = replacePlaceholder(result, cleanName(e.getKey()), value);
        }
        // Positional placeholders resolved through the ordered variable names.
        List<String> ordering = parseStringArray(orderingJson);
        for (int i = 0; i < ordering.size(); i++) {
            String value = lookupParam(params, ordering.get(i));
            if (value != null) {
                result = replacePlaceholder(result, String.valueOf(i + 1), value);
            }
        }
        return result;
    }

    private String replacePlaceholder(String text, String token, String value) {
        if (token == null || token.isEmpty()) return text;
        Pattern p = Pattern.compile(String.format(PLACEHOLDER_FMT, Pattern.quote(token)));
        return p.matcher(text).replaceAll(Matcher.quoteReplacement(value));
    }

    private String lookupParam(Map<String, String> params, String name) {
        if (name == null) return null;
        if (params.containsKey(name)) return params.get(name);
        String clean = cleanName(name);
        for (Map.Entry<String, String> e : params.entrySet()) {
            if (cleanName(e.getKey()).equals(clean)) return e.getValue();
        }
        return null;
    }

    /** Same normalisation the unified send path uses for named→positional resolution. */
    private String cleanName(String name) {
        return name == null ? "" : name.trim().toLowerCase().replaceAll("[^a-z0-9_]", "_");
    }

    private List<String> parseStringArray(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return Arrays.asList(objectMapper.readValue(json, String[].class));
        } catch (Exception e) {
            return List.of();
        }
    }

    private Map<String, String> asStringMap(Object obj) {
        Map<String, String> out = new LinkedHashMap<>();
        if (obj instanceof Map<?, ?> map) {
            for (Map.Entry<?, ?> e : map.entrySet()) {
                if (e.getKey() != null && e.getValue() != null) {
                    out.put(e.getKey().toString(), e.getValue().toString());
                }
            }
        }
        return out;
    }

    private String asString(Object obj) {
        return obj != null ? obj.toString() : null;
    }

    private boolean isNotBlank(String s) {
        return s != null && !s.isBlank();
    }

    private boolean isMediaHeader(String headerType) {
        return "IMAGE".equalsIgnoreCase(headerType)
                || "VIDEO".equalsIgnoreCase(headerType)
                || "DOCUMENT".equalsIgnoreCase(headerType);
    }

    // ==================== Template lookup (cached per institute) ====================

    private NotificationTemplate lookupTemplate(String instituteId, String templateName,
                                                String language, Map<String, InstituteTemplates> cache) {
        if (instituteId == null || instituteId.isBlank() || templateName == null) return null;
        InstituteTemplates templates = cache.computeIfAbsent(instituteId, this::loadInstituteTemplates);
        return templates.find(templateName, language);
    }

    /** Loads every template for an institute once, so per-message rendering is a map lookup. */
    private InstituteTemplates loadInstituteTemplates(String instituteId) {
        Map<String, NotificationTemplate> byName = new HashMap<>();
        Map<String, NotificationTemplate> byNameLang = new HashMap<>();
        try {
            for (NotificationTemplate t : notificationTemplateRepository
                    .findByInstituteIdOrderByUpdatedAtDesc(instituteId)) {
                if (t.getName() == null) continue;
                String nameLower = t.getName().toLowerCase();
                byName.putIfAbsent(nameLower, t); // most-recently-updated wins
                String lang = t.getLanguage() != null ? t.getLanguage().toLowerCase() : "en";
                byNameLang.putIfAbsent(nameLower + "|" + lang, t);
            }
        } catch (Exception e) {
            log.warn("Failed to load templates for institute {}: {}", instituteId, e.getMessage());
        }
        return new InstituteTemplates(byName, byNameLang);
    }

    /** Case-insensitive template resolver for a single institute, preferring an exact language match. */
    public record InstituteTemplates(Map<String, NotificationTemplate> byName,
                                     Map<String, NotificationTemplate> byNameLang) {
        NotificationTemplate find(String name, String language) {
            if (name == null) return null;
            String nameLower = name.toLowerCase();
            if (language != null && !language.isBlank()) {
                NotificationTemplate t = byNameLang.get(nameLower + "|" + language.toLowerCase());
                if (t != null) return t;
            }
            return byName.get(nameLower);
        }
    }
}
