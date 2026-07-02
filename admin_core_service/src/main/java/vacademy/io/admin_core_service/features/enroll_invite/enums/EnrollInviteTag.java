package vacademy.io.admin_core_service.features.enroll_invite.enums;

public enum EnrollInviteTag {
    DEFAULT,
    SUB_ORG,
    SUBORG_LEARNER,
    // Reusable open self-registration template: sub_org_id is null; each completed
    // registration spawns a real sub-org (with its own SUB_ORG org-level invite).
    SUB_ORG_REGISTRATION
}
