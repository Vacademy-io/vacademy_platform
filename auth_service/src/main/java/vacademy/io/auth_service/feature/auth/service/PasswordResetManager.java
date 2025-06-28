package vacademy.io.auth_service.feature.auth.service;

import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import vacademy.io.auth_service.feature.auth.enums.ClientNameEnum;
import vacademy.io.auth_service.feature.notification.service.NotificationEmailBody;
import vacademy.io.auth_service.feature.notification.service.NotificationService;
import vacademy.io.common.auth.entity.User;
import vacademy.io.common.auth.enums.UserRoleStatus;
import vacademy.io.common.auth.repository.UserRepository;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.notification.dto.GenericEmailRequest;

import java.util.List;

@Service
@RequiredArgsConstructor
public class PasswordResetManager {

    private final UserRepository userRepository;
    private final NotificationService notificationService;

    public String sendPasswordToUser(String email,String clientName) {
        User user = null;
        if (clientName != null && clientName.equals(ClientNameEnum.ADMIN.name())) {
            user = userRepository.findMostRecentUserByRootFlagAndRoleStatusNative(true, List.of(UserRoleStatus.ACTIVE.name()),email).orElseThrow(()->new UsernameNotFoundException("invalid user request..!!"));
        }
        else{
            user = userRepository.findMostRecentUserByRootFlagAndRoleStatusNative(false,List.of(UserRoleStatus.ACTIVE.name()),email).orElseThrow(()->new UsernameNotFoundException("invalid user request..!!"));
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
