package vacademy.io.media_service.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CreateShortLinkRequest {
    private String shortCode;
    private String destinationUrl;
    private String source;
    private String sourceId;
}
