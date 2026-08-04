package vacademy.io.notification_service.features.send.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * Per-institute copy-recipient (CC/BCC) configuration for outgoing transactional email,
 * persisted under {@code institute_announcement_settings.settings.emailCc}.
 *
 * <p>Shared by the settings request and response DTOs so the block survives a round-trip:
 * {@code InstituteAnnouncementSettingsService.convertRequestToMap} serializes the TYPED request
 * DTO and replaces the whole settings map, so any key without a field here is dropped on the
 * next save.
 *
 * <p>Resolution happens in {@code EmailCcResolver}, keyed on the send's event name. A trigger's
 * effective copy list is {@link #globalCc} plus that trigger's own {@code cc}.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class EmailCcSettings {

    /** Master switch. When false (the default) no copies are attached to any email. */
    private Boolean enabled = false;

    /**
     * "CC" (visible to the learner) or "BCC" (hidden). Defaults to BCC: copies are normally
     * internal staff addresses that should not appear on a learner-facing receipt.
     */
    private String mode = "BCC";

    /** Applied to every ENABLED trigger, on top of that trigger's own list. */
    @JsonProperty("global_cc")
    private List<String> globalCc;

    /** Event name (e.g. LEARNER_ENROLL) → per-trigger config. */
    private Map<String, TriggerCc> triggers;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class TriggerCc {
        /** When false this trigger gets NO copies — not even {@link #globalCc}. */
        private Boolean enabled = false;

        private List<String> cc;
    }
}
