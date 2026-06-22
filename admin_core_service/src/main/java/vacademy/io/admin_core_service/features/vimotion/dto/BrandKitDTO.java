package vacademy.io.admin_core_service.features.vimotion.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@JsonIgnoreProperties(ignoreUnknown = true)
public class BrandKitDTO {
    private String id;
    private String name;
    // Boxed Boolean so callers can omit the field on update (null = leave unchanged).
    // Also makes Jackson serialize the JSON property as "is_default" — primitive
    // boolean's "isXxx()" getter would publish as "default" with @JsonNaming.
    private Boolean isDefault;

    private String backgroundType;          // 'white' | 'black'
    private Map<String, Object> palette;    // { primary, secondary, accent, background }
    private String headingFont;
    private String bodyFont;
    private String layoutTheme;
    private String logoFileId;

    private Map<String, Object> intro;      // { enabled, duration_seconds, html }
    private Map<String, Object> outro;
    private Map<String, Object> watermark;  // { enabled, position, opacity, html, max_width?, max_height?, margin? }

    // Free-text director instructions auto-appended to the AI video generation
    // prompts for every video made with this kit. Wire key: "system_prompt".
    private String systemPrompt;

    private Long createdAt;
    private Long updatedAt;
}
