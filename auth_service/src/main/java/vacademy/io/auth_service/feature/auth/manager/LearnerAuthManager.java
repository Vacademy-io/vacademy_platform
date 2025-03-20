package vacademy.io.auth_service.feature.auth.manager;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Component;
import vacademy.io.auth_service.feature.auth.dto.AuthRequestDto;
import vacademy.io.auth_service.feature.auth.dto.JwtResponseDto;
import vacademy.io.auth_service.feature.notification.service.NotificationService;
import vacademy.io.common.auth.dto.RefreshTokenRequestDTO;
import vacademy.io.common.auth.entity.RefreshToken;
import vacademy.io.common.auth.entity.User;
import vacademy.io.common.auth.entity.UserRole;
import vacademy.io.common.auth.enums.UserRoleStatus;
import vacademy.io.common.auth.repository.UserRepository;
import vacademy.io.common.auth.repository.UserRoleRepository;
import vacademy.io.common.auth.service.JwtService;
import vacademy.io.common.auth.service.RefreshTokenService;
import vacademy.io.common.core.utils.NumberUtil;
import vacademy.io.common.exceptions.ExpiredTokenException;
import vacademy.io.common.notification.dto.EmailOTPRequest;

import java.util.List;
import java.util.Optional;

@Component
public class LearnerAuthManager {

    @Autowired
    UserRepository userRepository;

    @Autowired
    JwtService jwtService;

    @Autowired
    RefreshTokenService refreshTokenService;

    @Autowired
    AuthenticationManager authenticationManager;

    @Autowired
    UserRoleRepository userRoleRepository;

    @Autowired
    NotificationService notificationService;

    public JwtResponseDto loginUser(AuthRequestDto authRequestDTO) {
        Authentication authentication;

        if (authRequestDTO.getInstituteId() == null) {
            authentication = authenticationManager.authenticate(new UsernamePasswordAuthenticationToken(authRequestDTO.getUserName(), authRequestDTO.getPassword()));

        } else
            authentication = authenticationManager.authenticate(new UsernamePasswordAuthenticationToken(authRequestDTO.getInstituteId() + "@" + authRequestDTO.getUserName(), authRequestDTO.getPassword()));

        if (authentication.isAuthenticated()) {

            String username = authRequestDTO.getUserName();

            Optional<User> userOptional = userRepository.findByUsername(username);
            if (userOptional.isEmpty()) {
                throw new UsernameNotFoundException("invalid user request..!!");
            }

            refreshTokenService.deleteAllRefreshToken(userOptional.get());

            User user = userOptional.get();

            List<UserRole> userRoles = userRoleRepository.findByUserAndStatusAndRoleName(user, UserRoleStatus.ACTIVE.name(), "STUDENT");
            if (userRoles.isEmpty()){
                throw new UsernameNotFoundException("invalid user request..!!");
            }

            RefreshToken refreshToken = refreshTokenService.createRefreshToken(authRequestDTO.getUserName(), authRequestDTO.getClientName());
            return JwtResponseDto.builder().accessToken(jwtService.generateToken(user, userRoles)).refreshToken(refreshToken.getToken()).build();

        } else {
            throw new UsernameNotFoundException("invalid user request..!!");
        }
    }

    public String requestOtp(AuthRequestDto authRequestDTO) {
        Optional<User> user = userRepository.findTopByEmailOrderByCreatedAtDesc(authRequestDTO.getEmail());

        if (user.isEmpty()) {
            throw new UsernameNotFoundException("invalid user request..!!");
        } else {
            // todo: generate OTP for
            notificationService.sendOtp(makeOtp(authRequestDTO.getEmail()));
            return "OTP sent to " + authRequestDTO.getEmail();
        }

    }

    private EmailOTPRequest makeOtp(String email){
        return EmailOTPRequest.builder().to(email).service("auth-service").subject("Vacademy | Otp verification. ").name("Vacademy User").build();
    }

    public JwtResponseDto loginViaOtp(AuthRequestDto authRequestDTO) {

        if (authRequestDTO.getOtp() == null) {
            throw new UsernameNotFoundException("invalid user request..!!");
        }

        // todo: validate OTP
        Boolean isValidOtp = notificationService.verifyOTP(EmailOTPRequest.builder().otp(authRequestDTO.getOtp()).to(authRequestDTO.getEmail()).build());
        if (!isValidOtp) {
            throw new UsernameNotFoundException("invalid user request..!!");
        }

        Optional<User> user = userRepository.findTopByEmailOrderByCreatedAtDesc(authRequestDTO.getEmail());

        if (user.isEmpty()) {
            throw new UsernameNotFoundException("invalid user request..!!");
        }

        Authentication authentication;

        if (authRequestDTO.getInstituteId() == null) {
            authentication = authenticationManager.authenticate(new UsernamePasswordAuthenticationToken(user.get().getUsername(), user.get().getPassword()));

        } else
            authentication = authenticationManager.authenticate(new UsernamePasswordAuthenticationToken(authRequestDTO.getInstituteId() + "@" + user.get().getUsername(), user.get().getPassword()));

        if (authentication.isAuthenticated()) {

            String username = user.get().getUsername();

            refreshTokenService.deleteAllRefreshToken(user.get());

            List<UserRole> userRoles = userRoleRepository.findByUser(user.get());


            RefreshToken refreshToken = refreshTokenService.createRefreshToken(username, authRequestDTO.getClientName());
            return JwtResponseDto.builder().accessToken(jwtService.generateToken(user.get(), userRoles)).refreshToken(refreshToken.getToken()).build();

        } else {
            throw new UsernameNotFoundException("invalid user request..!!");
        }

    }

    public JwtResponseDto refreshToken(RefreshTokenRequestDTO refreshTokenRequestDTO) {
        return refreshTokenService.findByToken(refreshTokenRequestDTO.getToken()).map(refreshTokenService::verifyExpiration).map(RefreshToken::getUserInfo).map(userInfo -> {

            List<UserRole> userRoles = userRoleRepository.findByUser(userInfo);

            // Generate new access token
            String accessToken = jwtService.generateToken(userInfo, userRoles);
            // Return the new JWT token
            return JwtResponseDto.builder().accessToken(accessToken).build();
        }).orElseThrow(() -> new ExpiredTokenException(refreshTokenRequestDTO.getToken() + " Refresh token is. Please make a new login..!"));

    }
}
