package vacademy.io.notification_service.features.send.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import vacademy.io.notification_service.features.announcements.entity.InstituteAnnouncementSettings;
import vacademy.io.notification_service.features.announcements.repository.InstituteAnnouncementSettingsRepository;
import vacademy.io.notification_service.features.send.dto.EmailCcSettings;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Resolves the copy (CC/BCC) recipients for an outgoing email from the institute's
 * {@code emailCc} settings block, matched on the send's event name.
 *
 * <p>Callers must resolve ONCE per send request rather than per recipient — this reads the
 * settings row from the database, and a bulk blast would otherwise issue one query per learner.
 *
 * <p>Never throws. Any failure — missing settings row, malformed JSON, database hiccup —
 * degrades to "no copies" so a settings problem can never take down enrollment or payment email.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class EmailCcResolver {

    private static final String SETTINGS_KEY = "emailCc";
    private static final String DEFAULT_MODE = "BCC";

    private final InstituteAnnouncementSettingsRepository settingsRepository;
    private final ObjectMapper objectMapper;

    /**
     * Copy recipients for one send. {@code cc} is empty when copies are off, the trigger is not
     * configured, or anything went wrong.
     */
    public record CopyRecipients(List<String> cc, String mode) {
        public static CopyRecipients none() {
            return new CopyRecipients(List.of(), DEFAULT_MODE);
        }

        public boolean isEmpty() {
            return cc == null || cc.isEmpty();
        }
    }

    /**
     * @param instituteId owning institute; blank means no institute context, so no copies
     * @param eventKey    the trigger name (e.g. {@code LEARNER_ENROLL}). Accepts the raw
     *                    {@code SendOptions.source} form too — an {@code "event:"} prefix is
     *                    stripped before matching.
     */
    public CopyRecipients resolve(String instituteId, String eventKey) {
        if (!StringUtils.hasText(instituteId) || !StringUtils.hasText(eventKey)) {
            return CopyRecipients.none();
        }
        try {
            EmailCcSettings config = loadConfig(instituteId);
            if (config == null || !Boolean.TRUE.equals(config.getEnabled())) {
                return CopyRecipients.none();
            }

            Map<String, EmailCcSettings.TriggerCc> triggers = config.getTriggers();
            if (triggers == null || triggers.isEmpty()) {
                return CopyRecipients.none();
            }

            EmailCcSettings.TriggerCc trigger = triggers.get(normalizeEventKey(eventKey));
            // An unconfigured or disabled trigger gets nothing at all — not even globalCc.
            // Opting a trigger in must be an explicit act, otherwise enabling the feature would
            // silently start copying every email the platform sends.
            if (trigger == null || !Boolean.TRUE.equals(trigger.getEnabled())) {
                return CopyRecipients.none();
            }

            LinkedHashSet<String> merged = new LinkedHashSet<>();
            addAll(merged, config.getGlobalCc());
            addAll(merged, trigger.getCc());
            if (merged.isEmpty()) {
                return CopyRecipients.none();
            }

            String mode = "CC".equalsIgnoreCase(config.getMode()) ? "CC" : DEFAULT_MODE;
            log.debug("Resolved {} copy recipient(s) as {} for institute {} event {}",
                    merged.size(), mode, instituteId, eventKey);
            return new CopyRecipients(new ArrayList<>(merged), mode);

        } catch (Exception e) {
            log.warn("Failed to resolve email copy recipients for institute {} event {} — sending without copies: {}",
                    instituteId, eventKey, e.getMessage());
            return CopyRecipients.none();
        }
    }

    private EmailCcSettings loadConfig(String instituteId) {
        Optional<InstituteAnnouncementSettings> row = settingsRepository.findByInstituteId(instituteId);
        if (row.isEmpty() || row.get().getSettings() == null) {
            return null;
        }
        Object raw = row.get().getSettings().get(SETTINGS_KEY);
        if (raw == null) {
            return null;
        }
        return objectMapper.convertValue(raw, EmailCcSettings.class);
    }

    /**
     * {@code SendOptions.source} is stamped as {@code "event:LEARNER_ENROLL"} by
     * DynamicNotificationService, but callers that set a bare event name are matched too.
     */
    private String normalizeEventKey(String eventKey) {
        String key = eventKey.trim();
        if (key.startsWith("event:")) {
            key = key.substring("event:".length());
        }
        return key;
    }

    private void addAll(LinkedHashSet<String> target, List<String> values) {
        if (values == null) {
            return;
        }
        for (String value : values) {
            if (StringUtils.hasText(value)) {
                target.add(value.trim());
            }
        }
    }
}
