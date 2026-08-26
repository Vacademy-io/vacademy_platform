package vacademy.io.admin_core_service.features.learner_access.enums;

/** What an access-days change did. Stored in {@code learner_access_log.action}. */
public enum LearnerAccessActionEnum {
    /** First expiry ever written for this enrollment. */
    GRANT,
    /** Existing expiry pushed further out. */
    EXTEND,
    /** Existing expiry pulled in, but still in the future. */
    REDUCE,
    /** Expiry replaced with an explicit date, direction unknown/irrelevant. */
    SET,
    /** Expiry cleared — the learner now has unlimited access. */
    MAKE_UNLIMITED,
    /** Expiry moved to now or earlier — access ends immediately. */
    REVOKE
}
