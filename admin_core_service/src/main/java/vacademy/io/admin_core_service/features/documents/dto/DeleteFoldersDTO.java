package vacademy.io.admin_core_service.features.documents.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
@Data
public class DeleteFoldersDTO {
    private String commaSeparatedFolderIds;
}
