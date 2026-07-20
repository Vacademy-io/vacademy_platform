package vacademy.io.admin_core_service.features.booking.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/** DTOs for the unauthenticated public booking surface. */
public final class PublicBookingDTOs {

    private PublicBookingDTOs() {
    }

    /** What the public /book page needs to render — no internal config leaks. */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class PublicPageDTO {
        private String slug;
        private String title;
        private String description;
        private String hostName;
        private Integer durationMinutes;
        private String timezone;
        private String locationType;
        private Boolean requireApproval;
        private Integer minNoticeMinutes;
        private Integer bookingHorizonDays;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class SlotsResponseDTO {
        /** ISO offset datetimes of slot starts, in the requested display zone. */
        private List<String> slots;
        private Integer durationMinutes;
        private String timezone;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class PublicBookRequestDTO {
        private String name;
        private String email;
        private String phone;
        /** ISO-8601 offset datetime of the chosen slot start. */
        private String startTime;
        private String inviteeTimezone;
    }

    /** Confirmation + manage view (token-gated, so still minimal). */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class PublicBookingViewDTO {
        private String manageToken;
        private String pageSlug;
        private String title;
        private String hostName;
        private String inviteeName;
        private String inviteeEmail;
        private String status;
        private String meetLink;
        /** ISO offset datetimes (UTC). */
        private String startTimeUtc;
        private String endTimeUtc;
        private String inviteeTimezone;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class PublicCancelRequestDTO {
        private String reason;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class PublicRescheduleRequestDTO {
        /** ISO-8601 offset datetime of the new slot start. */
        private String startTime;
        private String inviteeTimezone;
    }
}
