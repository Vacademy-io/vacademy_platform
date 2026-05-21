package vacademy.io.admin_core_service.features.admin_activity_logs.dto;

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
public class AdminActivityLogResponseDTO {
    private String id;
    private String instituteId;
    private String actorId;
    private String actorName;
    private String actorEmail;
    private String entityType;
    private String entityId;
    private String action;
    private String httpMethod;
    private String endpoint;
    private String description;
    /** Deserialized JSON from request_payload (null if payload was NONE/empty). */
    private Object requestPayload;
    /** Deserialized JSON snapshot of the entity *before* the mutation (null if
     *  the annotation didn't request a captureBefore, or the lookup returned null). */
    private Object beforePayload;
    private String ipAddress;
    private String userAgent;
    private Integer responseStatus;
    private Long responseTimeMs;
    private Timestamp createdAt;
}
