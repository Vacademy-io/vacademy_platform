package vacademy.io.admin_core_service.features.mentorship.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.admin_core_service.features.booking.dto.BookingAvailabilityDTO;

/**
 * A mentor's self-service edit of THEIR OWN booking page. Only the scheduling
 * fields a mentor is allowed to change are here — host, slug, institute, etc. are
 * never accepted from the client, so a mentor can't repoint their page at someone
 * else. All fields are optional; nulls leave the existing value unchanged.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class MentorAvailabilityRequest {

    /** Weekly recurring windows (+ optional date overrides). */
    private BookingAvailabilityDTO availability;

    /** Session length in minutes (e.g. 30). */
    private Integer durationMinutes;

    /** Minimum notice before a slot can be booked, in minutes. */
    private Integer minNoticeMinutes;

    /** Gap held free before each session. */
    private Integer bufferBeforeMinutes;

    /** Gap held free after each session. */
    private Integer bufferAfterMinutes;

    /** How far ahead learners can book, in days. */
    private Integer bookingHorizonDays;

    /** Slot start granularity in minutes (e.g. 15). */
    private Integer slotGranularityMinutes;

    /** IANA timezone id the weekly windows are interpreted in. */
    private String timezone;
}
