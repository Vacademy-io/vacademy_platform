package vacademy.io.admin_core_service.features.presentation_mode.learner.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

@Data
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class ParticipantDto {
    private String username;
    private String userId;
    private String name;
    private String email;
    private String status;
    private Date joinedAt;
}