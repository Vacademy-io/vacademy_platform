package vacademy.io.notification_service.features.announcements.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import vacademy.io.common.auth.entity.User;
import vacademy.io.notification_service.constants.NotificationConstants;
import vacademy.io.notification_service.features.announcements.client.AuthServiceClient;
import vacademy.io.notification_service.features.announcements.dto.UserAnnouncementPreferenceResponse;
import vacademy.io.notification_service.features.announcements.dto.UserAnnouncementPreferenceUpdateRequest;
import vacademy.io.notification_service.features.announcements.entity.UserAnnouncementSetting;
import vacademy.io.notification_service.features.announcements.enums.AnnouncementChannel;
import vacademy.io.notification_service.features.announcements.exception.ValidationException;
import vacademy.io.notification_service.features.announcements.repository.UserAnnouncementSettingsRepository;
import vacademy.io.notification_service.service.EmailService;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class UserAnnouncementPreferenceService {

    private static final String DEFAULT_SOURCE_IDENTIFIER = "DEFAULT";
    private static final String EMAIL_KEY_SEPARATOR = "::";
    private static final String DEFAULT_EMAIL_TYPE = NotificationConstants.UTILITY_EMAIL;

    private final EmailService emailService;
    private final UserAnnouncementSettingsRepository preferenceRepository;
    private final AuthServiceClient authServiceClient;

    @Transactional(readOnly = true)
    public UserAnnouncementPreferenceResponse getPreferences(String username, String instituteId) {
        validateUsername(username);
        validateInstituteId(instituteId);

        String userId = resolveUserId(username,instituteId);
        String normalizedInstituteId = normalizeInstituteId(instituteId);

        List<UserAnnouncementSetting> settings =
                preferenceRepository.findByUserIdAndInstituteId(userId, normalizedInstituteId);
        List<EmailService.EmailSenderInfo> availableSenders =
                emailService.listInstituteEmailSenders(normalizedInstituteId);
        return buildResponse(username, availableSenders, settings);
    }

    @Transactional
    public UserAnnouncementPreferenceResponse updatePreferences(String username,
                                                                String instituteId,
                                                                UserAnnouncementPreferenceUpdateRequest request) {
        validateUsername(username);
        validateInstituteId(instituteId);

        if (request == null || request.getPreferences() == null) {
            log.info("No preference payload supplied for username: {}. Returning current view.", username);
            return getPreferences(username, instituteId);
        }

        String userId = resolveUserId(username,instituteId);
        String normalizedInstituteId = normalizeInstituteId(instituteId);
        UserAnnouncementPreferenceUpdateRequest.PreferenceUpdate payload = request.getPreferences();

        List<EmailService.EmailSenderInfo> availableSenders =
                emailService.listInstituteEmailSenders(normalizedInstituteId);
        Map<String, List<String>> sendersByType = availableSenders.stream()
                .collect(Collectors.groupingBy(
                        info -> normalizeEmailType(info.getEmailType()),
                        Collectors.mapping(info -> normalizeEmail(info.getFromAddress()), Collectors.toList())
                ));

        if (payload.getEmailSenders() != null) {
            payload.getEmailSenders().forEach(update -> {
                String normalizedType = normalizeEmailType(update.getEmailType());
                if (normalizedType == null) {
                    return;
                }

                List<String> addresses = sendersByType.getOrDefault(normalizedType, List.of());
                if (addresses.isEmpty()) {
                    log.warn("No configured senders found for email type {} while updating preferences for user {}", normalizedType, username);
                }
                boolean unsubscribed = Boolean.TRUE.equals(update.getUnsubscribed());

                addresses.stream()
                        .filter(StringUtils::hasText)
                        .forEach(address -> {
                    String storageKey = buildEmailStorageKey(normalizedType, address);
                    preferenceRepository.findByUserIdAndInstituteIdAndChannelAndSourceIdentifier(
                                    userId, normalizedInstituteId, AnnouncementChannel.EMAIL, storageKey)
                            .ifPresentOrElse(existing -> {
                                if (unsubscribed) {
                                    existing.setUnsubscribed(true);
                                    existing.setUnsubscribedAt(LocalDateTime.now());
                                    existing.setInstituteId(normalizedInstituteId);
                                    preferenceRepository.save(existing);
                                    log.info("User {} remains unsubscribed from email sender {} ({})",
                                            username, address, normalizedType);
                                } else {
                                    preferenceRepository.delete(existing);
                                    log.info("User {} re-subscribed to email sender {} ({})",
                                            username, address, normalizedType);
                                }
                            }, () -> {
                                if (unsubscribed) {
                                    UserAnnouncementSetting setting = new UserAnnouncementSetting();
                                    setting.setUserId(userId);
                                    setting.setInstituteId(normalizedInstituteId);
                                    setting.setChannel(AnnouncementChannel.EMAIL);
                                    setting.setSourceIdentifier(storageKey);
                                    setting.setUnsubscribed(true);
                                    setting.setUnsubscribedAt(LocalDateTime.now());
                                    preferenceRepository.save(setting);
                                    log.info("User {} unsubscribed from email sender {} ({})",
                                            username, address, normalizedType);
                                }
                            });
                });
            });
        }

        if (payload.getWhatsappUnsubscribed() != null) {
            boolean unsubscribed = Boolean.TRUE.equals(payload.getWhatsappUnsubscribed());

            preferenceRepository.findByUserIdAndInstituteIdAndChannelAndSourceIdentifier(
                            userId, normalizedInstituteId, AnnouncementChannel.WHATSAPP, DEFAULT_SOURCE_IDENTIFIER)
                    .ifPresentOrElse(existing -> {
                        if (unsubscribed) {
                            existing.setUnsubscribed(true);
                            existing.setUnsubscribedAt(LocalDateTime.now());
                            existing.setInstituteId(normalizedInstituteId);
                            preferenceRepository.save(existing);
                            log.info("User {} remains unsubscribed from WhatsApp notifications", username);
                        } else {
                            preferenceRepository.delete(existing);
                            log.info("User {} re-subscribed to WhatsApp notifications", username);
                        }
                    }, () -> {
                        if (unsubscribed) {
                            UserAnnouncementSetting setting = new UserAnnouncementSetting();
                            setting.setUserId(userId);
                            setting.setInstituteId(normalizedInstituteId);
                            setting.setChannel(AnnouncementChannel.WHATSAPP);
                            setting.setSourceIdentifier(DEFAULT_SOURCE_IDENTIFIER);
                            setting.setUnsubscribed(true);
                            setting.setUnsubscribedAt(LocalDateTime.now());
                            preferenceRepository.save(setting);
                            log.info("User {} unsubscribed from WhatsApp notifications", username);
                        }
                    });
        }

        List<UserAnnouncementSetting> refreshed =
                preferenceRepository.findByUserIdAndInstituteId(userId, normalizedInstituteId);
        return buildResponse(username, availableSenders, refreshed);
    }

    @Transactional(readOnly = true)
    public boolean isEmailSenderUnsubscribed(String userId, String instituteId, String emailType, String fromAddress) {
        if (!StringUtils.hasText(userId) || !StringUtils.hasText(instituteId)) {
            return false;
        }
        String normalizedUserId = normalizeUserId(userId);
        String normalizedInstituteId = normalizeInstituteId(instituteId);
        String normalizedType = normalizeEmailType(emailType);
        String normalizedAddress = normalizeEmail(fromAddress);

        if (normalizedAddress == null) {
            return false;
        }

        String storageKey = buildEmailStorageKey(normalizedType, normalizedAddress);
        return preferenceRepository.findByUserIdAndInstituteIdAndChannelAndSourceIdentifier(
                normalizedUserId, normalizedInstituteId, AnnouncementChannel.EMAIL, storageKey
        ).filter(UserAnnouncementSetting::isUnsubscribed).isPresent();
    }

    @Transactional(readOnly = true)
    public boolean isWhatsAppUnsubscribed(String userId, String instituteId) {
        if (!StringUtils.hasText(userId) || !StringUtils.hasText(instituteId)) {
            return false;
        }
        String normalizedUserId = normalizeUserId(userId);
        String normalizedInstituteId = normalizeInstituteId(instituteId);
        return preferenceRepository.findByUserIdAndInstituteIdAndChannelAndSourceIdentifier(
                normalizedUserId, normalizedInstituteId, AnnouncementChannel.WHATSAPP, DEFAULT_SOURCE_IDENTIFIER
        ).filter(UserAnnouncementSetting::isUnsubscribed).isPresent();
    }

    private UserAnnouncementPreferenceResponse buildResponse(String displayUsername,
                                                             List<EmailService.EmailSenderInfo> availableSenders,
                                                             List<UserAnnouncementSetting> settings) {
        Map<String, UserAnnouncementSetting> emailSettings = settings.stream()
                .filter(setting -> setting.getChannel() == AnnouncementChannel.EMAIL)
                .collect(Collectors.toMap(
                        UserAnnouncementSetting::getSourceIdentifier,
                        setting -> setting,
                        (existing, replacement) -> replacement
                ));

        List<UserAnnouncementPreferenceResponse.EmailSenderPreference> senderResponses = new ArrayList<>();
        List<UserAnnouncementPreferenceResponse.EmailSenderOption> availableEmailSenders = new ArrayList<>();
        Set<String> seenKeys = new HashSet<>();

        for (EmailService.EmailSenderInfo info : availableSenders) {
            String normalizedType = normalizeEmailType(info.getEmailType());
            String normalizedAddress = normalizeEmail(info.getFromAddress());
            if (normalizedAddress == null) {
                continue;
            }

            String storageKey = buildEmailStorageKey(normalizedType, normalizedAddress);
            seenKeys.add(storageKey);

            UserAnnouncementSetting record = emailSettings.get(storageKey);
            boolean unsubscribed = record != null && record.isUnsubscribed();
            LocalDateTime unsubscribedAt = record != null ? record.getUnsubscribedAt() : null;

            senderResponses.add(new UserAnnouncementPreferenceResponse.EmailSenderPreference(
                    info.getFromAddress(),
                    normalizedType,
                    unsubscribed,
                    unsubscribedAt
            ));
            availableEmailSenders.add(new UserAnnouncementPreferenceResponse.EmailSenderOption(
                    normalizedType,
                    info.getFromAddress()
            ));
        }

        emailSettings.entrySet().stream()
                .filter(entry -> !seenKeys.contains(entry.getKey()))
                .forEach(entry -> {
                    EmailKey key = parseEmailStorageKey(entry.getKey());
                    if (key.normalizedAddress() == null) {
                        return;
                    }
                    senderResponses.add(new UserAnnouncementPreferenceResponse.EmailSenderPreference(
                            key.normalizedAddress(),
                            key.emailType(),
                            entry.getValue().isUnsubscribed(),
                            entry.getValue().getUnsubscribedAt()
                    ));
                    availableEmailSenders.add(new UserAnnouncementPreferenceResponse.EmailSenderOption(
                            key.emailType(),
                            key.normalizedAddress()
                    ));
                    seenKeys.add(entry.getKey());
                });

        UserAnnouncementPreferenceResponse.EmailPreference emailPreference =
                new UserAnnouncementPreferenceResponse.EmailPreference(false, senderResponses);

        UserAnnouncementSetting whatsappSetting = settings.stream()
                .filter(setting -> setting.getChannel() == AnnouncementChannel.WHATSAPP
                        && DEFAULT_SOURCE_IDENTIFIER.equalsIgnoreCase(setting.getSourceIdentifier()))
                .findFirst()
                .orElse(null);

        boolean whatsappUnsubscribed = whatsappSetting != null && whatsappSetting.isUnsubscribed();
        LocalDateTime whatsappUnsubscribedAt = whatsappSetting != null ? whatsappSetting.getUnsubscribedAt() : null;

        UserAnnouncementPreferenceResponse.WhatsAppPreference whatsappPreference =
                new UserAnnouncementPreferenceResponse.WhatsAppPreference(
                        whatsappUnsubscribed,
                        whatsappUnsubscribedAt,
                        null
                );

        UserAnnouncementPreferenceResponse.PreferenceSettings preferenceSettings =
                new UserAnnouncementPreferenceResponse.PreferenceSettings(emailPreference, whatsappPreference);

        UserAnnouncementPreferenceResponse.AvailableSenders availableSendersResponse =
                new UserAnnouncementPreferenceResponse.AvailableSenders(
                        List.copyOf(availableEmailSenders),
                        null
                );

        return new UserAnnouncementPreferenceResponse(
                displayUsername,
                preferenceSettings,
                availableSendersResponse
        );
    }

    private void validateUsername(String username) {
        if (username == null || username.trim().isEmpty()) {
            throw new ValidationException("Username cannot be null or empty");
        }
    }

    private void validateInstituteId(String instituteId) {
        if (instituteId == null || instituteId.trim().isEmpty()) {
            throw new ValidationException("Institute ID cannot be null or empty");
        }
    }

    private String normalizeUserId(String userId) {
        return userId.trim();
    }

    private String normalizeInstituteId(String instituteId) {
        return instituteId.trim();
    }

    private String normalizeEmail(String email) {
        if (email == null) {
            return null;
        }
        String trimmed = email.trim();
        return trimmed.isEmpty() ? null : trimmed.toLowerCase();
    }

    private String normalizeEmailType(String emailType) {
        if (emailType == null || emailType.trim().isEmpty()) {
            return DEFAULT_EMAIL_TYPE;
        }
        return emailType.trim().toUpperCase();
    }

    private String buildEmailStorageKey(String emailType, String normalizedAddress) {
        String type = emailType != null ? emailType : DEFAULT_EMAIL_TYPE;
        String address = normalizedAddress != null ? normalizedAddress : DEFAULT_SOURCE_IDENTIFIER;
        return type + EMAIL_KEY_SEPARATOR + address;
    }

    private EmailKey parseEmailStorageKey(String storedKey) {
        if (storedKey == null || storedKey.isBlank()) {
            return new EmailKey(DEFAULT_EMAIL_TYPE, null);
        }
        int idx = storedKey.indexOf(EMAIL_KEY_SEPARATOR);
        if (idx <= 0) {
            return new EmailKey(DEFAULT_EMAIL_TYPE, normalizeEmail(storedKey));
        }
        String type = storedKey.substring(0, idx);
        String address = storedKey.substring(idx + EMAIL_KEY_SEPARATOR.length());
        return new EmailKey(normalizeEmailType(type), normalizeEmail(address));
    }

    private record EmailKey(String emailType, String normalizedAddress) { }

    private String resolveUserId(String username, String instituteId) {
        String trimmedUsername = username.trim();
        User user = authServiceClient.getUserByUsername(trimmedUsername,instituteId);
        if (user == null || !StringUtils.hasText(user.getId())) {
            throw new ValidationException("Unable to resolve user ID for username: " + username);
        }
        return normalizeUserId(user.getId());
    }
}

