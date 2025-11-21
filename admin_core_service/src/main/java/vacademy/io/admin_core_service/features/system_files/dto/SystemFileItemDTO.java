package vacademy.io.admin_core_service.features.system_files.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Getter;
import lombok.Setter;

import java.sql.Timestamp;
import java.util.List;

@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
@Getter
@Setter
public class SystemFileItemDTO {

        private String id;
        private String fileType;
        private String mediaType;
        private String data;
        private String name;
        private String folderName;
        private String thumbnailFileId;
        private Timestamp createdAtIso;
        private Timestamp updatedAtIso;
        private String createdBy; // User's full name
        private List<String> accessTypes; // ["view", "edit"] or just ["view"]
}
