package vacademy.io.admin_core_service.features.counselor_pool.enums;

import java.time.DayOfWeek;

/**
 * Day-of-week values stored in counselor_pool_shift.day_of_week.
 * Three-letter codes match the column convention.
 */
public enum ShiftDayOfWeek {
    MON, TUE, WED, THU, FRI, SAT, SUN;

    public static ShiftDayOfWeek fromJavaDay(DayOfWeek day) {
        return switch (day) {
            case MONDAY -> MON;
            case TUESDAY -> TUE;
            case WEDNESDAY -> WED;
            case THURSDAY -> THU;
            case FRIDAY -> FRI;
            case SATURDAY -> SAT;
            case SUNDAY -> SUN;
        };
    }
}
