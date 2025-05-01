package vacademy.io.admin_core_service.features.session.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

import java.util.Date;

@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
@Data
public class EditSessionDTO {
    private String commaSeparatedHiddenPackageSessionIds;
    private String sessionName;
    private Date startDate;
    private String status;
    private String commaSeparatedVisiblePackageSessionIds;
}
