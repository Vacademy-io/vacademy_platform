package vacademy.io.community_service.feature.session.dto.admin;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import vacademy.io.community_service.feature.presentation.dto.question.AddPresentationDto;
import vacademy.io.community_service.feature.presentation.dto.question.PresentationSlideDto;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

@Data
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class LiveSessionDto {
    private String sessionId;
    private String inviteCode;
    private String sessionStatus;
    private Boolean canJoinInBetween = true;
    private Boolean showResultsAtLastSlide = true;
    private Boolean allowLearnerHandRaise = true;
    private Boolean allowChat = true;
    private Boolean isSessionRecorded = false;
    private Integer defaultSecondsForQuestion = 60;
    private Integer studentAttempts = 1;
    private String excalidrawData;
    private boolean allowAfterStart = true;
    private AddPresentationDto slides;
    @JsonIgnore
    private CreateSessionDto createSessionDto;
    private Integer currentSlideIndex = 0;
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
    private Date endTime;
}
