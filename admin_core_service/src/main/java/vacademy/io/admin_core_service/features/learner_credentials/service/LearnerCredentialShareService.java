package vacademy.io.admin_core_service.features.learner_credentials.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.institute.entity.Template;
import vacademy.io.admin_core_service.features.institute.repository.TemplateRepository;
import vacademy.io.admin_core_service.features.learner_credentials.dto.LearnerCredentialSendResult;
import vacademy.io.admin_core_service.features.notification.entity.NotificationEventConfig;
import vacademy.io.admin_core_service.features.notification.enums.NotificationEventType;
import vacademy.io.admin_core_service.features.notification.enums.NotificationSourceType;
import vacademy.io.admin_core_service.features.notification.enums.NotificationTemplateType;
import vacademy.io.admin_core_service.features.notification.repository.NotificationEventConfigRepository;
import vacademy.io.admin_core_service.features.notification.service.DynamicNotificationService;
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
 * <p>An institute with no binding sends <b>nothing</b> and the caller is told
 * which channel was skipped. Silently substituting a generic template would put
 * unapproved wording in front of that institute's learners.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LearnerCredentialShareService {

    private final AuthService authService;
    private final DynamicNotificationService dynamicNotificationService;
    private final NotificationEventConfigRepository notificationEventConfigRepository;
    private final TemplateRepository templateRepository;

    /**
     * Shares the learner's CURRENT credentials on each requested channel.
     *
     * <p>The password is read back from auth_service rather than passed in from
     * the browser: it is the authoritative copy, it keeps the plaintext out of
     * this request body, and it means a re-share works long after the change
     * that prompted it.
     */
    public LearnerCredentialSendResult share(String instituteId, String userId,
                                             List<NotificationTemplateType> channels) {
        if (!StringUtils.hasText(instituteId) || !StringUtils.hasText(userId)) {
            throw new VacademyException("instituteId and userId are required");
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
                    instituteId, channel, learner, credentials.getUsername(), credentials.getPassword());
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
        if (!StringUtils.hasText(instituteId)) {
            throw new VacademyException("instituteId is required");
        }
        NotificationEventConfig config = notificationEventConfigRepository
                .findFirstByEventNameAndSourceTypeAndSourceIdAndTemplateTypeAndIsActiveTrueOrderByUpdatedAtDesc(
                        NotificationEventType.LEARNER_CREDENTIALS_SHARED,
                        NotificationSourceType.INSTITUTE,
                        instituteId,
                        channel)
                .orElse(null);
        if (config == null || !StringUtils.hasText(config.getTemplateId())) {
            return CredentialTemplateConfigDTO.builder().build();
        }
        Template template = templateRepository.findById(config.getTemplateId()).orElse(null);
        return CredentialTemplateConfigDTO.builder()
                .templateId(config.getTemplateId())
                .templateName(template != null ? template.getName() : null)
                .templateSubject(template != null ? template.getSubject() : null)
                .build();
    }

    /**
     * Upserts the (institute, channel) binding. One row per pair — repoints and
     * reactivates the existing row rather than inserting a new one each time the
     * admin changes their selection, so the "latest wins" lookup can never end
     * up racing several active rows.
     */
    public void setTemplate(String instituteId, NotificationTemplateType channel, String templateId) {
        if (!StringUtils.hasText(instituteId) || !StringUtils.hasText(templateId)) {
            throw new VacademyException("instituteId and templateId are required");
        }
        Template template = templateRepository.findById(templateId)
                .orElseThrow(() -> new VacademyException("Template not found: " + templateId));

        NotificationEventConfig config = notificationEventConfigRepository
                .findFirstByEventNameAndSourceTypeAndSourceIdAndTemplateTypeOrderByUpdatedAtDesc(
                        NotificationEventType.LEARNER_CREDENTIALS_SHARED,
                        NotificationSourceType.INSTITUTE,
                        instituteId,
                        channel)
                .orElseGet(() -> new NotificationEventConfig(
                        NotificationEventType.LEARNER_CREDENTIALS_SHARED,
                        NotificationSourceType.INSTITUTE,
                        instituteId,
                        channel,
                        null));
        config.setTemplateId(templateId);
        // WhatsApp dispatches by the provider-approved template NAME, so carry it
        // on the config; email resolves its subject/body from the Template row and
        // does not need it.
        config.setTemplateName(channel == NotificationTemplateType.WHATSAPP ? template.getName() : null);
        config.setIsActive(true);
        notificationEventConfigRepository.save(config);
    }

    /** Clears a binding so the channel stops sending. */
    public void clearTemplate(String instituteId, NotificationTemplateType channel) {
        notificationEventConfigRepository
                .findFirstByEventNameAndSourceTypeAndSourceIdAndTemplateTypeOrderByUpdatedAtDesc(
                        NotificationEventType.LEARNER_CREDENTIALS_SHARED,
                        NotificationSourceType.INSTITUTE,
                        instituteId,
                        channel)
                .ifPresent(config -> {
                    config.setIsActive(false);
                    notificationEventConfigRepository.save(config);
                });
    }
}
