package vacademy.io.auth_service.feature.user.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.auth_service.feature.notification.dto.NotificationDTO;
import vacademy.io.auth_service.feature.notification.dto.NotificationToUserDTO;
import vacademy.io.auth_service.feature.notification.enums.NotificationSource;
import vacademy.io.auth_service.feature.notification.service.NotificationEmailBody;
import vacademy.io.auth_service.feature.notification.service.NotificationService;
import vacademy.io.common.auth.entity.User;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.auth.repository.UserRepository;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

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
            if (user == null || user.getId() == null || user.getEmail() == null || user.getUsername() == null || user.getPassword() == null) {
                continue; // skip null or incomplete users
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
}
