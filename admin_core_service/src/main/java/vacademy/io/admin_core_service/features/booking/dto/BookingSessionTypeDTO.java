package vacademy.io.admin_core_service.features.booking.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * One bookable session option on a booking page (e.g. "Quick chat" / 15 min).
 * Serialized as a list into {@code booking_page.session_types_json}. When the list
 * is empty the page falls back to its single {@code duration_minutes}.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class BookingSessionTypeDTO {

    /** Stable id (client- or server-generated); used by the learner to pick a type. */
    private String id;

    /** Display name shown to the learner. */
    private String name;

    /** Session length in minutes. */
    private Integer durationMinutes;
}
