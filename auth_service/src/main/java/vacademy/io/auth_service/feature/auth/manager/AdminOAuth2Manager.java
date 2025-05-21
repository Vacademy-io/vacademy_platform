package vacademy.io.auth_service.feature.auth.manager;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Component;
import vacademy.io.auth_service.feature.auth.dto.JwtResponseDto;
import vacademy.io.auth_service.feature.notification.service.NotificationService;
import vacademy.io.common.auth.entity.RefreshToken;
import vacademy.io.common.auth.entity.User;
import vacademy.io.common.auth.entity.UserRole;
import vacademy.io.common.auth.enums.UserRoleStatus;
import vacademy.io.common.auth.repository.UserRepository;
import vacademy.io.common.auth.repository.UserRoleRepository;
import vacademy.io.common.auth.service.JwtService;
import vacademy.io.common.auth.service.RefreshTokenService;

import java.util.List;
import java.util.Optional;

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

}
