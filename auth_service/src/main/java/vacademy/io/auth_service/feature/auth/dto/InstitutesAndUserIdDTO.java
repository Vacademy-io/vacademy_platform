package vacademy.io.auth_service.feature.auth.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;


@Data
@AllArgsConstructor
@NoArgsConstructor
public class InstitutesAndUserIdDTO {

    private String userId;
    private List<InstituteInfo> institutes;
}
