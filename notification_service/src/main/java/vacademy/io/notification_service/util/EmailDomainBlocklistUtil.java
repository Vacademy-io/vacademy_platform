package vacademy.io.notification_service.util;

import java.util.Arrays;
import java.util.List;

/**
 * Utility class for checking if email domains are blocked from receiving notifications.
 */
public class EmailDomainBlocklistUtil {

    /**
     * List of email domains that should not receive email notifications.
     * Add more domains here as needed in the future.
     */
    private static final List<String> BLOCKED_EMAIL_DOMAINS = Arrays.asList(
            "@fivesep.in"
            // Add more blocked domains here, e.g.:
            // "@example.com",
            // "@testdomain.org"
    );

    /**
     * Checks if an email address belongs to a blocked domain.
     * 
     * @param email The email address to check
     * @return true if the email domain is blocked, false otherwise
     */
    public static boolean isEmailDomainBlocked(String email) {
        if (email == null || email.trim().isEmpty()) {
            return false;
        }
        
        String emailLower = email.toLowerCase().trim();
        return BLOCKED_EMAIL_DOMAINS.stream()
                .anyMatch(blockedDomain -> emailLower.endsWith(blockedDomain.toLowerCase()));
    }
}

