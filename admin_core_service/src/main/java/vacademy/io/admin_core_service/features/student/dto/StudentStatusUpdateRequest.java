package vacademy.io.admin_core_service.features.student.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Date;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class StudentStatusUpdateRequest {
    private String userId;
    private String newState;
    private String instituteId;
    private String currentPackageSessionId;
}
