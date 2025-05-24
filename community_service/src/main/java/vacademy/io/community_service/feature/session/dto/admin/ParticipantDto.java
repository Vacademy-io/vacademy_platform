package vacademy.io.community_service.feature.session.dto.admin;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Date;

@Data
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
@NoArgsConstructor
@AllArgsConstructor
public class ParticipantDto {
    private String username;
    private String userId;
    private String name;
    private String email;
    private String status;
    private Date joinedAt;

    public ParticipantDto(String username, String status) {
        this.username = username;
        this.status = status;
    }

    public ParticipantDto(String username, String status, Date joinedAt) {
        this.username = username;
        this.status = status;
        this.joinedAt = joinedAt;
    }
}