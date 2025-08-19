package vacademy.io.notification_service;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

@ActiveProfiles("test")
@SpringBootTest(properties = {
        "spring.mail.host=localhost",
        "spring.mail.port=2525",
        "app.ses.sender.email=test@local",
        "ses.sender.email=test@local",
        "auth.server.baseurl=http://localhost:18071",
        "admin.core.service.baseurl=http://localhost:18072"
})
class NotificationServiceApplicationTests {

    @Test
    void contextLoads() {
    }

}
