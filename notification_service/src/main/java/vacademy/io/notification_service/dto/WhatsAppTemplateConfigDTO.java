package vacademy.io.notification_service.dto;

import lombok.Data;
import java.util.List;

@Data
public class WhatsAppTemplateConfigDTO {

    private String templateName;
    private String languageCode;
    private ParameterConfig parameterConfig;

    @Data
    public static class ParameterConfig {
        private List<ParameterMapping> body;
        private List<ParameterMapping> button;
    }

    @Data
    public static class ParameterMapping {
        private int index;
        private String source;
        private String type;
    }
}
