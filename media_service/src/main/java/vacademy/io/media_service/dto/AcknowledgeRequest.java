package vacademy.io.media_service.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.*;

@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@ToString
public class AcknowledgeRequest {
    private String fileId;
    private String userId;
    private String folderIconId;
    private String folderName;
    private String sourceId;
    private String sourceType;
    private Long fileSize;
    private Double width;
    private Double height;
}
