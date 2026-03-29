package vacademy.io.admin_core_service.features.audience.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.sql.Timestamp;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class AudienceCommunicationDTO {

    private String id;
    private String channel;
    private String templateName;
    private String subject;
    private int recipientCount;
    private int successful;
    private int failed;
    private int skipped;
    private String batchId;
    private String status;
    private String createdBy;
    private Timestamp createdAt;
}
