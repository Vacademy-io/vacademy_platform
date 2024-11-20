package vacademy.io.common.auth.dto;


import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class OrgDTO {

    private String name;
    private String id;
    private List<SubmoduleDTO> subModules;
    private List<String> roles;
    private List<String> permissions;
}
