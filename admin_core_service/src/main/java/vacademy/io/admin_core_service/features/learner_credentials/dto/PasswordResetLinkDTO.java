package vacademy.io.admin_core_service.features.learner_credentials.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * The "set a new password" link for one learner, in both the forms an admin needs.
 *
 * <p>{@code resetLink} is the finished URL for this learner — what the email template's
 * {@code {{reset_password_link}}} renders to, and what the admin copies to send by hand.
 *
 * <p>{@code resetLinkTemplate} is the same URL with {@code usernamePlaceholder} left in it. It is
 * what an admin hands to a third-party system (an LMS, a CRM, their own mailer) that will
 * generate these links for its own users: they substitute the username and the link works, with
 * no per-user call back to us.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@JsonIgnoreProperties(ignoreUnknown = true)
public class PasswordResetLinkDTO {
    private String username;
    private String resetLink;
    private String resetLinkTemplate;
    private String usernamePlaceholder;
}
