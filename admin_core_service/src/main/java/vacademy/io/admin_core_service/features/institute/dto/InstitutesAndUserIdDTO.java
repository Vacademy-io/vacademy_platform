package vacademy.io.admin_core_service.features.institute.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;


@Data
@AllArgsConstructor
@NoArgsConstructor
public class InstitutesAndUserIdDTO {

    private String userId;
    private List<InstituteInfoDTO> institutes;
}
