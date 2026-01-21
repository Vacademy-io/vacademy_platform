package vacademy.io.admin_core_service.features.system_files.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
@Getter
@Setter
public class EmailAssetRequestDTO {

        @NotBlank(message = "S3 URL is required")
        private String s3Url; // S3 URL of the image/gif

        @NotBlank(message = "Name is required")
        private String name; // Display name of the asset

        private String description; // Optional description
}

