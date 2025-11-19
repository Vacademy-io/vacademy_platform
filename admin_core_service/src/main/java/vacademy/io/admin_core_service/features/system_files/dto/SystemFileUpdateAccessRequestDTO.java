package vacademy.io.admin_core_service.features.system_files.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class SystemFileUpdateAccessRequestDTO {

        @NotBlank(message = "system_file_id is required")
        private String systemFileId;

        private List<String> userRoles; // Optional: User's roles for role-based authorization

        private List<AccessDTO> viewAccess;

        private List<AccessDTO> editAccess;

        private String status; // Optional: To update file status (ACTIVE, DELETED, ARCHIVED)
}
