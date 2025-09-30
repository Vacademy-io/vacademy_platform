package vacademy.io.admin_core_service.features.workflow.dto;

import lombok.Data;

import java.util.Map;

@Data
public class WhatsAppNotificationTemplateDTO {
    private String templateName;
    private Map<String,String>placeholders;
}
