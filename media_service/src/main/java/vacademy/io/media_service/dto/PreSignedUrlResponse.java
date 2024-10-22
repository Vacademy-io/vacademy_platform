package vacademy.io.media_service.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class PreSignedUrlResponse {
    private String id;
    private String url;
}
