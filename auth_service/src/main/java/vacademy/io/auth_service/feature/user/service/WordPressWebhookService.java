package vacademy.io.auth_service.feature.user.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.auth_service.feature.user.dto.WordpressWebhookDTO;
import vacademy.io.common.auth.entity.User;
import vacademy.io.common.auth.repository.UserRepository;
import vacademy.io.common.exceptions.VacademyException;

import java.util.Date;

@Service
public class WordPressWebhookService {

    private static final String EXPECTED_SECRET_TOKEN = "YOUR_VERY_SECRET_TOKEN_HERE";

    @Autowired
    private UserRepository userRepository;

    public void processUserLoginWebhook(WordpressWebhookDTO webhookDTO, String instituteId, String webhookSecret) {
        verifyWebhookSecret(webhookSecret);

        User user = userRepository.findFirstByEmailOrderByCreatedAtDesc(webhookDTO.getEmail())
            .orElseThrow(() -> new VacademyException("User not found!!!"));

        Date now = new Date();
        Date lastLoginTime = user.getLastLoginTime();

        if (lastLoginTime == null || now.after(lastLoginTime)) {
            user.setLastLoginTime(now);
            userRepository.save(user);
        }
    }

    private void verifyWebhookSecret(String webhookSecret) {
        if (webhookSecret == null || !webhookSecret.equals(EXPECTED_SECRET_TOKEN)) {
            throw new VacademyException("Invalid webhook secret token!");
        }
    }
}
