package vacademy.io.auth_service.feature.vimotion.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Date;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class AdminInviteCodeDTO {
    private String id;
    private String code;
    private String kind;
    private String status;
    private String lockedEmail;
    private String lockedPhoneNumber;
    private String waitlistId;
    private Integer maxUses;
    private Integer usedCount;
    private Date expiresAt;
    private String note;
    private String createdBy;
    private Date createdAt;
}
