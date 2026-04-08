package vacademy.io.community_service.feature.session.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import vacademy.io.community_service.feature.presentation.dto.question.PresentationSlideDto;
import vacademy.io.community_service.feature.session.dto.admin.*;
import vacademy.io.community_service.feature.session.manager.LiveSessionPersistenceService;
import vacademy.io.community_service.feature.session.manager.LiveSessionService;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

@RestController
@RequestMapping("/community-service/engage/admin")
@Tag(name = "Admin Session", description = "APIs for managing live presentation sessions as an admin/presenter")
public class AdminSessionController {

    @Autowired
    LiveSessionService liveSessionService;

    @Autowired
    LiveSessionPersistenceService persistenceService;

    @Autowired
    @Qualifier("sseHeartbeatScheduler")
    private ScheduledExecutorService sseHeartbeatScheduler;

    @Operation(summary = "Create a new live session", description = "Creates a new live presentation session for the given presentation")
    @ApiResponse(responseCode = "200", description = "Session created successfully")
    @PostMapping("/create")
    public ResponseEntity<LiveSessionDto> createSession(@RequestBody CreateSessionDto createSessionDto) {
        LiveSessionDto sessionDto = liveSessionService.createSession(createSessionDto);
        return ResponseEntity.ok(sessionDto);
    }

    @Operation(summary = "Connect to presenter SSE stream", description = "Establishes a Server-Sent Events connection for the presenter to receive real-time session updates")
    @GetMapping("/{sessionId}")
    public SseEmitter presenterStream(@Parameter(description = "Session ID") @PathVariable String sessionId) {
        SseEmitter emitter = new SseEmitter(3L * 60 * 60 * 1000); // 3 hours, for example

        liveSessionService.setPresenterEmitter(sessionId, emitter, true); // Send initial state

        Runnable heartbeatTask = () -> {
            try {
                emitter.send(
                        SseEmitter.event().name("presenter_heartbeat").id(UUID.randomUUID().toString()).data("ping"));
            } catch (IOException | IllegalStateException ignored) {
                // Emitter already closed; the future will be cancelled by the handlers below.
            }
        };
        ScheduledFuture<?> heartbeatFuture =
                sseHeartbeatScheduler.scheduleAtFixedRate(heartbeatTask, 0, 30, TimeUnit.SECONDS);

        emitter.onCompletion(() -> heartbeatFuture.cancel(false));
        emitter.onTimeout(() -> heartbeatFuture.cancel(false));
        emitter.onError(e -> heartbeatFuture.cancel(false));

        return emitter;
    }

    @Operation(summary = "Start a presentation session", description = "Starts an existing session and begins the presentation")
    @PostMapping("/start")
    public ResponseEntity<LiveSessionDto> startSession(@RequestBody StartPresentationDto startPresentationDto) {
        LiveSessionDto liveSessionDto = liveSessionService.startSession(startPresentationDto);
        return ResponseEntity.ok(liveSessionDto);
    }

    @Operation(summary = "Move to a specific slide", description = "Navigates the presentation to a specific slide")
    @PostMapping("/move")
    public ResponseEntity<LiveSessionDto> moveTo(@RequestBody StartPresentationDto startPresentationDto) {
        LiveSessionDto liveSessionDto = liveSessionService.moveTo(startPresentationDto);
        return ResponseEntity.ok(liveSessionDto);
    }

    @Operation(summary = "Finish a session", description = "Ends the live session and marks it as completed")
    @PostMapping("/finish")
    public ResponseEntity<LiveSessionDto> finishSession(@RequestBody StartPresentationDto startPresentationDto) {
        LiveSessionDto liveSessionDto = liveSessionService.finishSession(startPresentationDto);
        return ResponseEntity.ok(liveSessionDto);
    }

    @Operation(summary = "Send participant notifications", description = "Sends notifications to participants after session ends")
    @PostMapping("/finish-send-notifications")
    public ResponseEntity<LiveSessionDto> sendParticipantNotifications(
            @RequestBody NotifyPresentationRequestDto notifyPresentationRequestDto) {
        LiveSessionDto liveSessionDto = liveSessionService.sendParticipantNotifications(notifyPresentationRequestDto);
        return ResponseEntity.ok(liveSessionDto);
    }

    @Operation(summary = "Add a slide during live session", description = "Dynamically adds a new slide to the presentation during an active session")
    @PostMapping("/add-slide-in-session")
    public ResponseEntity<LiveSessionDto> addSlideInLiveSession(@RequestBody PresentationSlideDto presentationSlideDto,
            @RequestParam String sessionId, @RequestParam Integer afterSlideOrder) {
        LiveSessionDto liveSessionDto = liveSessionService.addSlideInLiveSession(presentationSlideDto, sessionId,
                afterSlideOrder);
        return ResponseEntity.ok(liveSessionDto);
    }

    @Operation(summary = "Get slide responses", description = "Retrieves all participant responses for a specific slide in a session")
    @GetMapping("/{sessionId}/slide/{slideId}/responses")
    public ResponseEntity<List<AdminSlideResponseViewDto>> getSlideResponses(
            @PathVariable String sessionId,
            @PathVariable String slideId) {
        List<AdminSlideResponseViewDto> responses = liveSessionService.getSlideResponses(sessionId, slideId);
        return ResponseEntity.ok(responses);
    }

    @Operation(summary = "Get session leaderboard", description = "Returns ranked leaderboard for a session based on participant scores")
    @GetMapping("/{sessionId}/leaderboard")
    public ResponseEntity<List<LeaderboardEntryDto>> getLeaderboard(@PathVariable String sessionId) {
        List<LeaderboardEntryDto> leaderboard = liveSessionService.computeLeaderboard(sessionId);
        return ResponseEntity.ok(leaderboard);
    }

    @Operation(summary = "Get session history for a presentation", description = "Returns all past sessions for a given presentation (database-backed)")
    @GetMapping("/presentation/{presentationId}/sessions")
    public ResponseEntity<List<Map<String, Object>>> getSessionHistory(
            @PathVariable String presentationId) {
        return ResponseEntity.ok(persistenceService.getSessionHistoryForPresentation(presentationId));
    }

    @Operation(summary = "Download leaderboard as CSV", description = "Downloads the session leaderboard as a CSV file")
    @ApiResponse(responseCode = "200", description = "CSV file generated successfully")
    @GetMapping("/{sessionId}/leaderboard/csv")
    public ResponseEntity<String> getLeaderboardCsv(@PathVariable String sessionId) {
        List<LeaderboardEntryDto> leaderboard = liveSessionService.computeLeaderboard(sessionId);
        StringBuilder csv = new StringBuilder();
        csv.append("Rank,Username,Score,Total Time (ms),Correct,Wrong,Unanswered,Total MCQ Questions\n");
        for (LeaderboardEntryDto entry : leaderboard) {
            csv.append(entry.getRank()).append(",")
                    .append("\"").append(entry.getUsername().replace("\"", "\"\"")).append("\",")
                    .append(entry.getTotalScore()).append(",")
                    .append(entry.getTotalTimeMillis()).append(",")
                    .append(entry.getCorrectCount()).append(",")
                    .append(entry.getWrongCount()).append(",")
                    .append(entry.getUnansweredCount()).append(",")
                    .append(entry.getTotalMcqQuestions()).append("\n");
        }
        return ResponseEntity.ok()
                .header("Content-Type", "text/csv")
                .header("Content-Disposition", "attachment; filename=leaderboard_" + sessionId + ".csv")
                .body(csv.toString());
    }
}