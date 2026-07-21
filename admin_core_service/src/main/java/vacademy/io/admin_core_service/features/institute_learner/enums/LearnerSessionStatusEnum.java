package vacademy.io.admin_core_service.features.institute_learner.enums;

public enum LearnerSessionStatusEnum {
    ACTIVE, INACTIVE, TERMINATED,INVITED,
    // Paid flows park mappings here pre-webhook (see LearnerStatusEnum, which backs the
    // same status column). Must stay listed here too, or LearnerSessionStatusEnum.valueOf
    // on a reused PENDING_FOR_APPROVAL mapping crashes enrollment.
    PENDING_FOR_APPROVAL,
    DELETED, EXPIRED
}
