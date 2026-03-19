package vacademy.io.auth_service.feature.super_admin.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class InstituteSessionDTO {
    private String sessionId;
    private String userId;
    private String deviceType;
    private String ipAddress;
    private Boolean isActive;
    private LocalDateTime loginTime;
    private LocalDateTime lastActivityTime;
    private LocalDateTime logoutTime;
    private Long sessionDurationMinutes;
}
