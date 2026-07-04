package vacademy.io.admin_core_service.features.telephony.controller.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.admin_core_service.features.telephony.core.dto.VoiceCallingSettingsPojo;

/**
 * What the Vacademy Voice settings card reads: the institute's product config plus
 * the server's public webhook base (so the card can render the exact inbound
 * answer-URL to paste into the Plivo Application).
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class VoiceConfigViewDTO {
    private String instituteId;
    private VoiceCallingSettingsPojo config;
    /** telephony.webhook.callback-base — null/blank if the server hasn't advertised it. */
    private String webhookCallbackBase;
}
