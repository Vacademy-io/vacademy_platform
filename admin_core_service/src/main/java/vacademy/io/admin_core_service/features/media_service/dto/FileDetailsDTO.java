package vacademy.io.admin_core_service.features.media_service.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Date;

@Data
@AllArgsConstructor
@Builder
@NoArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class FileDetailsDTO {
    private String id;
    private String url;
    private String fileName;
    private String fileType;
    private String source;
    private String sourceId;
    private Date expiry;
    private double width;
    private double height;
    private Date createdOn;
    private Date updatedOn;
}
