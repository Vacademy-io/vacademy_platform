package vacademy.io.admin_core_service.features.sales_dashboard.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

/**
 * One point on a daily time series. Used for new-vs-existing leads and the
 * reassignment volume widget — both share the same x-axis (date) + two
 * numeric series, so one DTO covers both.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class TimeSeriesPointDTO {
    private LocalDate date;
    private Long primary;        // new leads / reassignments
    private Long secondary;      // existing leads — null when unused
}
