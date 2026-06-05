package vacademy.io.admin_core_service.features.telephony.controller.dto;

import lombok.Builder;
import lombok.Data;
import vacademy.io.admin_core_service.features.telephony.persistence.entity.InstituteTelephonyConfig;

import java.sql.Timestamp;

/** GET-side projection. Never exposes secrets. */
@Data
@Builder
public class TelephonyConfigViewDTO {
    private String id;
    private String instituteId;
    private String providerType;
    private String apiAccountId;
    private boolean apiUsernameSet;    // true if a credential is stored, false if blank
    private boolean apiPasswordSet;
    private boolean webhookTokenSet;
    private Boolean recordCalls;
    private String defaultSelectorKey;
    private Boolean enabled;
    private Timestamp updatedAt;

    public static TelephonyConfigViewDTO from(InstituteTelephonyConfig c) {
        return TelephonyConfigViewDTO.builder()
                .id(c.getId())
                .instituteId(c.getInstituteId())
                .providerType(c.getProviderType())
                .apiAccountId(c.getApiAccountId())
                .apiUsernameSet(c.getApiUsernameEnc() != null && !c.getApiUsernameEnc().isBlank())
                .apiPasswordSet(c.getApiPasswordEnc() != null && !c.getApiPasswordEnc().isBlank())
                .webhookTokenSet(c.getWebhookTokenEnc() != null && !c.getWebhookTokenEnc().isBlank())
                .recordCalls(c.getRecordCalls())
                .defaultSelectorKey(c.getDefaultSelectorKey())
                .enabled(c.getEnabled())
                .updatedAt(c.getUpdatedAt())
                .build();
    }
}
