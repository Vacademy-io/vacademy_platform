package vacademy.io.admin_core_service.features.live_session.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.util.List;

@Data
@EqualsAndHashCode(callSuper = true)
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class CreateBookingRequestDTO extends LiveSessionStep1RequestDTO {
    private List<String> participantUserIds;
    private String bookingType; // If they pass the code instead of ID, we can look it up

    // Additional booking specific fields if any
}
