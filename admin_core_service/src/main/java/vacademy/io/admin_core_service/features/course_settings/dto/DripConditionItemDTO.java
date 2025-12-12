package vacademy.io.admin_core_service.features.course_settings.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

import java.util.Date;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class DripConditionItemDTO {
        private String id;
        private String level; // "package", "chapter", or "slide"
        private String levelId; // UUID of the package/chapter/slide
        private Object dripCondition; // The actual drip condition JSON object
        private Boolean enabled;
        private Date createdAt;
        private Date updatedAt;
}
