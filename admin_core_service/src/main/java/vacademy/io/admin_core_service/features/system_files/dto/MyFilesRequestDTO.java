package vacademy.io.admin_core_service.features.system_files.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class MyFilesRequestDTO {

        private List<String> userRoles; // Optional: User's roles for role-based access

        private String accessType; // Optional: Filter by view/edit (null means both)

        private List<String> statuses; // Optional: Filter by status (defaults to [ACTIVE] if null)
}
