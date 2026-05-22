package vacademy.io.admin_core_service.features.counselor_pool.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.sql.Time;
import java.util.List;

/**
 * Replace the full weekly schedule for a pool. The service will validate that
 * each of the 7 days has continuous 24-hour coverage with no gaps before
 * persisting. Existing shifts are replaced (not merged).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WeeklyScheduleRequest {

    private List<ShiftBlock> shifts;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ShiftBlock {

        /** MON | TUE | WED | THU | FRI | SAT | SUN */
        @JsonProperty("day_of_week")
        private String dayOfWeek;

        @JsonProperty("start_time")
        private Time startTime;

        @JsonProperty("end_time")
        private Time endTime;

        private String label;

        /** Counselors to put on this shift. Required (non-empty). */
        @JsonProperty("counselor_user_ids")
        private List<String> counselorUserIds;
    }
}
