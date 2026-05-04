package vacademy.io.admin_core_service.features.vimotion.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@JsonIgnoreProperties(ignoreUnknown = true)
public class StudioAvatarDTO {
    private String id;
    private String name;
    private String provider;            // 'custom' | 'argil' | 'veed'
    private String externalAvatarId;    // fal.ai enum value when provider != 'custom'
    private String faceImageUrl;        // required when provider='custom'
    private String previewImageUrl;     // FE thumbnail; null for built-ins until catalog is self-hosted
    private String description;
    private String voiceId;
    private String voiceProvider;
    private String voiceLanguage;
    private String voiceGender;
    private Long createdAt;
    private Long updatedAt;
}
