package vacademy.io.admin_core_service.features.booking.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Serialized into {@code booking_page.availability_json}. All times are
 * wall-clock strings ("HH:mm") interpreted in the page's timezone.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class BookingAvailabilityDTO {

    /** Weekly recurring windows. Multiple windows per day allowed. */
    private List<WeeklyWindow> weeklyWindows;

    /** Date-specific overrides (Phase 3 UI; honored by the engine when present). */
    private List<DateOverride> dateOverrides;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class WeeklyWindow {
        /** MONDAY..SUNDAY (java.time.DayOfWeek name). */
        private String dayOfWeek;
        /** "HH:mm" in page timezone. */
        private String startTime;
        /** "HH:mm" in page timezone. */
        private String endTime;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class DateOverride {
        /** "yyyy-MM-dd" in page timezone. */
        private String date;
        /** True = whole day blocked; otherwise {@code windows} replaces the weekly ones. */
        private Boolean blocked;
        private List<WeeklyWindow> windows;
    }
}
