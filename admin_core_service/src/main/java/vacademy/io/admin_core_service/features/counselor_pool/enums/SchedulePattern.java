package vacademy.io.admin_core_service.features.counselor_pool.enums;

/**
 * How the admin authored a pool's weekly schedule. Affects only the UI editor
 * that loads when the pool is reopened; the routing engine reads flat
 * counselor_pool_shift rows regardless of which pattern produced them.
 */
public enum SchedulePattern {
    /** Shifts authored independently per day (the original editor). */
    PER_DAY,

    /** One set of blocks applied to all 7 days. Frontend expands to per-day rows on save. */
    SAME_HOURS_ALL_DAYS
}
