package vacademy.io.auth_service.feature.auth.manager;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.auth_service.feature.auth.constants.AuthConstants;
import vacademy.io.auth_service.feature.auth.dto.JwtResponseDto;
import vacademy.io.auth_service.feature.auth.dto.RegisterRequest;
import vacademy.io.auth_service.feature.auth.service.AuthService;
import vacademy.io.auth_service.feature.notification.service.NotificationEmailBody;
import vacademy.io.auth_service.feature.notification.service.NotificationService;
import vacademy.io.auth_service.feature.user.util.RandomCredentialGenerator;
import vacademy.io.common.auth.entity.RefreshToken;
import vacademy.io.common.auth.entity.Role;
import vacademy.io.common.auth.entity.User;
import vacademy.io.common.auth.entity.UserRole;
import vacademy.io.common.auth.enums.UserRoleStatus;
import vacademy.io.common.auth.repository.UserRepository;
import vacademy.io.common.auth.repository.UserRoleRepository;
import vacademy.io.common.auth.service.JwtService;
import vacademy.io.common.auth.service.RefreshTokenService;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.dto.InstituteIdAndNameDTO;
import vacademy.io.common.institute.dto.InstituteInfoDTO;
import vacademy.io.common.notification.dto.GenericEmailRequest;

import java.util.*;

@Component
public class AdminOAuth2Manager {

    @Autowired
    UserRepository userRepository;

    @Autowired
    JwtService jwtService;

    @Autowired
    RefreshTokenService refreshTokenService;

    @Autowired
    UserRoleRepository userRoleRepository;

    @Autowired
    NotificationService notificationService;


    public JwtResponseDto loginUserByEmail(String email) {
        Optional<User> userOptional = userRepository.findTopByEmailOrderByCreatedAtDesc(email);
        if (userOptional.isEmpty() || !userOptional.get().isRootUser()) {
            throw new UsernameNotFoundException("invalid user request..!!");
        }

        refreshTokenService.deleteAllRefreshToken(userOptional.get());

        User user = userOptional.get();

        List<UserRole> userRoles = userRoleRepository.findByUser(user);

        if (!userRoles.isEmpty()) {
            userRoleRepository.updateUserRoleStatusByInstituteIdAndUserId(UserRoleStatus.ACTIVE.name(), userRoles.get(0).getInstituteId(), List.of(user.getId()));
        }

        RefreshToken refreshToken = refreshTokenService.createRefreshToken(user.getUsername(), "oauth2-client");
        return JwtResponseDto.builder().accessToken(jwtService.generateToken(user, userRoles)).refreshToken(refreshToken.getToken()).build();
    }

    public JwtResponseDto registerRootUser(String fullName,String email) {
        String userName = RandomCredentialGenerator.generateRandomUsername(fullName);
        String password = RandomCredentialGenerator.generateRandomPassword();
        RegisterRequest registerRequest = new RegisterRequest();
        registerRequest.setEmail(email);
        registerRequest.setFullName(fullName);
        registerRequest.setPassword(password);
        registerRequest.setUserName(userName);
        Set<UserRole> userRoleSet = new HashSet<>();

        User newUser = createUser(registerRequest, userRoleSet);

        // Generate a refresh token
        RefreshToken refreshToken = refreshTokenService.createRefreshToken(userName, "VACADEMY-WEB");

        sendWelcomeMailToUser(newUser);

        return generateJwtTokenForUser(newUser, refreshToken, userRoleSet.stream().toList());
    }

    @Transactional
    public User createUser(RegisterRequest registerRequest, Set<UserRole> roles) {

        User user = User.builder()
                .fullName(registerRequest.getFullName())
                .username(registerRequest.getUserName())
                .email(registerRequest.getEmail())
                .password(registerRequest.getPassword())
                .roles(roles)
                .isRootUser(true)
                .build();

        for (UserRole role : roles) {
            role.setUser(user);
        }

        userRepository.save(user);

        return user;
    }

    public JwtResponseDto generateJwtTokenForUser(User user, RefreshToken refreshToken, List<UserRole> userRoles) {

        // Check if the user is a root user
        if (user.isRootUser()) {
            String accessToken = jwtService.generateToken(user, userRoles);

            // Return a JwtResponseDto with access token and refresh token
            return JwtResponseDto.builder()
                    .accessToken(accessToken)
                    .refreshToken(refreshToken.getToken())
                    .build();
        }

        // If the user is not a root user, you can handle other logic or throw an exception
        throw new VacademyException(HttpStatus.BAD_REQUEST, "Non-root user is not allowed to generate token.");
    }



    public void sendWelcomeMailToUser(User user) {
        GenericEmailRequest genericEmailRequest = new GenericEmailRequest();
        genericEmailRequest.setTo(user.getEmail());
        genericEmailRequest.setBody(NotificationEmailBody.createWelcomeEmailBody("Vacademy", user.getFullName(), user.getUsername(), user.getPassword()));
        genericEmailRequest.setSubject("Welcome to Vacademy");
        notificationService.sendGenericHtmlMail(genericEmailRequest);
    }

}
