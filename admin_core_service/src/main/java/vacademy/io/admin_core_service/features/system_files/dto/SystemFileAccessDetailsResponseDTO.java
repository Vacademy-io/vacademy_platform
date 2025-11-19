package vacademy.io.admin_core_service.features.system_files.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.sql.Timestamp;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class SystemFileAccessDetailsResponseDTO {
        private String id;
        private String name;
        private String fileType;
        private String mediaType;
        private String data;
        private String status;
        private String createdBy;
        private String createdByUserId;
        private Timestamp createdAtIso;
        private Timestamp updatedAtIso;
        private List<AccessDetailItemDTO> accessList;
}
