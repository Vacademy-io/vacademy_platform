package vacademy.io.admin_core_service.features.notification_service.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

import java.util.List;
import java.util.Map;

@JsonIgnoreProperties(
    ignoreUnknown = true
)
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@Data
public class WhatsappRequest {
    String templateName;
    List<Map<String, Map<String, String>>> userDetails;
    String languageCode;
    Map<String, Map<String, String>> headerParams;
    String headerType;
}