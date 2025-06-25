package vacademy.io.admin_core_service.features.common.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

import java.util.HashMap;
import java.util.Map;

@Data
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class RatingFilterDTO {
    private String searchText;
    private Map<String,String> sortColumns = new HashMap<>();
    private String sourceId;
    private String sourceType;
}
