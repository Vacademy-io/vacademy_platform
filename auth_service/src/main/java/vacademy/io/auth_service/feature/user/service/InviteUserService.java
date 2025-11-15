package vacademy.io.auth_service.feature.user.service;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.auth_service.feature.institute.InstituteInfoDTO;
import vacademy.io.auth_service.feature.institute.InstituteInternalService;
import vacademy.io.auth_service.feature.notification.service.NotificationService;
import vacademy.io.auth_service.feature.user.dto.ModifyUserRolesDTO;
import vacademy.io.auth_service.feature.user.util.RandomCredentialGenerator;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.entity.User;
import vacademy.io.common.auth.enums.UserRoleStatus;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.auth.service.UserService;
import vacademy.io.common.notification.dto.GenericEmailRequest;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class InviteUserService {
    private final UserService userService;
    private final RoleService roleService;
    private final NotificationService notificationService;

    @Autowired
    private InstituteInternalService instituteInternalService;

    public UserDTO inviteUser(UserDTO userDTO, String instituteId) {
        setRandomCredentials(userDTO);
        userDTO.setRootUser(true);
        User user = userService.createUserFromUserDto(userDTO);
        userDTO.setId(user.getId());
        userService.addUserRoles(instituteId, userDTO.getRoles(), user, UserRoleStatus.INVITED.name());
        sendInvitationEmail(userDTO, instituteId);
        return userDTO;
    }

    public String resendInvitation(String userId, CustomUserDetails userDetails) {
        User user = userService.getUserById(userId);
        sendReminderEmail(user);
        return "Reminder sent successfully!!!";
    }

    public String updateInvitationUser(UserDTO userDTO, String instituteId, CustomUserDetails userDetails) {
        User user = updateUserDetails(userDTO);
        updateUserRoles(user, userDTO.getRoles(), instituteId, userDetails);
        sendReminderEmail(user);
        return "Details updated successfully!!!";
    }

    private void setRandomCredentials(UserDTO userDTO) {
        userDTO.setPassword(RandomCredentialGenerator.generateRandomPassword());
        userDTO.setUsername(RandomCredentialGenerator.generateRandomUsername(userDTO.getFullName()));
    }

    private User updateUserDetails(UserDTO userDTO) {
        User user = userService.getUserById(userDTO.getId());
        if (isValid(userDTO.getFullName())) user.setFullName(userDTO.getFullName());
        if (isValid(userDTO.getEmail())) user.setEmail(userDTO.getEmail());
        userService.updateUser(user);
        return user;
    }

    private void updateUserRoles(User user, List<String> newRoles, String instituteId, CustomUserDetails userDetails) {
        ModifyUserRolesDTO deleteRoles = createModifyRolesDTO(user.getId(), instituteId, getUserRoleNames(user));
        roleService.removeRolesFromUser(deleteRoles, userDetails);

        ModifyUserRolesDTO addRoles = createModifyRolesDTO(user.getId(), instituteId, newRoles);
        roleService.addRolesToUser(addRoles, Optional.of(UserRoleStatus.INVITED.name()), userDetails);
    }

    private void sendInvitationEmail(UserDTO userDTO, String instituteId) {
        InstituteInfoDTO instituteInfoDTO=null;

        String instituteName = "Vacademy"; // Default fallback
        String theme="#E67E22";
        String adminLoginUrl="https://dash.vacademy.io";
        if (StringUtils.hasText(instituteId)) {
            instituteInfoDTO=instituteInternalService.getInstituteByInstituteId(instituteId);
            if(instituteInfoDTO.getInstituteName()!=null)
                instituteName=instituteInfoDTO.getInstituteName();
            if(instituteInfoDTO.getInstituteThemeCode()!=null)
                theme=instituteInfoDTO.getInstituteThemeCode();
            if(instituteInfoDTO.getLearnerPortalUrl()!=null)
                adminLoginUrl=instituteInfoDTO.getAdminPortalUrl();
        }
        GenericEmailRequest emailRequest = createEmailRequest(
                userDTO.getEmail(), "Invitation Mail",
                InviteUserEmailBody.createInviteUserEmail(
                        userDTO.getFullName(), userDTO.getUsername(), userDTO.getPassword(), userDTO.getRoles(), theme,instituteName,adminLoginUrl)
        );
        notificationService.sendGenericHtmlMail(emailRequest, instituteId);
    }

    private void sendReminderEmail(User user) {
        String instituteId = null;
        if (user.getRoles() != null && !user.getRoles().isEmpty()) {
            instituteId = user.getRoles().iterator().next().getInstituteId();
        }
        
        GenericEmailRequest emailRequest = createEmailRequest(
                user.getEmail(), "Invitation Reminder Mail",
                InviteUserEmailBody.createReminderEmail(
                        user.getFullName(), user.getUsername(), user.getPassword(), getUserRoleNames(user))
        );
        notificationService.sendGenericHtmlMail(emailRequest, instituteId);
    }

    private ModifyUserRolesDTO createModifyRolesDTO(String userId, String instituteId, List<String> roles) {
        ModifyUserRolesDTO modifyUserRolesDTO = new ModifyUserRolesDTO();
        modifyUserRolesDTO.setUserId(userId);
        modifyUserRolesDTO.setInstituteId(instituteId);
        modifyUserRolesDTO.setRoles(roles);
        return modifyUserRolesDTO;
    }

    private GenericEmailRequest createEmailRequest(String to, String subject, String body) {
        GenericEmailRequest emailRequest = new GenericEmailRequest();
        emailRequest.setTo(to);
        emailRequest.setSubject(subject);
        emailRequest.setBody(body);
        return emailRequest;
    }

    private List<String> getUserRoleNames(User user) {
        return user.getRoles().stream()
                .map(userRole -> userRole.getRole().getName())
                .collect(Collectors.toList());
    }

    private boolean isValid(String value) {
        return value != null && !value.isEmpty();
    }
}
