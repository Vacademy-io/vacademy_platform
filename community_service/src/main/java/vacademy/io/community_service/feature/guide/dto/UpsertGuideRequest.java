package vacademy.io.community_service.feature.guide.dto;

import lombok.Data;

import java.util.List;

@Data
public class UpsertGuideRequest {
    private String title;
    private String fileId;
    private String fileUrl;
    /** Pathname prefixes this guide should show on, e.g. ["/support", "/onboarding"]. */
    private List<String> routes;
    private Boolean active;
}
