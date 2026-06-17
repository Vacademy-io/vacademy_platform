package vacademy.io.community_service.feature.support.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/** The super-admin view/editor of an institute's support config. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InstituteSupportConfigDto {
    private String instituteId;
    private String instituteName;
    private String plan;                       // plan key (DEDICATED|PREMIUM|...)
    private SupportPlanDto planDetail;
    private List<String> alertEmails;          // per-institute override list
    private List<SupportEngineerDto> engineers; // assigned dedicated engineers
    private long openTicketCount;
}
