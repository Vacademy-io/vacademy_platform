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
import vacademy.io.common.auth.dto.UserCredentials;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.entity.User;
import vacademy.io.common.auth.entity.UserRole;
import vacademy.io.common.auth.enums.PortalsEnum;
import vacademy.io.common.auth.enums.UserRoleStatus;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.auth.repository.UserRepository;
import vacademy.io.common.exceptions.VacademyException;
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

    public String sendUserPasswords(List<String> userIds, CustomUserDetails userDetails) {
        if (userIds == null || userIds.isEmpty()) {
            return "Invalid input: userIds or userDetails is missing";
        }

        List<User> users = userRepository.findUserDetailsByIds(userIds);
        if (users == null || users.isEmpty()) {
            return "No valid users found";
        }

        return sendUserPasswords(users, userDetails.getUserId());
    }

    public String sendUserPasswords(List<User> users, String sourceId) {
        if (users == null || users.isEmpty() || sourceId == null || sourceId.isBlank()) {
            return "Invalid data for sending passwords";
        }

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
            return "No valid users to notify";
        }

        notificationDTO.setUsers(notifyUsers);
        return notificationService.sendEmailToUsers(notificationDTO);
    }

    public String updateUserPassword(UserCredentials userCredentials, CustomUserDetails userDetails) {
        User user = userRepository.findById(userCredentials.getUserId())
                .orElseThrow(() -> new VacademyException("User not found"));
        user.setPassword(userCredentials.getPassword());
        user.setUsername(userCredentials.getUsername());
        userRepository.save(user);
        sendPasswordToUser(user);
        return "Password updated successfully";
    }

    @Async
    public String sendPasswordToUser(User user) {
        String instituteId = null;
        if (user.getRoles() != null && !user.getRoles().isEmpty()) {
            instituteId = user.getRoles().iterator().next().getInstituteId();
        }
        
        String emailBody = NotificationEmailBody.sendUpdatedUserPasswords(
                "auth-service", user.getFullName(), user.getUsername(), user.getPassword());

        GenericEmailRequest genericEmailRequest = new GenericEmailRequest();
        genericEmailRequest.setTo(user.getEmail());
        genericEmailRequest.setSubject("Your Updated Account Credentials for Accessing the App");
        genericEmailRequest.setBody(emailBody);

        if (!notificationService.sendGenericHtmlMail(genericEmailRequest, instituteId)) {
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

        boolean hasValidRole = user.getRoles() != null && user.getRoles().stream()
                .anyMatch(ur ->
                        ur.getInstituteId() != null && ur.getInstituteId().equals(instituteId)
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