package vacademy.io.admin_core_service.features.template.dto;

import lombok.Data;
import java.util.List;

@Data
public class WhatsAppTemplateDTO {

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
