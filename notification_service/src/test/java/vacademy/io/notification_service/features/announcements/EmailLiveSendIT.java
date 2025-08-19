package vacademy.io.notification_service.features.announcements;

import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import vacademy.io.notification_service.service.EmailService;

@SpringBootTest(properties = {
        // Ensure in-memory DB and no schedulers for this test
        "spring.datasource.url=jdbc:h2:mem:notifdb;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
        "spring.datasource.driverClassName=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create",
        "spring.quartz.auto-startup=false",
        // Override mail if needed when running locally; replace with real SMTP to actually send
        "spring.mail.host=localhost",
        "spring.mail.port=2525",
        "spring.mail.username=test",
        "spring.mail.password=test",
        "spring.mail.properties.mail.smtp.auth=false",
        "spring.mail.properties.mail.smtp.starttls.enable=false",
        "app.ses.sender.email=test@local"
})
@ActiveProfiles("test")
class EmailLiveSendIT {

    @Autowired
    private EmailService emailService;

    @Test
    @Disabled("Remove @Disabled and set real spring.mail.* props to actually send an email")
    void sendLiveEmailToShreyash() {
        emailService.sendHtmlEmail(
                "shreyash@vidyayatan.com",
                "Vacademy Notification Service - Email Medium Live Test",
                "notification-service",
                "<h3>Email medium live test</h3><p>If you received this, SMTP config works.</p>"
        );
    }
}


