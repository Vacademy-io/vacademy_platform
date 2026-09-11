package vacademy.io.auth_service.feature.user.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.auth_service.feature.institute.InstituteInfoDTO;
import vacademy.io.auth_service.feature.institute.InstituteInternalService;
import vacademy.io.auth_service.feature.notification.constants.NotificationConstant;
import vacademy.io.auth_service.feature.notification.service.NotificationService;
import vacademy.io.auth_service.feature.user.dto.ModifyUserRolesDTO;
import vacademy.io.auth_service.feature.user.util.RandomCredentialGenerator;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.entity.User;
import vacademy.io.common.auth.enums.UserRoleStatus;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.auth.service.UserService;
import vacademy.io.common.institute.InstituteChoice;
import vacademy.io.common.institute.OriginInstituteResolver;
import vacademy.io.common.notification.dto.GenericEmailRequest;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class InviteUserService {
    private static final String DEFAULT_ADMIN_LOGIN_URL = "https://dash.vacademy.io/login";

    private final UserService userService;
    private final RoleService roleService;
    private final NotificationService notificationService;
    private final OriginInstituteResolver originInstituteResolver;

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
        notificationService.sendGenericHtmlMailViaUnified(emailRequest, instituteId);
    }

    private void sendReminderEmail(User user) {
        // Carries the invitee's password — an arbitrary role would send it from another
        // institute's address.
        String instituteId = InstituteChoice.forUser(originInstituteResolver, user);

        // Sign off and link as the sending institute, like the initial invitation does.
        // The reminder never depended on admin-core before this lookup, so a failure here
        // must not block the resend — it falls back to the platform defaults the template
        // used to hardcode.
        String instituteName = "Vacademy";
        String adminLoginUrl = DEFAULT_ADMIN_LOGIN_URL;
        if (StringUtils.hasText(instituteId)) {
            try {
                InstituteInfoDTO instituteInfoDTO = instituteInternalService.getInstituteByInstituteId(instituteId);
                if (instituteInfoDTO != null) {
                    if (StringUtils.hasText(instituteInfoDTO.getInstituteName()))
                        instituteName = instituteInfoDTO.getInstituteName();
                    if (StringUtils.hasText(instituteInfoDTO.getAdminPortalUrl()))
                        adminLoginUrl = toLoginUrl(instituteInfoDTO.getAdminPortalUrl());
                }
            } catch (Exception e) {
                log.warn("Institute branding lookup failed for invitation reminder (user {}, institute {}): {}",
                        user.getId(), instituteId, e.getMessage());
            }
        }

        GenericEmailRequest emailRequest = createEmailRequest(
                user.getEmail(), "Invitation Reminder Mail",
                InviteUserEmailBody.createReminderEmail(
                        user.getFullName(), user.getUsername(), user.getPassword(), getUserRoleNames(user),
                        instituteName, adminLoginUrl)
        );
        notificationService.sendGenericHtmlMailViaUnified(emailRequest, instituteId);
    }

    // admin_portal_base_url is stored scheme-less for some institutes ("admin.shikshanation.com");
    // a scheme-less href is a relative link in every mail client, so normalise before use.
    private static String toLoginUrl(String adminPortalUrl) {
        String base = adminPortalUrl.trim();
        if (!base.matches("(?i)^https?://.*")) {
            base = "https://" + base;
        }
        while (base.endsWith("/")) {
            base = base.substring(0, base.length() - 1);
        }
        return base + "/login";
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
        // Names the event so institute-configured CC/BCC copies can match it. Shared by both the
        // initial invitation and the reminder — an institute copying team invites wants both.
        emailRequest.setService(NotificationConstant.EVENT_TEAM_INVITE);
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
