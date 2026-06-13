package vacademy.io.community_service.feature.status.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Date;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StatusIncidentDto {
    private String id;
    private String title;
    private String status;
    private String severity;
    private List<String> affectedComponents;
    private Date startedAt;
    private Date resolvedAt;
    private String createdBy;
    private String createdByName;
    private Date createdAt;
    private Date updatedAt;
    private List<StatusIncidentUpdateDto> updates;
}
