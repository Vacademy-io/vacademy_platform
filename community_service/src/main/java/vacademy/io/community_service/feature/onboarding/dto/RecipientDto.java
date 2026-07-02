package vacademy.io.community_service.feature.onboarding.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Date;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RecipientDto {
    private String id;
    private String email;
    private String name;
    private boolean active;
    private Date createdAt;
}
