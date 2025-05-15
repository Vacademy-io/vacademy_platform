package vacademy.io.media_service.dto.ll_ai;


import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.*;

@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@ToString
@Builder
public class IncidentAIStructureResponse {
    private String eventCode;
    private String category;
    private String subcategory;
    private String description;
    private String title;
    private Boolean isSuspectKnown;
}
