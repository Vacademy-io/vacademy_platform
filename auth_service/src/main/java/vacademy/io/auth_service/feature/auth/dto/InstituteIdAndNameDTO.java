package vacademy.io.auth_service.feature.auth.dto;


import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class InstituteIdAndNameDTO {

    private String instituteId;
    private String instituteName;
    private List<String> submoduleIds;
}
