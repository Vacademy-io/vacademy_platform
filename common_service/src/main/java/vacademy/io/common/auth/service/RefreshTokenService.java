package vacademy.io.common.auth.service;

import jakarta.transaction.Transactional;
import vacademy.io.common.auth.constants.AuthConstant;
import vacademy.io.common.auth.entity.RefreshToken;
import vacademy.io.common.auth.entity.User;
import vacademy.io.common.auth.repository.RefreshTokenRepository;
import vacademy.io.common.auth.repository.UserRepository;
import vacademy.io.common.exceptions.ExpiredTokenException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@Service
public class RefreshTokenService {

    @Autowired
    RefreshTokenRepository refreshTokenRepository;

    @Autowired
    UserRepository userRepository;

    @Autowired
    JwtService jwtService;

    public RefreshToken createRefreshToken(String username, String clientName) {
        Optional<User> userOptional = userRepository.findByUsername(username);
        if (userOptional.isEmpty()) throw new RuntimeException();
        Map<String, Object> moreDetails = new HashMap<>();
        moreDetails.put("user", userOptional.get().getId());

        RefreshToken refreshToken = RefreshToken.builder()
                .userInfo(userOptional.get())
                .token(jwtService.generateRefreshToken(moreDetails, userOptional.get()))
                .expiryDate(Instant.now().plusSeconds(AuthConstant.refreshTokenExpiryInSecs)) // set expiry of refresh token to 1 month
                .clientName(clientName)
                .build();

        return refreshTokenRepository.save(refreshToken);
    }


    public Optional<RefreshToken> findByToken(String token) {
        return refreshTokenRepository.findByToken(token);
    }

    @Transactional
    public void deleteRefreshToken(RefreshToken token) {
        refreshTokenRepository.delete(token);
    }

    @Transactional
    public void deleteAllRefreshToken(User user) {
        refreshTokenRepository.deleteAllByUserInfo(user);
    }

    public RefreshToken verifyExpiration(RefreshToken token) {
        if (token.getExpiryDate().compareTo(Instant.now()) < 0) {
            throw new ExpiredTokenException(token.getToken() + " Refresh token is expired. Please make a new login..!");
        }
        return token;
    }

}