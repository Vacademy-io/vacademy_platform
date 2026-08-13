package vacademy.io.admin_core_service.features.telephony.controller.dto;

import lombok.Data;

/**
 * Request body for choosing the line Vacademy AI calls go out on.
 *
 * <p>{@code mode=PRIMARY} means "share the account my team calls on" and needs no
 * other field — it deletes any dedicated line. {@code mode=DEDICATED} links a Plivo
 * subaccount used only by the AI.
 *
 * <p>Secrets follow the same "blank means leave as-is" rule as the provider config
 * form, so re-saving without retyping the token doesn't wipe it.
 */
@Data
public class AiVoiceCarrierDTO {

    /** {@code PRIMARY} | {@code DEDICATED}. */
    private String mode;

    /** Plivo subaccount Auth ID (starts with "SA" for a subaccount, "MA" for a master). */
    private String authId;

    /** Plivo subaccount Auth Token. Blank on update = keep the stored one. */
    private String authToken;

    /** The number AI calls are placed from. Required for a dedicated line. */
    private String callerId;

    /** Optional Plivo Application id — only if inbound is ever pointed at this line. */
    private String appId;

    /** Shared secret required on this line's status callbacks. Blank = keep stored. */
    private String webhookToken;

    /** Record AI calls on this line. Defaults to true on create. */
    private Boolean recordCalls;

    /** Turn the dedicated line off without deleting it (AI falls back to the primary). */
    private Boolean enabled;
}
