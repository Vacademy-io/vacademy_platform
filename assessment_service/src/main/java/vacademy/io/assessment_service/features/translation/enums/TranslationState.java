package vacademy.io.assessment_service.features.translation.enums;

/**
 * Lifecycle of a sidecar translation row.
 *
 * DRAFT -> IN_REVIEW -> PUBLISHED; PUBLISHED -> STALE when the canonical
 * source text changes (source_hash no longer matches). Learner delivery
 * serves PUBLISHED and STALE (a slightly stale translation still beats
 * falling back to English); admin tooling uses STALE to queue re-translation.
 */
public enum TranslationState {
    DRAFT,
    IN_REVIEW,
    PUBLISHED,
    STALE;

    /** States a learner-facing response is allowed to serve. */
    public static final java.util.List<String> SERVABLE = java.util.List.of(PUBLISHED.name(), STALE.name());

    public static boolean isValid(String value) {
        if (value == null) return false;
        for (TranslationState state : values()) {
            if (state.name().equals(value)) return true;
        }
        return false;
    }
}
