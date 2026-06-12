package vacademy.io.media_service.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Date;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class SuperAdminFileItemDTO {
    private String id;
    private String fileName;
    private String fileType;
    private Long fileSize;
    private String source;
    private String sourceId;
    private Double width;
    private Double height;
    private String key;
    private String url;
    private Date createdOn;
    private Date updatedOn;
}
