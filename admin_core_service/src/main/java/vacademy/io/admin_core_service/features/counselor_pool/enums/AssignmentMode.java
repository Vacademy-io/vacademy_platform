package vacademy.io.admin_core_service.features.counselor_pool.enums;

/**
 * Controls how a counselor pool picks a counselor when a lead arrives.
 */
public enum AssignmentMode {
    /** No auto-assignment. Lead stays unassigned until an admin picks manually. */
    MANUAL,

    /** Rotate through pool members by display_order, per audience. */
    ROUND_ROBIN,

    /** Filter members by current shift, then round-robin among the eligible ones. */
    TIME_BASED
}
