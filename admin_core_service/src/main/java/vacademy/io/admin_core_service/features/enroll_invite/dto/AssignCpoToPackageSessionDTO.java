package vacademy.io.admin_core_service.features.enroll_invite.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class AssignCpoToPackageSessionDTO {
        private String cpoId;
        private String packageSessionId;
}
