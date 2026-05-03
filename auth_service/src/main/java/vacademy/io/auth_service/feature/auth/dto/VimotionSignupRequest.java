package vacademy.io.auth_service.feature.auth.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@JsonIgnoreProperties(ignoreUnknown = true)
public class VimotionSignupRequest {
    private String signupToken;
    private String fullName;
    private String email;
    private String phoneNumber;
    private String password;

    // 'individual' | 'studio' | 'agency'
    private String accountType;

    // studio/agency fields — null/ignored when accountType=individual
    private String studioName;
    private String logoFileId;
    private String brandColor;
    private String companySize;
}
