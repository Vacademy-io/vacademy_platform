package vacademy.io.community_service.feature.onboarding.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Date;
import java.util.List;
import java.util.Map;

/** A submission as shown in the super-admin inbox / detail drawer. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SubmissionDto {
    private String id;
    private String linkSlug;
    private String linkType;
    private String contactName;
    private String contactEmail;
    private String contactPhone;
    private String organizationName;
    private String role;
    private String instituteType;
    private String instituteTypeLabel;
    private String source;
    private List<String> featuresOfInterest;
    private Map<String, Object> answers;
    private String demoInstituteId;
    private String status;
    private boolean emailSent;
    private String referrer;
    private Date createdAt;
}
