package vacademy.io.community_service.feature.session.dto.admin;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

import java.util.List;

@Data
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class NotifyPresentationDto {
    private String htmlSummary;
    private List<String> htmlActionPoints;
    private String adminComment;
    private String sessionId;
}