package vacademy.io.admin_core_service.features.translation.enums;

import java.util.Set;

/**
 * Lifecycle of a translation sidecar row.
 *
 * DRAFT -> IN_REVIEW -> PUBLISHED; PUBLISHED -> STALE when the canonical source
 * text's sha256 (source_hash) no longer matches. PUBLISHED and STALE are both
 * learner-visible (a slightly stale translation beats a blank); DRAFT and
 * IN_REVIEW are never served.
 */
public enum TranslationState {
    DRAFT,
    IN_REVIEW,
    PUBLISHED,
    STALE;

    /** States served to learners by the COALESCE LEFT JOIN delivery queries. */
    public static final Set<TranslationState> LEARNER_VISIBLE = Set.of(PUBLISHED, STALE);

    public boolean isLearnerVisible() {
        return LEARNER_VISIBLE.contains(this);
    }

    /**
     * Review/approval transition matrix:
     * DRAFT -> IN_REVIEW | PUBLISHED (direct approve),
     * IN_REVIEW -> DRAFT (reject) | PUBLISHED (approve),
     * PUBLISHED -> any (demote/mark stale), STALE -> any (re-approve/demote).
     */
    public boolean canTransitionTo(TranslationState target) {
        if (target == null || target == this) {
            return false;
        }
        return switch (this) {
            case DRAFT -> target == IN_REVIEW || target == PUBLISHED;
            case IN_REVIEW -> target == DRAFT || target == PUBLISHED;
            case PUBLISHED, STALE -> true;
        };
    }

    public static TranslationState fromString(String value) {
        try {
            return TranslationState.valueOf(value.trim().toUpperCase());
        } catch (Exception e) {
            return null;
        }
    }
}
