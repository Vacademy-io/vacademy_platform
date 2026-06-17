package vacademy.io.community_service.feature.support.dto;

import lombok.Data;

import java.util.List;

@Data
public class UpsertInstituteConfigRequest {
    private String plan;                 // plan key; omit to leave unchanged
    private List<String> alertEmails;    // per-institute override; null leaves unchanged, [] clears
    private List<String> engineerIds;    // dedicated engineers to assign; null leaves unchanged
    private String primaryEngineerId;    // which of the assigned engineers is the lead
    private String instituteName;        // optional cache of the institute display name
}
