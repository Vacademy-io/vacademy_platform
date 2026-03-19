package vacademy.io.common.notification.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
@AllArgsConstructor
@NoArgsConstructor
public class GenericEmailRequest {
    private String to;
    private String subject;
    private String service;
    private String body;
    private String emailType; // Email type to use (e.g., UTILITY_EMAIL, MARKETING_EMAIL)

    // Explicit getter for emailType to ensure it's available during compilation
    public String getEmailType() {
        return emailType;
    }

    public void setEmailType(String emailType) {
        this.emailType = emailType;
    }
}