package vacademy.io.notification_service.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

import java.util.ArrayList;
import java.util.Map;

@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
@Data
public class EmailToUsersDTO {
    private Map<String, ArrayList<String>> userNotifications;
    private String body;
    private String subject;
}
