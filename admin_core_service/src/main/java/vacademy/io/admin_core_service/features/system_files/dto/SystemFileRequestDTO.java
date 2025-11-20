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
public class SystemFileRequestDTO {

        @NotBlank(message = "File type is required")
        private String fileType; // File, Url

        @NotBlank(message = "Media type is required")
        private String mediaType; // video, audio, pdf, doc, unknown

        @NotBlank(message = "Data is required")
        private String data; // fileId or url

        @NotBlank(message = "Name is required")
        private String name;

        private String folderName;
        private String thumbnailFileId;

        private List<AccessDTO> viewAccess;
        private List<AccessDTO> editAccess;
}
