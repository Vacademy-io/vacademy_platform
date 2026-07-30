package vacademy.io.admin_core_service.features.institute.service.setting;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.institute.enums.SettingKeyEnums;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.common.institute.entity.Institute;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

/**
 * Server-side reader for an institute's custom terminology (Settings &gt; Naming Settings).
 *
 * <p>Naming Settings has historically been a FRONT-END-only display layer: the admin app
 * calls {@code getTerminology()} against a localStorage copy, so anything the backend
 * persists as a human-readable name (sub-org invite names, payment option / plan names)
 * kept its hardcoded English wording no matter what the institute renamed things to.
 * This service closes that gap for backend-minted names.
 *
 * <p>Storage shape — {@code institutes.setting_json}:
 * <pre>
 * { "setting": { "NAMING_SETTING": { "data": { "data": [
 *       { "key": "SubOrg",        "systemValue": "Sub-Org",  "customValue": "Branch"   },
 *       { "key": "SubOrg_plural", "systemValue": "Sub-Orgs", "customValue": "Branches" },
 *       ...
 * ] } } } }
 * </pre>
 * The same node {@code DomainRoutingService.extractNamingOverrides} already reads for the
 * {@code Course} override — this generalises it to any term.
 *
 * <p>Resolution is best-effort by design: a missing setting, malformed JSON or a blank
 * {@code customValue} all fall back to the caller's default, so naming never blocks the
 * operation that needed the label.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class InstituteTerminologyService {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    /** Term keys, matching the enums in the admin app's settings/-constants/terms.ts. */
    public static final String SUB_ORG = "SubOrg";
    public static final String LEARNER = "Learner";
    public static final String COURSE = "Course";
    public static final String INVITE = "Invite";
    public static final String ADMIN = "Admin";

    /** Built-in defaults, matching SystemTerms on the front end. */
    public static final String DEFAULT_SUB_ORG = "Sub-Org";
    public static final String DEFAULT_LEARNER = "Learner";

    /**
     * Legacy key aliases. The settings UI renamed a few keys over time but never migrated
     * already-persisted rows, so institutes configured before the rename still store the
     * OLD key — e.g. the learner role sits under {@code "Student"} on older institutes and
     * {@code "Learner"} on newer ones. Looking up only the current key would silently fall
     * back to the default for every one of those institutes.
     */
    private static final Map<String, String> KEY_ALIASES = Map.of(
            LEARNER, "Student",
            "Subject", "Subjects",
            "Module", "Modules",
            "Chapter", "Chapters",
            "Slide", "Slides");

    private final InstituteRepository instituteRepository;

    /**
     * Resolved terminology for one institute. Parse once per operation and pass this
     * around rather than re-reading {@code setting_json} per label.
     */
    public static final class Terms {

        private static final Terms EMPTY = new Terms(Collections.emptyMap());

        private final Map<String, String> values;

        private Terms(Map<String, String> values) {
            this.values = values;
        }

        /** Custom singular for {@code key}, else {@code defaultValue}. */
        public String get(String key, String defaultValue) {
            String direct = values.get(key);
            if (StringUtils.hasText(direct)) return direct;
            String alias = KEY_ALIASES.get(key);
            if (alias != null) {
                String aliased = values.get(alias);
                if (StringUtils.hasText(aliased)) return aliased;
            }
            return defaultValue;
        }

        /** Custom plural for {@code key} ({@code <key>_plural}), else {@code defaultValue}. */
        public String getPlural(String key, String defaultValue) {
            return get(key + "_plural", defaultValue);
        }

        public String subOrg() {
            return get(SUB_ORG, DEFAULT_SUB_ORG);
        }

        public String learner() {
            return get(LEARNER, DEFAULT_LEARNER);
        }
    }

    /** Terminology for {@code instituteId}; never null — falls back to defaults. */
    public Terms forInstitute(String instituteId) {
        if (!StringUtils.hasText(instituteId)) return Terms.EMPTY;
        try {
            return instituteRepository.findById(instituteId)
                    .map(this::forInstitute)
                    .orElse(Terms.EMPTY);
        } catch (Exception e) {
            log.warn("Could not load institute {} for terminology; using defaults", instituteId, e);
            return Terms.EMPTY;
        }
    }

    /** Terminology for an already-loaded institute (no extra DB round-trip). */
    public Terms forInstitute(Institute institute) {
        if (institute == null) return Terms.EMPTY;
        return parse(institute.getSetting());
    }

    private Terms parse(String settingJson) {
        if (!StringUtils.hasText(settingJson)) return Terms.EMPTY;
        try {
            JsonNode entries = OBJECT_MAPPER.readTree(settingJson)
                    .path("setting")
                    .path(SettingKeyEnums.NAMING_SETTING.name())
                    .path("data")
                    .path("data");
            if (!entries.isArray() || entries.isEmpty()) return Terms.EMPTY;

            Map<String, String> values = new HashMap<>();
            for (JsonNode entry : entries) {
                String key = entry.path("key").asText(null);
                String customValue = entry.path("customValue").asText(null);
                if (StringUtils.hasText(key) && StringUtils.hasText(customValue)) {
                    values.put(key, customValue);
                }
            }
            return values.isEmpty() ? Terms.EMPTY : new Terms(values);
        } catch (Exception e) {
            log.warn("Failed to parse NAMING_SETTING; using default terminology", e);
            return Terms.EMPTY;
        }
    }
}
