package vacademy.io.notification_service.features.email_otp.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.notification_service.features.email_otp.entity.EmailOtp;
import vacademy.io.notification_service.features.email_otp.repository.OtpRepository;
import vacademy.io.notification_service.service.EmailService;

import java.util.Optional;
import java.util.concurrent.ThreadLocalRandom;

@Service
public class OTPService {

    @Autowired
    OtpRepository otpRepository;

    @Autowired
    EmailService emailService;

    public static String generateOTP(int length) {
        ThreadLocalRandom random = ThreadLocalRandom.current();
        StringBuilder otp = new StringBuilder();
        for (int i = 0; i < length; i++) {
            otp.append(random.nextInt(10));
        }
        return otp.toString();
    }

    public Boolean sendEmailOtp(String to, String subject, String service, String name) {
        EmailOtp otp = createNewOTP(to, service);
        try {
            emailService.sendEmailOtp(to, subject, service, name, otp.getOtp());
        } catch (Exception e) {
            return false;
        }
        return true;
    }

    public Boolean verifyEmailOtp(String otp, String email) {
        Optional<EmailOtp> otpOptional = otpRepository.findTopByEmailOrderByCreatedAtDesc(email);
        if (otpOptional.isPresent()) {
            EmailOtp emailOtp = otpOptional.get();
            if (emailOtp.getOtp().equals(otp)) {
                emailOtp.setIsVerified("true");
                otpRepository.save(emailOtp);
                return true;
            }
        }
        return false;
    }

    EmailOtp createNewOTP(String email, String service) {
        EmailOtp otp = EmailOtp.builder()
                .email(email)
                .service(service)
                .otp(generateOTP(6))
                .build();
        return otpRepository.save(otp);
    }


}