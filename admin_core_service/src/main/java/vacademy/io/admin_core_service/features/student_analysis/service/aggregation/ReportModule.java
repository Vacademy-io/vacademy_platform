package vacademy.io.admin_core_service.features.student_analysis.service.aggregation;

import java.util.Arrays;
import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Canonical set of admin-selectable report modules (data domains) for the v2 comprehensive report.
 *
 * <p>Identity / institute / period form the report header and are ALWAYS included — they are not
 * listed here and cannot be deselected.
 *
 * <p>The {@code key} values are the snake_case section names used both in the request
 * ({@code include_modules}) and in the {@link
 * vacademy.io.admin_core_service.features.student_analysis.dto.comprehensive.ComprehensiveStudentReport}
 * JSON, so the frontend, request, and stored report all speak the same vocabulary.
 */
public enum ReportModule {
    ATTENDANCE("attendance"),
    LIVE_CLASSES("live_classes"),
    ACADEMICS("academics"),
    ACTIVITY("activity"),
    PROGRESS("progress"),
    CERTIFICATES("certificates"),
    ASSIGNMENTS("assignments"),
    DOUBTS("doubts"),
    LOGIN("login"),
    /**
     * Learning insights derived from per-attempt {@code activity_log.processed_json}
     * (topic mastery, Bloom's taxonomy, confidence, misconceptions). Its collector parses
     * and aggregates the AI-analysis output the LLM-analytics pipeline already produced.
     */
    LEARNING_INSIGHTS("learning_insights");

    private final String key;

    ReportModule(String key) {
        this.key = key;
    }

    public String getKey() {
        return key;
    }

    /** All valid module keys, in declaration order. */
    public static final Set<String> ALL_KEYS;
    static {
        Set<String> keys = new LinkedHashSet<>();
        for (ReportModule m : values()) {
            keys.add(m.getKey());
        }
        ALL_KEYS = Collections.unmodifiableSet(keys);
    }

    /**
     * Normalises a requested list of module keys into a validated set.
     * <ul>
     *   <li>{@code null} / empty → ALL modules (backwards-compatible default).</li>
     *   <li>Unknown keys are dropped (case-insensitive match).</li>
     *   <li>If everything was invalid → ALL modules (safe fallback).</li>
     * </ul>
     */
    public static Set<String> resolve(Collection<String> requested) {
        if (requested == null || requested.isEmpty()) {
            return new LinkedHashSet<>(ALL_KEYS);
        }
        Set<String> valid = requested.stream()
                .filter(Objects::nonNull)
                .map(s -> s.trim().toLowerCase())
                .filter(ALL_KEYS::contains)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        return valid.isEmpty() ? new LinkedHashSet<>(ALL_KEYS) : valid;
    }

    /** Parses the CSV string stored on the process row into a validated set. */
    public static Set<String> resolveCsv(String csv) {
        if (csv == null || csv.isBlank()) {
            return new LinkedHashSet<>(ALL_KEYS);
        }
        return resolve(Arrays.asList(csv.split(",")));
    }

    /** Joins a set of module keys into a CSV string for persistence. */
    public static String toCsv(Set<String> keys) {
        return String.join(",", keys);
    }
}
