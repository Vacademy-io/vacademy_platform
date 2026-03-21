package vacademy.io.admin_core_service.features.system_files.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.sql.Timestamp;

@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class EmailAssetResponseDTO {

        private String id;
        private String s3Url; // S3 URL stored in data field
        private String name;
        private String description;
        private String mediaType; // Always "image" (includes both images and gifs)
        private Timestamp createdAtIso;
        private Timestamp updatedAtIso;
        private String createdBy; // Creator's full name
}

