package vacademy.io.admin_core_service.features.learner_credentials.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.learner_credentials.dto.LearnerCredentialSendResult;
import vacademy.io.admin_core_service.features.learner_credentials.enums.CredentialDeliveryMode;
import vacademy.io.admin_core_service.features.notification.enums.NotificationEventType;
import vacademy.io.admin_core_service.features.notification.enums.NotificationTemplateType;
import vacademy.io.admin_core_service.features.notification.service.DynamicNotificationService;
import vacademy.io.admin_core_service.features.notification.service.NotificationTemplateBindingService;
import vacademy.io.admin_core_service.features.parent_link.dto.CredentialTemplateConfigDTO;
import vacademy.io.common.auth.dto.UserCredentials;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.exceptions.VacademyException;

import java.util.ArrayList;
import java.util.List;

/**
 * Sends a learner their portal credentials through the institute's own
 * templates, and owns the per-institute, per-channel template binding behind it.
 *
 * <h3>Why this goes through the event-config trigger</h3>
 * The platform already had exactly one way to mail credentials: a Java text
 * block in auth_service ({@code NotificationEmailBody}). Every institute got
 * the same wording, the same branding, and no WhatsApp option at all — changing
 * any of it meant a code change and a deploy.
 *
 * <p>Binding {@link NotificationEventType#LEARNER_CREDENTIALS_SHARED} to a row
 * in {@code notification_event_config} moves that decision into data. The
 * binding is keyed by (event, institute, channel), so:
 * <ul>
 *   <li>each institute picks its own template from the normal Templates UI;</li>
 *   <li>EMAIL and WHATSAPP are bound independently — an institute can run one,
 *       both, or neither;</li>
 *   <li>a platform-wide {@code DEFAULT} binding can back-stop institutes that
 *       have not chosen yet;</li>
 *   <li>a future event (credentials expiring, forced reset, welcome-back) is a
 *       new enum constant and a new binding, not a new mail template in Java.</li>
 * </ul>
 *
 * <p>An institute with no binding sends <b>nothing</b> on the template path, and the caller is
 * told which channel was skipped. Silently substituting a generic template would put unapproved
 * wording in front of that institute's learners.
 *
 * <p>The auth_service body has not gone away — it is reachable as
 * {@link CredentialDeliveryMode#DEFAULT}, chosen per send. An institute drafting a template still
 * needs a working mail in the meantime, and an admin helping one confused learner may
 * deliberately want the plain platform message. What changed is that it is no longer the only
 * option.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LearnerCredentialShareService {

    private final AuthService authService;
    private final DynamicNotificationService dynamicNotificationService;
    private final NotificationTemplateBindingService templateBindingService;

    /**
     * Shares the learner's CURRENT credentials on each requested channel, using the platform's
     * built-in mail or the institute's own template.
     *
     * <p>The password is read back from auth_service rather than passed in from
     * the browser: it is the authoritative copy, it keeps the plaintext out of
     * this request body, and it means a re-share works long after the change
     * that prompted it.
     *
     * @param mode       DEFAULT sends the platform's built-in credentials mail (auth_service,
     *                   email only); TEMPLATE renders the institute's template per channel
     * @param templateId optional one-off template for this send; TEMPLATE mode otherwise uses the
     *                   institute's standing binding for each channel
     */
    public LearnerCredentialSendResult share(String instituteId, String userId,
                                             List<NotificationTemplateType> channels,
                                             CredentialDeliveryMode mode, String templateId) {
        if (!StringUtils.hasText(instituteId) || !StringUtils.hasText(userId)) {
            throw new VacademyException("instituteId and userId are required");
        }
        CredentialDeliveryMode resolvedMode = mode != null ? mode : CredentialDeliveryMode.TEMPLATE;

        if (resolvedMode == CredentialDeliveryMode.DEFAULT) {
            // The platform-wide credentials mail lives in auth_service and is email-only. Asking
            // for WhatsApp alongside it is a contradiction rather than a partial success, so the
            // extra channels are reported as skipped instead of silently dropped.
            authService.sendCredToUsers(List.of(userId));
            List<String> skipped = (channels == null ? List.<NotificationTemplateType>of() : channels).stream()
                    .filter(c -> c != NotificationTemplateType.EMAIL)
                    .map(NotificationTemplateType::name)
                    .toList();
            return LearnerCredentialSendResult.builder()
                    .sentChannels(List.of(NotificationTemplateType.EMAIL.name()))
                    .skippedChannels(skipped)
                    .message(skipped.isEmpty()
                            ? "Credentials sent using the system default email."
                            : "Credentials sent using the system default email. Skipped "
                              + String.join(", ", skipped) + " (the system default is email only).")
                    .build();
        }

        if (channels == null || channels.isEmpty()) {
            throw new VacademyException("At least one channel is required");
        }

        UserDTO learner = authService.getUsersFromAuthServiceByUserIds(List.of(userId))
                .stream().findFirst()
                .orElseThrow(() -> new VacademyException("User not found: " + userId));

        UserCredentials credentials = authService.getUsersCredentials(List.of(userId))
                .stream().findFirst()
                .orElseThrow(() -> new VacademyException("Credentials not found for user: " + userId));

        List<String> sent = new ArrayList<>();
        List<String> skipped = new ArrayList<>();

        for (NotificationTemplateType channel : channels) {
            boolean dispatched = dynamicNotificationService.sendLearnerCredentialsNotification(
                    instituteId, channel, learner, credentials.getUsername(), credentials.getPassword(),
                    templateId);
            if (dispatched) {
                sent.add(channel.name());
            } else {
                skipped.add(channel.name());
            }
        }

        return LearnerCredentialSendResult.builder()
                .sentChannels(sent)
                .skippedChannels(skipped)
                .message(buildMessage(sent, skipped))
                .build();
    }

    private String buildMessage(List<String> sent, List<String> skipped) {
        if (sent.isEmpty()) {
            return "Nothing was sent. Check that a template is selected for this channel in Settings, "
                    + "and that the learner has the contact detail it needs.";
        }
        if (skipped.isEmpty()) {
            return "Credentials sent on " + String.join(", ", sent) + ".";
        }
        return "Credentials sent on " + String.join(", ", sent)
                + ". Skipped " + String.join(", ", skipped)
                + " (no template selected, or the learner has no contact detail for it).";
    }

    /** The template currently bound for this institute + channel, if any. */
    public CredentialTemplateConfigDTO getTemplateConfig(String instituteId, NotificationTemplateType channel) {
        return templateBindingService.get(NotificationEventType.LEARNER_CREDENTIALS_SHARED, instituteId, channel);
    }

    /** Points this institute + channel at a template. */
    public void setTemplate(String instituteId, NotificationTemplateType channel, String templateId) {
        templateBindingService.set(NotificationEventType.LEARNER_CREDENTIALS_SHARED, instituteId, channel, templateId);
    }

    /** Clears a binding so the channel stops sending. */
    public void clearTemplate(String instituteId, NotificationTemplateType channel) {
        templateBindingService.clear(NotificationEventType.LEARNER_CREDENTIALS_SHARED, instituteId, channel);
    }
}
