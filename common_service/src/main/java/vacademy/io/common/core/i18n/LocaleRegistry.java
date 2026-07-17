package vacademy.io.common.core.i18n;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Canonical registry of locales supported by the Vacademy platform (BCP-47
 * primary language subtags). This is the single backend source of truth —
 * frontend locale registries mirror this list and MUST stay in sync.
 *
 * All lookups are lenient: tags are case-insensitive, tolerate underscores
 * ("hi_IN"), and fall back to the primary subtag ("hi-IN" → "hi"). Anything
 * unrecognised normalizes to {@link #DEFAULT}.
 */
public final class LocaleRegistry {

    /** Supported locale tags, in canonical display order. */
    public static final List<String> SUPPORTED = List.of(
            "en", "ar", "hi", "ta", "te", "bn", "mr", "gu", "kn", "ml", "pa", "or", "as", "es", "fr");

    /** Fallback locale for anything unsupported / unparseable. */
    public static final String DEFAULT = "en";

    /** Locales written right-to-left. */
    public static final Set<String> RTL = Set.of("ar");

    /** Native-script display label per locale, in canonical order. */
    public static final Map<String, String> NATIVE_LABELS;

    /** Writing script per locale (informational — used by font pipelines). */
    public static final Map<String, String> SCRIPTS;

    static {
        Map<String, String> labels = new LinkedHashMap<>();
        labels.put("en", "English");
        labels.put("ar", "العربية");
        labels.put("hi", "हिन्दी");
        labels.put("ta", "தமிழ்");
        labels.put("te", "తెలుగు");
        labels.put("bn", "বাংলা");
        labels.put("mr", "मराठी");
        labels.put("gu", "ગુજરાતી");
        labels.put("kn", "ಕನ್ನಡ");
        labels.put("ml", "മലയാളം");
        labels.put("pa", "ਪੰਜਾਬੀ");
        labels.put("or", "ଓଡ଼ିଆ");
        labels.put("as", "অসমীয়া");
        labels.put("es", "Español");
        labels.put("fr", "Français");
        // unmodifiableMap (not Map.copyOf) so LinkedHashMap insertion order survives
        NATIVE_LABELS = java.util.Collections.unmodifiableMap(labels);

        Map<String, String> scripts = new LinkedHashMap<>();
        scripts.put("en", "latin");
        scripts.put("ar", "arabic");
        scripts.put("hi", "devanagari");
        scripts.put("ta", "tamil");
        scripts.put("te", "telugu");
        scripts.put("bn", "bengali");
        scripts.put("mr", "devanagari");
        scripts.put("gu", "gujarati");
        scripts.put("kn", "kannada");
        scripts.put("ml", "malayalam");
        scripts.put("pa", "gurmukhi");
        scripts.put("or", "odia");
        scripts.put("as", "bengali");
        scripts.put("es", "latin");
        scripts.put("fr", "latin");
        SCRIPTS = java.util.Collections.unmodifiableMap(scripts);
    }

    private LocaleRegistry() {
    }

    /**
     * True when the tag (or its primary subtag, e.g. "hi-IN" → "hi") is a
     * supported locale. Null / blank / garbage → false.
     */
    public static boolean isSupported(String tag) {
        return normalizeOrNull(tag) != null;
    }

    /** True when the tag resolves to a right-to-left locale (currently only "ar"). */
    public static boolean isRtl(String tag) {
        String normalized = normalizeOrNull(tag);
        return normalized != null && RTL.contains(normalized);
    }

    /**
     * Normalize any input to a supported locale tag, falling back to
     * {@link #DEFAULT}. Case-insensitive, accepts underscores, and reduces
     * region/script variants to their primary subtag ("hi-IN" → "hi").
     */
    public static String normalize(String tag) {
        String normalized = normalizeOrNull(tag);
        return normalized != null ? normalized : DEFAULT;
    }

    /** Like {@link #normalize} but returns null instead of the default fallback. */
    static String normalizeOrNull(String tag) {
        if (tag == null) {
            return null;
        }
        String cleaned = tag.trim().toLowerCase().replace('_', '-');
        if (cleaned.isEmpty()) {
            return null;
        }
        if (SUPPORTED.contains(cleaned)) {
            return cleaned;
        }
        int dash = cleaned.indexOf('-');
        if (dash > 0) {
            String primary = cleaned.substring(0, dash);
            if (SUPPORTED.contains(primary)) {
                return primary;
            }
        }
        return null;
    }
}
