package vacademy.io.media_service.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.*;
import vacademy.io.common.media.dto.FileDetailsDTO;

@Getter
@Setter
@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class UserToFileDTO {
    private String userId;
    private FileDetailsDTO fileDetail;
    private String folderIconUrl;
    private String userid;
    private String folderName;
    private String sourceId;
    private String sourceType;

}
