package vacademy.io.admin_core_service.features.certificate.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.common.entity.CustomFieldValues;
import vacademy.io.admin_core_service.features.common.repository.CustomFieldValuesRepository;
import vacademy.io.admin_core_service.features.institute.enums.CertificateTypeEnum;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/**
 * Resolves an institute's admin-defined certificate fields into
 * {@code {{CF_<KEY>}} → value} substitutions.
 *
 * <p><b>Why this exists.</b> The built-in token list is platform-wide and fixed.
 * An institute that needs "Grade", "Director of Studies" or an accreditation
 * line on its certificates had no way to add one — and dropping an unrecognised
 * chip on the canvas produced a {@code {{GRADE}}} token that nothing
 * substituted, so the raw token printed on the learner's PDF.
 *
 * <p><b>Why the CF_ prefix.</b> Admin-chosen keys share a namespace with the
 * built-in tokens. Without a prefix, a field keyed {@code STUDENT_NAME} would
 * shadow the real one and quietly replace every learner's name with a constant.
 *
 * <p>Every failure path here yields an empty string rather than propagating: a
 * missing custom field must not stop a learner receiving their certificate.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CertificateCustomFieldService {

    private final ObjectMapper objectMapper;
    private final CustomFieldValuesRepository customFieldValuesRepository;

    /** Namespace for admin-defined tokens. See the class javadoc. */
    public static final String TOKEN_PREFIX = "CF_";

    private static final String SOURCE_TYPE_USER = "USER";
    private static final String VALUE_TYPE_CUSTOM_FIELD = "CUSTOM_FIELD";

    /**
     * @param settingJson the institute's full setting blob
     * @param userId      the learner the certificate is for; may be null, in
     *                    which case CUSTOM_FIELD entries fall back
     * @return token → value, ready to merge into the substitution map. Never null.
     */
    public Map<String, String> resolveTokens(String settingJson, String userId) {
        Map<String, String> tokens = new HashMap<>();
        JsonNode customFields = readCustomFieldDefinitions(settingJson);
        if (customFields == null || !customFields.isArray()) {
            return tokens;
        }

        for (JsonNode definition : customFields) {
            String key = normaliseKey(definition.path("key").asText(null));
            if (key == null) {
                continue;
            }
            String valueType = definition.path("valueType").asText(null);
            String value = definition.path("value").asText("");
            String fallback = definition.path("fallbackValue").asText("");

            String resolved;
            if (VALUE_TYPE_CUSTOM_FIELD.equalsIgnoreCase(valueType)) {
                resolved = lookupLearnerValue(userId, value).orElse(fallback);
            } else {
                // Null/unrecognised valueType means STATIC — the safe reading,
                // since a static literal renders exactly what the admin typed.
                resolved = value;
            }
            tokens.put("{{" + TOKEN_PREFIX + key + "}}", resolved == null ? "" : resolved);
        }
        return tokens;
    }

    /**
     * The learner's own answer for a custom field, by the field's key.
     *
     * <p>Deliberately not scoped to the institute: the caller already resolved
     * this learner from an institute-scoped enrolment, and {@code custom_fields}
     * rows are shared across institutes, so an extra join would drop legitimate
     * values for institutes that never registered the field in
     * {@code institute_custom_fields}.
     */
    private Optional<String> lookupLearnerValue(String userId, String fieldKey) {
        if (!StringUtils.hasText(userId) || !StringUtils.hasText(fieldKey)) {
            return Optional.empty();
        }
        try {
            return customFieldValuesRepository
                    .findBySourceIdAndFieldKeyAndSourceType(userId, fieldKey.trim(), SOURCE_TYPE_USER)
                    .map(CustomFieldValues::getValue)
                    .filter(StringUtils::hasText);
        } catch (Exception e) {
            log.warn("Could not read custom field '{}' for user {} while rendering a certificate",
                    fieldKey, userId, e);
            return Optional.empty();
        }
    }

    private JsonNode readCustomFieldDefinitions(String settingJson) {
        if (!StringUtils.hasText(settingJson)) {
            return null;
        }
        try {
            JsonNode entries = objectMapper.readTree(settingJson)
                    .path("setting").path("CERTIFICATE_SETTING").path("data").path("data");
            if (!entries.isArray()) {
                return null;
            }
            for (JsonNode config : entries) {
                if (CertificateTypeEnum.COURSE_COMPLETION.name().equals(config.path("key").asText(null))) {
                    return config.path("customFields");
                }
            }
        } catch (Exception e) {
            log.warn("Could not read certificate custom field definitions; rendering without them", e);
        }
        return null;
    }

    /**
     * Uppercase, {@code [A-Z0-9_]} only — the shape the editor emits into the
     * template. Normalising both here and in the editor means a key saved with
     * stray spaces or a lowercase letter still matches its token instead of
     * silently rendering blank.
     */
    static String normaliseKey(String raw) {
        if (!StringUtils.hasText(raw)) {
            return null;
        }
        String cleaned = raw.trim().toUpperCase().replaceAll("[^A-Z0-9]+", "_")
                .replaceAll("^_+", "").replaceAll("_+$", "");
        return cleaned.isEmpty() ? null : cleaned;
    }
}
