package vacademy.io.admin_core_service.features.telephony.core.dto;

import lombok.Data;

/**
 * Admin payload for saving Aavtaar credentials. {@code apiToken} /
 * {@code webhookSecret} are write-only — sent only when changing; blank means
 * "keep the existing encrypted value". The GET view never returns them.
 */
@Data
public class AiCallingConfigDTO {
    private String companyCode;
    private String apiToken;
    private String webhookSecret;
    private Boolean enabled;
}
