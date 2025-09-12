package vacademy.io.admin_core_service.features.common.dto.request;


import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;
import org.springframework.web.bind.annotation.GetMapping;
import vacademy.io.admin_core_service.features.common.dto.InstituteCustomFieldDTO;

import java.util.ArrayList;
import java.util.List;


@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class InstituteCustomFieldMappingRequest {
    List<InstituteCustomFieldDTO> mappings = new ArrayList<>();
}
