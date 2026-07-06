package vacademy.io.admin_core_service.features.notification_service.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.institute.service.setting.InstituteSettingService;
import vacademy.io.admin_core_service.features.notification.dto.NotificationToUserDTO;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.institute.entity.Institute;
import vacademy.io.common.notification.dto.AttachmentUsersDTO;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Resolves the institute admins who should receive a copy of payment-related
 * emails (invoice email / payment confirmation email). Driven by two keys in
 * {@code INVOICE_SETTING}:
 * <ul>
 *   <li>{@code sendAdminCopy} — master toggle (boolean, default false)</li>
 *   <li>{@code adminCopyUserIds} — auth-service user ids of the selected admins</li>
 * </ul>
 * Never throws: any lookup failure degrades to "no admin copies" so it can
 * never break invoice generation or the payment webhook flow.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class InvoiceAdminCopyRecipientResolver {

    private final InstituteRepository instituteRepository;
    private final InstituteSettingService instituteSettingService;
    private final AuthService authService;

    /**
     * Admin recipients for a plain (no-attachment) email. Emails already going
     * out to someone else (learner, billing contact) are excluded so nobody is
     * mailed twice.
     */
    public List<NotificationToUserDTO> buildAdminCopyRecipients(String instituteId, Set<String> excludeEmails) {
        List<NotificationToUserDTO> recipients = new ArrayList<>();
        for (UserDTO admin : resolveAdminCopyUsers(instituteId, excludeEmails)) {
            NotificationToUserDTO recipient = new NotificationToUserDTO();
            recipient.setUserId(admin.getId());
            recipient.setChannelId(admin.getEmail());
            recipient.setPlaceholders(new HashMap<>());
            recipients.add(recipient);
        }
        return recipients;
    }

    /**
     * Same lookup for attachment emails: each admin gets the exact attachment
     * payload (typically the invoice PDF) that goes to the primary recipient.
     */
    public List<AttachmentUsersDTO> buildAdminCopyAttachmentRecipients(
            String instituteId,
            Set<String> excludeEmails,
            List<AttachmentUsersDTO.AttachmentDTO> attachments) {
        List<AttachmentUsersDTO> recipients = new ArrayList<>();
        for (UserDTO admin : resolveAdminCopyUsers(instituteId, excludeEmails)) {
            AttachmentUsersDTO recipient = new AttachmentUsersDTO();
            recipient.setUserId(admin.getId());
            recipient.setChannelId(admin.getEmail());
            recipient.setPlaceholders(new HashMap<>());
            recipient.setAttachments(attachments);
            recipients.add(recipient);
        }
        return recipients;
    }

    @SuppressWarnings("unchecked")
    private List<UserDTO> resolveAdminCopyUsers(String instituteId, Set<String> excludeEmails) {
        try {
            if (!StringUtils.hasText(instituteId)) {
                return List.of();
            }
            Institute institute = instituteRepository.findById(instituteId).orElse(null);
            if (institute == null) {
                return List.of();
            }
            Object raw = instituteSettingService.getSettingData(institute, "INVOICE_SETTING");
            if (!(raw instanceof Map)) {
                return List.of();
            }
            Map<String, Object> settings = (Map<String, Object>) raw;
            if (!Boolean.TRUE.equals(settings.get("sendAdminCopy"))) {
                return List.of();
            }
            Object idsRaw = settings.get("adminCopyUserIds");
            if (!(idsRaw instanceof List)) {
                return List.of();
            }
            List<String> userIds = ((List<?>) idsRaw).stream()
                    .filter(Objects::nonNull)
                    .map(Object::toString)
                    .filter(StringUtils::hasText)
                    .distinct()
                    .collect(Collectors.toList());
            if (userIds.isEmpty()) {
                return List.of();
            }

            Set<String> excluded = excludeEmails == null ? Set.of()
                    : excludeEmails.stream()
                            .filter(StringUtils::hasText)
                            .map(email -> email.toLowerCase(Locale.ROOT))
                            .collect(Collectors.toSet());

            Set<String> seen = new HashSet<>();
            List<UserDTO> admins = new ArrayList<>();
            for (UserDTO user : authService.getUsersFromAuthServiceByUserIds(userIds)) {
                if (user == null || !StringUtils.hasText(user.getEmail())) {
                    continue;
                }
                String email = user.getEmail().toLowerCase(Locale.ROOT);
                if (excluded.contains(email) || !seen.add(email)) {
                    continue;
                }
                admins.add(user);
            }
            return admins;
        } catch (Exception e) {
            log.warn("Could not resolve invoice admin-copy recipients for institute {}: {}",
                    instituteId, e.getMessage());
            return List.of();
        }
    }
}
