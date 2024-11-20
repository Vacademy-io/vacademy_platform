package vacademy.io.admin_core_service.features.institute.dto;


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
