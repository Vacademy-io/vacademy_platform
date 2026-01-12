package vacademy.io.notification_service.features.email_otp.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.notification_service.features.email_otp.entity.EmailOtp;

import java.util.List;
import java.util.Optional;

@Repository
public interface OtpRepository extends JpaRepository<EmailOtp, String> {

    List<EmailOtp> findAllByService(String service);

    Optional<EmailOtp> findByEmailAndService(String email, String service);

    Optional<EmailOtp> findByOtp(String otp);

    Optional<EmailOtp> findTopByEmailOrderByCreatedAtDesc(String email);

    // WhatsApp OTP queries
    Optional<EmailOtp> findTopByPhoneNumberAndTypeOrderByCreatedAtDesc(String phoneNumber, String type);

    Optional<EmailOtp> findByPhoneNumberAndServiceAndType(String phoneNumber, String service, String type);

}