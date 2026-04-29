package vacademy.io.admin_core_service.features.auth_service.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import vacademy.io.common.auth.dto.UserDTO;

/**
 * Sends credential emails after paid enrollment confirmation without blocking
 * the payment webhook thread.
 */
@Service
public class AsyncEnrollmentEmailService {

    private static final Logger logger = LoggerFactory.getLogger(AsyncEnrollmentEmailService.class);

    @Autowired
    private AuthService authService;

    @Async("emailTaskExecutor")
    public void sendCredentialEmailForPaidEnrollment(UserDTO userDTO, String instituteId, String loginUrl) {
        try {
            logger.info("Sending credential email after payment confirmation. UserId={}, InstituteId={}",
                    userDTO.getId(), instituteId);
            authService.createUserFromAuthServiceForLearnerEnrollment(userDTO, instituteId, true, loginUrl);
            logger.info("Credential email sent successfully. UserId={}", userDTO.getId());
        } catch (Exception e) {
            logger.error("Failed to send credential email after payment. UserId={}, InstituteId={}: {}",
                    userDTO.getId(), instituteId, e.getMessage(), e);
        }
    }
}
