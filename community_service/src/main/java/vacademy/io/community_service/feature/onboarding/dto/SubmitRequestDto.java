package vacademy.io.community_service.feature.onboarding.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

/** Public form submission payload. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SubmitRequestDto {
    private String slug;
    /** Selected institute type (ignored when the link forces one). */
    private String instituteType;
    /** All answers keyed by question key. */
    private Map<String, Object> answers;
    private String referrer;
}
