package vacademy.io.auth_service.feature.auth.service;

import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import vacademy.io.auth_service.feature.auth.constants.AuthConstants;
import vacademy.io.auth_service.feature.auth.enums.ClientNameEnum;
import vacademy.io.auth_service.feature.notification.service.NotificationEmailBody;
import vacademy.io.auth_service.feature.notification.service.NotificationService;
import vacademy.io.common.auth.entity.User;
import vacademy.io.common.auth.enums.UserRoleStatus;
import vacademy.io.common.auth.repository.UserRepository;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.notification.dto.GenericEmailRequest;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class PasswordResetManager {

    private final UserRepository userRepository;
    private final NotificationService notificationService;

    public String sendPasswordToUser(String email,String clientName) {
        User user = null;
        if (clientName != null && clientName.equals(ClientNameEnum.ADMIN.name())) {
            Optional<User> userOptional = userRepository.findMostRecentUserByEmailAndRoleStatusAndRoleNames(email, List.of(UserRoleStatus.ACTIVE.name(),UserRoleStatus.INVITED.name()), AuthConstants.VALID_ROLES_FOR_ADMIN_PORTAL);
            if (userOptional.isEmpty()) {
                throw new VacademyException("User not found");
            }
            user = userOptional.get();
        }
        else{
            Optional<User> userOptional = userRepository.findMostRecentUserByEmailAndRoleStatusAndRoleNames(email, List.of(UserRoleStatus.ACTIVE.name(),UserRoleStatus.INVITED.name()), AuthConstants.VALID_ROLES_FOR_STUDENT_PORTAL);
            if (userOptional.isEmpty()) {
                throw new VacademyException("User not found");
            }
            user = userOptional.get();
        }
        String emailBody = NotificationEmailBody.forgetPasswordEmailBody("auth-service", user.getFullName(), user.getUsername(), user.getPassword());

        GenericEmailRequest genericEmailRequest = new GenericEmailRequest();
        genericEmailRequest.setTo(email);
        genericEmailRequest.setSubject("Your Account Credentials for Accessing the App"); // More intuitive subject
        genericEmailRequest.setBody(emailBody);

        if (!notificationService.sendGenericHtmlMail(genericEmailRequest)) {
            throw new VacademyException("Email not sent");
        }

        return "Email sent successfully";
    }
}
