package vacademy.io.auth_service.feature.user.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import vacademy.io.auth_service.feature.auth.constants.AuthConstants;
import vacademy.io.auth_service.feature.notification.dto.NotificationDTO;
import vacademy.io.auth_service.feature.notification.dto.NotificationToUserDTO;
import vacademy.io.auth_service.feature.notification.enums.NotificationSource;
import vacademy.io.auth_service.feature.notification.service.NotificationEmailBody;
import vacademy.io.auth_service.feature.notification.service.NotificationService;
import vacademy.io.auth_service.feature.notification.dto.unified.UnifiedSendResponse;
import vacademy.io.auth_service.feature.user.dto.CredentialShareResult;
import vacademy.io.common.auth.dto.UserCredentials;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.entity.User;
import vacademy.io.common.auth.entity.UserRole;
import vacademy.io.common.auth.enums.PortalsEnum;
import vacademy.io.common.auth.enums.UserRoleStatus;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.auth.repository.UserRepository;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.InstituteChoice;
import vacademy.io.common.institute.OriginInstituteResolver;
import vacademy.io.common.notification.dto.GenericEmailRequest;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class UserOperationService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private NotificationService notificationService;

    @Autowired
    private vacademy.io.auth_service.feature.admin_core_service.service.InstitutePolicyService institutePolicyService;

    @Autowired
    private UserCredentialUpdateService userCredentialUpdateService;

    @Autowired
    private OriginInstituteResolver originInstituteResolver;

    /**
     * Shares credentials and reports what happened, per learner.
     *
     * <p>Returns counts rather than a sentence because every branch below is a 200: asking for
     * learners who do not exist, or who have no email/username/password on file, mails nobody
     * and used to be indistinguishable from a batch that went out in full.
     */
    public CredentialShareResult shareUserPasswords(List<String> userIds, CustomUserDetails userDetails) {
        return shareUserPasswords(userIds, userDetails != null ? userDetails.getUserId() : "auth-service");
    }

    public CredentialShareResult shareUserPasswords(List<String> userIds, String sourceId) {
        int requested = userIds == null ? 0 : userIds.size();
        if (requested == 0) {
            return CredentialShareResult.builder()
                    .sent(0).failed(0)
                    .message("Invalid input: userIds is missing").build();
        }

        List<User> users = userRepository.findUserDetailsByIds(userIds);
        if (users == null || users.isEmpty()) {
            return CredentialShareResult.builder()
                    .sent(0).failed(requested)
                    .message("No valid users found").build();
        }

        return sendUserPasswords(users, sourceId, requested);
    }

    /**
     * Plain-sentence reply kept for the internal route, whose callers fire and forget.
     */
    public String sendUserPasswords(List<String> userIds) {
        return shareUserPasswords(userIds, "auth-service").getMessage();
    }

    private CredentialShareResult sendUserPasswords(List<User> users, String sourceId, int requested) {
        if (users == null || users.isEmpty() || sourceId == null || sourceId.isBlank()) {
            return CredentialShareResult.builder()
                    .sent(0).failed(requested)
                    .message("Invalid data for sending passwords").build();
        }

        // One sender address covers the whole batch, so pick it from every recipient's institutes
        // rather than from whichever user happens to sort first: an admin sending credentials from
        // their institute's portal should have that institute's address win even if the first user
        // in the list also belongs to another one.
        String instituteId = originInstituteResolver.chooseInstituteIdFor(
                users.stream()
                        .filter(u -> u.getRoles() != null)
                        .flatMap(u -> u.getRoles().stream())
                        .map(UserRole::getInstituteId)
                        .toList());

        NotificationDTO notificationDTO = new NotificationDTO();
        notificationDTO.setBody(NotificationEmailBody.sendUserPasswords("auth-service"));
        notificationDTO.setSubject("Login credentials!!");
        notificationDTO.setSource(NotificationSource.USER_CREDENTIALS.name());
        notificationDTO.setSourceId(sourceId);
        notificationDTO.setNotificationType("EMAIL");

        List<NotificationToUserDTO> notifyUsers = new ArrayList<>();

        for (User user : users) {
            if (user.getId() == null || user.getEmail() == null || user.getUsername() == null || user.getPassword() == null) {
                continue;
            }

            NotificationToUserDTO notification = new NotificationToUserDTO();
            notification.setUserId(user.getId());
            notification.setChannelId(user.getEmail());
            notification.setPlaceholders(Map.of(
                    "username", user.getUsername(),
                    "password", user.getPassword()
            ));
            notifyUsers.add(notification);
        }

        if (notifyUsers.isEmpty()) {
            return CredentialShareResult.builder()
                    .sent(0).failed(requested)
                    .message("No valid users to notify — the selected learners have no email, "
                            + "username or password on file.").build();
        }

        notificationDTO.setUsers(notifyUsers);
        // The unified send reports per-recipient acceptance. Discarding it is what let a batch
        // that every recipient rejected still answer "Notification sent successfully".
        UnifiedSendResponse response = notificationService.sendEmailViaUnified(notificationDTO, instituteId);
        int accepted = response != null ? response.getAccepted() : notifyUsers.size();
        int skipped = requested - notifyUsers.size();
        int failed = requested - accepted;

        StringBuilder message = new StringBuilder();
        if (accepted == 0) {
            message.append("Nothing was sent.");
        } else if (failed == 0) {
            message.append("Notification sent successfully.");
        } else {
            message.append("Notification sent to ").append(accepted).append(" of ").append(requested).append(".");
        }
        if (skipped > 0) {
            message.append(" Skipped ").append(skipped)
                    .append(" with no email, username or password on file.");
        }

        return CredentialShareResult.builder()
                .sent(accepted).failed(Math.max(0, failed)).message(message.toString()).build();
    }

    /**
     * Admin-initiated credential change (Learner list → Portal Access → Edit).
     *
     * <p>Delegates the write to {@link UserCredentialUpdateService} so it takes
     * exactly the same path as the learner's own change: uniqueness is checked
     * up front, the old username's auth-cache entries are evicted, and the
     * rename fans out to {@code student.username} plus the four
     * assessment-database copies. This method used to set username and password
     * directly on the entity and tell nobody, which left every one of those
     * copies stale.
     */
    public String updateUserPassword(UserCredentials userCredentials, CustomUserDetails userDetails) {
        User user = userCredentialUpdateService.updateCredentials(
                userCredentials.getUserId(),
                userCredentials.getUsername(),
                userCredentials.getPassword());
        sendPasswordToUser(user);
        // Mirror the new password to any WordPress LMS the learner's courses are
        // connected to (async, best-effort — never blocks/fails the password change).
        institutePolicyService.syncLmsPassword(user.getId(), user.getEmail(), user.getPassword());
        return "Password updated successfully";
    }

    @Async
    public String sendPasswordToUser(User user) {
        // Carries the user's new password. Reached by self-invocation, so despite @Async this
        // runs on the request thread and the host can disambiguate a multi-institute user;
        // if it ever does run async the choice degrades to the first role, as before.
        String instituteId = InstituteChoice.forUser(originInstituteResolver, user);

        String emailBody = NotificationEmailBody.sendUpdatedUserPasswords(
                "auth-service", user.getFullName(), user.getUsername(), user.getPassword());

        GenericEmailRequest genericEmailRequest = new GenericEmailRequest();
        genericEmailRequest.setTo(user.getEmail());
        genericEmailRequest.setSubject("Your Updated Account Credentials for Accessing the App");
        genericEmailRequest.setBody(emailBody);

        if (!notificationService.sendGenericHtmlMailViaUnifiedAsBoolean(genericEmailRequest, instituteId)) {
            throw new VacademyException("Email not sent");
        }

        return "Email sent successfully";
    }

    public UserDTO findUserByEmail(String email){
        Optional<User>optionalUser = userRepository.findFirstByEmailOrderByCreatedAtDesc(email);
        if (optionalUser.isEmpty()){
            return null;
        }
        User user = optionalUser.get();
        UserDTO userDTO = new UserDTO(user);
        userDTO.setUsername(user.getUsername());
        userDTO.setPassword(user.getPassword());
        return userDTO;
    }

    public Optional<UserDTO> findByUserName(String username,
                                            String instituteId,
                                            String portal) {

        Optional<User> optionalUser = userRepository.findByUsername(username);
        if (optionalUser.isEmpty()) {
            return Optional.empty();
        }

        User user = optionalUser.get();

        // Get allowed statuses and roles based on portal
        List<String> allowedStatuses = getAllowedStatuses(portal);
        List<String> allowedRoleNames = getValidRoleNames(portal);

        // instituteId is OPTIONAL. Usernames are globally unique — findByUsername above
        // returns at most one user — so the portal's role + status already identify a
        // legitimate learner without it. Requiring it locked out every institute on a
        // shared domain: with no institute_domain_routing row the caller has no id to
        // send, and a valid learner got a 404 on their own join link. When an id IS
        // supplied it still scopes the match, so single-tenant callers are unchanged.
        boolean instituteScoped = instituteId != null && !instituteId.isBlank();
        boolean hasValidRole = user.getRoles() != null && user.getRoles().stream()
                .anyMatch(ur ->
                        (!instituteScoped
                                || (ur.getInstituteId() != null && ur.getInstituteId().equals(instituteId)))
                                && ur.getStatus() != null && allowedStatuses.contains(ur.getStatus())
                                && ur.getRole() != null && allowedRoleNames.contains(ur.getRole().getName())
                );

        if (hasValidRole) {
            return Optional.of(new UserDTO(user));
        } else {
            return Optional.empty();
        }
    }

    private List<String> getAllowedStatuses(String portal) {
        // You can extend this if portal-specific statuses are needed
        return List.of(UserRoleStatus.ACTIVE.name(), UserRoleStatus.INVITED.name());
    }

    private List<String> getValidRoleNames(String portal) {
        if (portal == null) {
            return List.of(); // empty list if portal is null
        }

        if (portal.equalsIgnoreCase(PortalsEnum.ADMIN.name())) {
            return AuthConstants.VALID_ROLES_FOR_ADMIN_PORTAL;
        } else if (portal.equalsIgnoreCase(PortalsEnum.LEARNER.name())) {
            return AuthConstants.VALID_ROLES_FOR_STUDENT_PORTAL;
        } else {
            return List.of(); // empty list for unknown portals
        }
    }
}
