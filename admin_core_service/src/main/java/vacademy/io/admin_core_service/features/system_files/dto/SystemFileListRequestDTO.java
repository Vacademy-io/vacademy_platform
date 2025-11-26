package vacademy.io.admin_core_service.features.system_files.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
@JsonIgnoreProperties(ignoreUnknown = true)
@Getter
@Setter
public class SystemFileListRequestDTO {

        @NotBlank(message = "Level is required")
        private String level; // user, batch, institute, role

        @NotBlank(message = "Level ID is required")
        private String levelId; // userId, batchId, instituteId, or role name

        private String accessType; // Optional: view, edit - if null, return all access types

        private List<String> statuses; // Optional: ACTIVE, ARCHIVED, DELETED - if null, defaults to ACTIVE only
}
