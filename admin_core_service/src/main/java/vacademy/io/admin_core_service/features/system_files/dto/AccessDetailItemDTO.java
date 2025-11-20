package vacademy.io.admin_core_service.features.system_files.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.sql.Timestamp;

@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class AccessDetailItemDTO {
        private String id;
        private String accessType;
        private String level;
        private String levelId;
        private Boolean isCreator;
        private Timestamp createdAtIso;
}
