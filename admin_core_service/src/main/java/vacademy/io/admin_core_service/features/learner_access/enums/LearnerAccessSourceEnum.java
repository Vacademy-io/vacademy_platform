package vacademy.io.admin_core_service.features.learner_access.enums;

/** Where an access-days change originated. Stored in {@code learner_access_log.source}. */
public enum LearnerAccessSourceEnum {
    /** Learner enrolled through a payment option / invite; days came from the plan. */
    ENROLLMENT,
    /** An admin changed access explicitly from the learner-management screens. */
    ADMIN_EXTENSION,
    /** An admin assigned the learner to a batch and the assignment carried access days. */
    ADMIN_ASSIGNMENT,
    /** Automatic renewal extended the existing enrollment. */
    RENEWAL,
    /** Backfill / data import. */
    MIGRATION
}
