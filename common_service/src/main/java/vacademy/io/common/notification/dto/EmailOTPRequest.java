package vacademy.io.common.notification.dto;


import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class EmailOTPRequest {
    private String to;
    private String subject;
    private String service;
    private String name;
    private String otp;
}