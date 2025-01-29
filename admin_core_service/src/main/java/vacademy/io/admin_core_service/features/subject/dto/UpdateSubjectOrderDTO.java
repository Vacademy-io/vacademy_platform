package vacademy.io.admin_core_service.features.subject.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class UpdateSubjectOrderDTO {
    private String subjectId;
    private String packageSessionId;
    private Integer subjectOrder;
}
