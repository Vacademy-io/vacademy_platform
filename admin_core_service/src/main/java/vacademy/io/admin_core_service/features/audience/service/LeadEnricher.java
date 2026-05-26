package vacademy.io.admin_core_service.features.audience.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.Arrays;
import java.util.List;
import java.util.Map;

/**
 * Shared enrichment used by both the form-webhook and ad-platform paths.
 *
 *   composeFullName  — if a lead has separate first/last fields and no name
 *                      field already set, write the joined value to common
 *                      audience-field aliases.
 *   mergeDefaults    — merge a connector's default_values_json into the lead's
 *                      form fields. Form values always win; defaults only fill
 *                      gaps (used for stamping per-center constants like
 *                      `Center Name` onto every lead from that connector).
 */
@Component
public class LeadEnricher {

    private static final Logger logger = LoggerFactory.getLogger(LeadEnricher.class);

    private static final List<String> FIRST_NAME_KEYS =
            Arrays.asList("first_name", "first name", "firstName", "FIRST_NAME");
    private static final List<String> LAST_NAME_KEYS =
            Arrays.asList("last_name", "last name", "lastName", "LAST_NAME");
    private static final List<String> EXISTING_FULL_NAME_KEYS =
            Arrays.asList("Full Name", "full name", "full_name", "fullName",
                    "FULL_NAME", "parent name", "Name", "name");
    private static final List<String> FULL_NAME_OUTPUT_ALIASES =
            Arrays.asList("Full Name", "full name", "full_name", "fullName", "parent name");

    @Autowired
    private ObjectMapper objectMapper;

    public void composeFullName(Map<String, String> formFields) {
        if (formFields == null) return;

        for (String key : EXISTING_FULL_NAME_KEYS) {
            if (StringUtils.hasText(formFields.get(key))) {
                return;
            }
        }

        String first = firstNonBlank(formFields, FIRST_NAME_KEYS);
        String last = firstNonBlank(formFields, LAST_NAME_KEYS);
        if (!StringUtils.hasText(first) && !StringUtils.hasText(last)) {
            return;
        }

        String composed = (StringUtils.hasText(first) ? first.trim() : "")
                + ((StringUtils.hasText(first) && StringUtils.hasText(last)) ? " " : "")
                + (StringUtils.hasText(last) ? last.trim() : "");

        for (String alias : FULL_NAME_OUTPUT_ALIASES) {
            formFields.putIfAbsent(alias, composed);
        }
        logger.debug("composeFullName wrote '{}' to name aliases", composed);
    }

    public void mergeDefaults(Map<String, String> formFields, String defaultValuesJson) {
        if (formFields == null || !StringUtils.hasText(defaultValuesJson)) {
            return;
        }
        try {
            Map<String, String> defaults = objectMapper.readValue(
                    defaultValuesJson,
                    new TypeReference<Map<String, String>>() {}
            );
            int merged = 0;
            for (Map.Entry<String, String> entry : defaults.entrySet()) {
                if (!formFields.containsKey(entry.getKey())) {
                    formFields.put(entry.getKey(), entry.getValue());
                    merged++;
                }
            }
            if (merged > 0) {
                logger.info("LeadEnricher merged {} default values", merged);
            }
        } catch (Exception e) {
            logger.error("Failed to parse defaultValuesJson: {}", defaultValuesJson, e);
        }
    }

    private String firstNonBlank(Map<String, String> map, List<String> keys) {
        for (String k : keys) {
            String v = map.get(k);
            if (StringUtils.hasText(v)) return v;
        }
        return null;
    }
}
