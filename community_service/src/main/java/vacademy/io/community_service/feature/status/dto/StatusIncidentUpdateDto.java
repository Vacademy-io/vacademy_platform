package vacademy.io.community_service.feature.status.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Date;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StatusIncidentUpdateDto {
    private String id;
    private String status;
    private String message;
    private String createdBy;
    private String createdByName;
    private Date createdAt;
}
