package vacademy.io.admin_core_service.features.presentation_mode.learner.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import vacademy.io.admin_core_service.features.presentation_mode.admin.dto.CreatePresentationDto;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

@Data
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class LiveSessionDto {
    private String sessionId;
    private String inviteCode;
    private String sessionStatus;
    private boolean allowAfterStart = true;
    private List<PresentationSlideDto> slides = new ArrayList<>();
    @JsonIgnore
    private CreatePresentationDto createPresentationDto;
    private int currentSlideIndex = 0;
    @JsonIgnore
    private List<SseEmitter> studentEmitters = Collections.synchronizedList(new ArrayList<>());
    @JsonIgnore
    private List<ParticipantDto> participants = new CopyOnWriteArrayList<>();
    @JsonIgnore
    private SseEmitter teacherEmitter;
    @JsonIgnore
    private Map<String, String> slideStatsJson = new ConcurrentHashMap<>();

    private Date creationTime;
    private Date startTime;
}

