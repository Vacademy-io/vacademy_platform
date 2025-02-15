package vacademy.io.admin_core_service.features.documents.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Getter;
import lombok.Setter;


@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
@Getter
@Setter
public class DocumentDTO {
    private String id;
    private String fileId;
    private FolderDTO folder;
    private String userId;
    private String name;
    private String status;
    private String accessType;
}
