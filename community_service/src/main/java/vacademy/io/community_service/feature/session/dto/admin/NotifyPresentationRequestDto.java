package vacademy.io.community_service.feature.session.dto.admin;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

import java.util.List;

@Data
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class NotifyPresentationRequestDto {
    private String transcript;
    private String sessionId;
}