package vacademy.io.admin_core_service.features.user_resolution.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Forward faculty mapping lookup: which package sessions (batches) is this faculty user mapped to. */
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class FacultyPackageSessionsRequest {
    private String userId;
    private String instituteId;
}
