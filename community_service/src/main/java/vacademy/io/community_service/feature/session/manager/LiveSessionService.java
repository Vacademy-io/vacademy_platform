package vacademy.io.community_service.feature.session.manager;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import vacademy.io.common.core.utils.DateUtil;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.community_service.feature.presentation.dto.question.AddPresentationDto;
// import vacademy.io.community_service.feature.presentation.dto.question.PresentationSlideDto; // Assuming not directly used here based on provided code
import vacademy.io.community_service.feature.presentation.dto.question.PresentationSlideDto;
import vacademy.io.community_service.feature.presentation.dto.question.QuestionDTO;
import vacademy.io.community_service.feature.presentation.manager.PresentationCrudManager;
import vacademy.io.community_service.feature.session.dto.admin.*;
import vacademy.io.community_service.feature.session.dto.participant.MarkResponseRequestDto;
import vacademy.io.community_service.feature.session.dto.participant.ParticipantResponseDto;
import vacademy.io.community_service.feature.session.dto.participant.SlideResponsesLogDto;
import vacademy.io.community_service.feature.session.dto.participant.SubmittedResponseDataDto;

import java.io.IOException;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList; // Recommended for studentEmitters
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Service
public class LiveSessionService {
    private static final long SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
    private static final long HEARTBEAT_TIMEOUT_MS = 60000; // 60 seconds

    private final Map<String, LiveSessionDto> sessions = new ConcurrentHashMap<>();
    private final Map<String, String> inviteCodeToSessionId = new ConcurrentHashMap<>();
    private static final long TEACHER_RESPONSE_UPDATE_DEBOUNCE_MS = 10000; // 10 seconds

    private final Map<String, Map<String, Long>> sessionParticipantHeartbeats = new ConcurrentHashMap<>();
    private final ScheduledExecutorService heartbeatMonitor = Executors.newSingleThreadScheduledExecutor();
    private final ScheduledExecutorService sessionCleanupScheduler = Executors.newSingleThreadScheduledExecutor();

    private final ScheduledExecutorService teacherResponseUpdateNotifier = Executors.newSingleThreadScheduledExecutor();
    private final Map<String, Map<String, Long>> pendingTeacherNotifications = new ConcurrentHashMap<>(); // sessionId -> slideId -> lastUpdateTime

    @Autowired
    PresentationCrudManager presentationCrudManager;

    @Autowired
    private ObjectMapper objectMapper; // For JSON processing

    public LiveSessionService() {
        heartbeatMonitor.scheduleAtFixedRate(
                this::checkInactiveParticipants,
                0,
                15,
                TimeUnit.SECONDS
        );
        sessionCleanupScheduler.scheduleAtFixedRate(
                this::cleanupExpiredSessions,
                0,
                1,
                TimeUnit.HOURS
        );
        teacherResponseUpdateNotifier.scheduleAtFixedRate(
                this::processPendingTeacherNotifications,
                TEACHER_RESPONSE_UPDATE_DEBOUNCE_MS, // Initial delay
                TEACHER_RESPONSE_UPDATE_DEBOUNCE_MS, // Period
                TimeUnit.MILLISECONDS
        );
    }

    private void processPendingTeacherNotifications() {
        pendingTeacherNotifications.forEach((sessionId, slideUpdates) -> {
            LiveSessionDto session = sessions.get(sessionId);
            if (session == null || session.getTeacherEmitter() == null || slideUpdates.isEmpty()) {
                pendingTeacherNotifications.remove(sessionId); // Clean up if session gone or no updates
                return;
            }

            slideUpdates.forEach((slideId, lastUpdateTime) -> {
                if (session.getTeacherEmitter() != null) {
                    try {
                        SseEmitter.SseEventBuilder event = SseEmitter.event()
                                .name("slide_response_updated")
                                .id(UUID.randomUUID().toString())
                                .data(Map.of(
                                        "session_id", sessionId,
                                        "slide_id", slideId,
                                        "last_updated_at", lastUpdateTime
                                ));
                        session.getTeacherEmitter().send(event);
                        System.out.println("Sent slide_response_updated SSE to teacher for session " + sessionId + ", slide " + slideId);
                    } catch (Exception e) {
                        System.err.println("Error sending slide_response_updated SSE to teacher for session " + sessionId + ": " + e.getMessage());
                        // Potentially clear emitter if it's consistently failing, though setPresenterEmitter handles some of this
                    }
                }
            });
            slideUpdates.clear(); // Clear processed updates for this session
        });
        // Remove sessions that have no more pending updates
        pendingTeacherNotifications.entrySet().removeIf(entry -> entry.getValue().isEmpty());
    }

    private void scheduleTeacherResponseUpdateNotification(String sessionId, String slideId) {
        LiveSessionDto session = sessions.get(sessionId);
        if (session == null || session.getTeacherEmitter() == null) {
            return;
        }
        // Store the latest update time for this slide in this session
        pendingTeacherNotifications
                .computeIfAbsent(sessionId, k -> new ConcurrentHashMap<>())
                .put(slideId, System.currentTimeMillis());
    }



    private void checkInactiveParticipants() {
        long currentTime = System.currentTimeMillis();
        sessionParticipantHeartbeats.forEach((sessionId, participants) -> {
            LiveSessionDto session = sessions.get(sessionId);
            if (session == null) {
                sessionParticipantHeartbeats.remove(sessionId);
                return;
            }
            List<String> inactiveUsers = new ArrayList<>();
            participants.forEach((username, lastHeartbeat) -> {
                if (currentTime - lastHeartbeat > HEARTBEAT_TIMEOUT_MS) {
                    inactiveUsers.add(username);
                }
            });
            if (!inactiveUsers.isEmpty()) {
                inactiveUsers.forEach(username -> updateParticipantStatus(session, username, "INACTIVE"));
                inactiveUsers.forEach(participants::remove); // Remove from heartbeat tracking
            }
        });
    }

    public void recordHeartbeat(String sessionId, String username) {
        Map<String, Long> participantHeartbeats = sessionParticipantHeartbeats
                .computeIfAbsent(sessionId, k -> new ConcurrentHashMap<>());
        participantHeartbeats.put(username, System.currentTimeMillis());
        LiveSessionDto session = sessions.get(sessionId);
        if (session != null) {
            session.getParticipants().stream()
                    .filter(p -> p.getUsername().equals(username) &&
                            (p.getStatus() == null || "INACTIVE".equals(p.getStatus())))
                    .findFirst()
                    .ifPresent(p -> updateParticipantStatus(session, username, "ACTIVE"));
        }
    }

    public LiveSessionDto createSession(CreateSessionDto createSessionDto) {
        LiveSessionDto session = new LiveSessionDto();
        session.setSessionId(UUID.randomUUID().toString());
        // Assuming LiveSessionDto has a field: private List<SseEmitter> studentEmitters = new CopyOnWriteArrayList<>();
        // If studentEmitters is initialized elsewhere (e.g. getter returning new ArrayList if null), ensure it's thread-safe
        if (session.getStudentEmitters() == null) { // Defensive, depends on LiveSessionDto impl
            session.setStudentEmitters(new CopyOnWriteArrayList<>()); // Explicitly use CopyOnWriteArrayList
        }
        session.setCanJoinInBetween(createSessionDto.getCanJoinInBetween());
        session.setAllowLearnerHandRaise(createSessionDto.getAllowLearnerHandRaise());
        session.setDefaultSecondsForQuestion(createSessionDto.getDefaultSecondsForQuestion());
        session.setShowResultsAtLastSlide(createSessionDto.getShowResultsAtLastSlide());
        session.setStudentAttempts(createSessionDto.getStudentAttempts());
        session.setInviteCode(generateInviteCode());
        session.setCreateSessionDto(createSessionDto);
        session.setSessionStatus("INIT");
        session.setCreationTime(new Date(System.currentTimeMillis()));
        session.setSlides(getLinkedPresentation(createSessionDto));
        sessions.put(session.getSessionId(), session);
        inviteCodeToSessionId.put(session.getInviteCode(), session.getSessionId());
        return session;
    }

    /**
     * Sends the current slide information to all active student emitters for a session.
     * Handles potential errors when sending to individual emitters (e.g., if an emitter is already completed).
     */
    private void sendSlideToStudents(LiveSessionDto session) {
        if (!"LIVE".equals(session.getSessionStatus()) || session.getCurrentSlideIndex() == null || session.getStudentEmitters() == null) {
            return;
        }

        // Iterate over student emitters. CopyOnWriteArrayList handles concurrent modification safely for iteration.
        // If not using CopyOnWriteArrayList, new ArrayList<>(session.getStudentEmitters()) creates a snapshot.
        for (SseEmitter emitter : session.getStudentEmitters()) {
            try {
                SseEmitter.SseEventBuilder event = SseEmitter.event()
                        .name("session_event_learner")
                        .id(UUID.randomUUID().toString())
                        .data(Map.of(
                                "type", "CURRENT_SLIDE",
                                "currentSlideIndex", session.getCurrentSlideIndex(),
                                "totalSlides", (session.getSlides() != null && session.getSlides().getAddedSlides() != null) ? session.getSlides().getAddedSlides().size() : 0
                        ));
                emitter.send(event);
            } catch (IllegalStateException e) {
                // This often means the emitter was already completed (client disconnected, timed out, etc.)
                System.err.println("Error sending slide to a student emitter (already completed) for session " +
                        session.getSessionId() + ": " + e.getMessage() + ". Emitter: " + emitter.toString());
                // The emitter's own onError, onCompletion, or onTimeout handlers (set in addStudentEmitter)
                // are responsible for cleaning it up from the session.getStudentEmitters() list.
            } catch (IOException e) {
                // For other network-related send issues
                System.err.println("IOException sending slide to a student emitter for session " +
                        session.getSessionId() + ": " + e.getMessage() + ". Emitter: " + emitter.toString());
                // Spring's SseEmitter usually triggers onError for IOException during send,
                // which should then call your studentEmitterCleanup.
            } catch (Exception e) {
                // Catch any other unexpected exceptions during send
                System.err.println("Unexpected error sending slide to a student emitter for session " +
                        session.getSessionId() + ": " + e.getClass().getName() + " - " + e.getMessage() + ". Emitter: " + emitter.toString());
            }
        }
    }


    public void addStudentEmitter(String sessionId, SseEmitter emitter, String username) {
        LiveSessionDto session = sessions.get(sessionId);
        if (session == null) {
            emitter.completeWithError(new VacademyException("Session not found (ID: " + sessionId + ") for student " + username));
            return;
        }
        if ("FINISHED".equals(session.getSessionStatus())) {
            emitter.completeWithError(new VacademyException("Session has finished. Cannot connect."));
            return;
        }

        ParticipantDto participant = session.getParticipants().stream()
                .filter(p -> p.getUsername().equals(username))
                .findFirst()
                .orElse(null);

        if (participant == null) {
            emitter.completeWithError(new VacademyException("Participant " + username + " not registered in session " + sessionId + ". Please join first."));
            return;
        }

        // Ensure studentEmitters list is initialized (important if using CopyOnWriteArrayList directly in DTO)
        if (session.getStudentEmitters() == null) {
            session.setStudentEmitters(new CopyOnWriteArrayList<>());
        }
        session.getStudentEmitters().add(emitter);
        System.out.println("Student emitter added for " + username + " in session " + sessionId + ". Total emitters: " + session.getStudentEmitters().size());

        updateParticipantStatus(session, username, "ACTIVE");
        sessionParticipantHeartbeats.computeIfAbsent(sessionId, k -> new ConcurrentHashMap<>())
                .put(username, System.currentTimeMillis());

        // Send current state
        if ("LIVE".equals(session.getSessionStatus()) && session.getCurrentSlideIndex() != null) {
            try {
                emitter.send(SseEmitter.event().name("session_event_learner").id(UUID.randomUUID().toString())
                        .data(Map.of("type", "CURRENT_SLIDE", "currentSlideIndex", session.getCurrentSlideIndex(),
                                "totalSlides", (session.getSlides() != null && session.getSlides().getAddedSlides() != null) ? session.getSlides().getAddedSlides().size() : 0)));
            } catch (IOException e) {
                System.err.println("Error sending initial slide to " + username + " for session " + sessionId + ": " + e.getMessage());
            }
        } else {
            try {
                emitter.send(SseEmitter.event().name("session_event_learner").id(UUID.randomUUID().toString())
                        .data(Map.of("type", "SESSION_STATUS", "status", session.getSessionStatus(), "message", "Waiting for session.")));
            } catch (IOException e) {
                System.err.println("Error sending waiting status to " + username + " for session " + sessionId + ": " + e.getMessage());
            }
        }

        Runnable studentEmitterCleanup = () -> {
            boolean removed = session.getStudentEmitters().remove(emitter);
            if (removed) {
                System.out.println("Student emitter for " + username + " in session " + sessionId + " removed. Remaining: " + session.getStudentEmitters().size());
            } else {
                System.out.println("Student emitter for " + username + " in session " + sessionId + " already removed or not found for cleanup.");
            }
            // Participant status to INACTIVE is handled by checkInactiveParticipants if no new heartbeat/connection.
        };

        emitter.onCompletion(studentEmitterCleanup);
        emitter.onTimeout(studentEmitterCleanup::run); // .run() is important if it's not a simple no-arg void method
        emitter.onError(e -> {
            System.err.println("Student emitter error for " + username + " in session " + sessionId + ": " + e.getMessage());
            studentEmitterCleanup.run();
        });
    }

    private void updateParticipantStatus(LiveSessionDto session, String username, String status) {
        session.getParticipants().stream()
                .filter(p -> p.getUsername().equals(username))
                .findFirst()
                .ifPresent(participant -> {
                    String oldStatus = participant.getStatus();
                    participant.setStatus(status);
                    if ("ACTIVE".equals(status) && participant.getJoinedAt() == null) {
                        participant.setJoinedAt(new Date());
                    }
                    if (!Objects.equals(oldStatus, status)) {
                        System.out.println("Participant " + username + " status changed from " + oldStatus + " to " + status + " in session " + session.getSessionId());
                        notifyTeacherAboutParticipants(session);
                    }
                });
    }

    public void updateQuizStats(String sessionId, String answer) {
        LiveSessionDto session = sessions.get(sessionId);
        if (session != null) {
            sendStatsToTeacher(session);
        } else {
            throw new VacademyException("Session not found");
        }
    }

    private String generateInviteCode() {
        String chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        Random random = new Random();
        String code;
        do {
            StringBuilder sb = new StringBuilder(6);
            for (int i = 0; i < 6; i++) {
                sb.append(chars.charAt(random.nextInt(chars.length())));
            }
            code = sb.toString();
        } while (inviteCodeToSessionId.containsKey(code));
        return code;
    }

    public LiveSessionDto getDetailsSession(String inviteCode, ParticipantDto participantDto) {
        if (!StringUtils.hasText(inviteCode) || participantDto == null || !StringUtils.hasText(participantDto.getUsername())) {
            throw new VacademyException("Invalid invite code or participant details.");
        }
        String sessionId = inviteCodeToSessionId.get(inviteCode);
        if (sessionId == null) {
            throw new VacademyException("Invalid invite code: " + inviteCode);
        }
        LiveSessionDto session = sessions.get(sessionId);
        if (session == null) {
            inviteCodeToSessionId.remove(inviteCode);
            throw new VacademyException("Session not found for invite code: " + inviteCode);
        }
        if ("FINISHED".equals(session.getSessionStatus())) {
            throw new VacademyException("Session has already finished.");
        }

        Optional<ParticipantDto> existingParticipantOpt = session.getParticipants().stream()
                .filter(p -> p.getUsername().equals(participantDto.getUsername()))
                .findFirst();

        if (existingParticipantOpt.isPresent()) {
            ParticipantDto existingParticipant = existingParticipantOpt.get();
            System.out.println("Participant " + participantDto.getUsername() + " rejoining session " + sessionId + ". Old status: " + existingParticipant.getStatus());
            existingParticipant.setStatus("INIT"); // Will become ACTIVE on SSE stream
        } else {
            if (!session.getCanJoinInBetween() && "LIVE".equals(session.getSessionStatus())) {
                throw new VacademyException("Session is live and does not allow new participants.");
            }
            participantDto.setStatus("INIT");
            participantDto.setJoinedAt(new Date()); // Set initial join time
            session.getParticipants().add(participantDto);
            System.out.println("New participant " + participantDto.getUsername() + " added to session " + sessionId);
        }
        notifyTeacherAboutParticipants(session); // Notify teacher about new/rejoining participant
        return session;
    }

    private void notifyTeacherAboutParticipants(LiveSessionDto session) {
        if (session.getTeacherEmitter() != null) {
            try {
                SseEmitter.SseEventBuilder event = SseEmitter.event()
                        .name("participants")
                        .id(UUID.randomUUID().toString())
                        .data(session.getParticipants()); // Send the whole list
                session.getTeacherEmitter().send(event);
            } catch (Exception e) { // Catch broadly as teacher emitter can also be stale
                System.err.println("Error notifying teacher about participants for session " + session.getSessionId() + ": " + e.getMessage());
                // Consider completing the teacher emitter if send fails consistently
                // session.getTeacherEmitter().completeWithError(e); // This triggers its onError
                // clearPresenterEmitter(session.getSessionId()); // Or just clear it
            }
        }
    }

    public void clearPresenterEmitter(String sessionId) {
        LiveSessionDto session = sessions.get(sessionId);
        if (session != null) {
            SseEmitter emitter = session.getTeacherEmitter();
            if (emitter != null) {
                try {
                    emitter.complete(); // Attempt to gracefully complete
                } catch (Exception e) {
                    System.err.println("Exception completing presenter emitter during clear for session " + sessionId + ": " + e.getMessage());
                }
                session.setTeacherEmitter(null);
                System.out.println("Presenter emitter explicitly cleared for session: " + sessionId);
            }
        }
    }


    public void setPresenterEmitter(String sessionId, SseEmitter emitter, boolean sendInitialState) {
        LiveSessionDto session = sessions.get(sessionId);
        if (session == null) {
            emitter.completeWithError(new VacademyException("Session not found (ID: " + sessionId + ") for presenter."));
            return;
        }

        SseEmitter oldEmitter = session.getTeacherEmitter();
        if (oldEmitter != null && oldEmitter != emitter) {
            try {
                oldEmitter.complete();
                System.out.println("Old presenter emitter completed for session " + sessionId);
            } catch (Exception e) {
                System.err.println("Error completing old presenter emitter for session " + sessionId + ": " + e.getMessage());
            }
        }
        session.setTeacherEmitter(emitter);
        System.out.println("Presenter emitter set for session: " + sessionId);

        emitter.onCompletion(() -> {
            System.out.println("Presenter emitter completed for session: " + sessionId);
            if (session.getTeacherEmitter() == emitter) { // Avoid clearing if a new one was set quickly
                clearPresenterEmitter(sessionId); // Use the method that nullifies
            }
        });
        emitter.onTimeout(() -> {
            System.out.println("Presenter emitter timed out for session: " + sessionId);
            if (session.getTeacherEmitter() == emitter) {
                clearPresenterEmitter(sessionId);
            }
        });
        emitter.onError(e -> {
            System.err.println("Presenter emitter error for session " + sessionId + ": " + e.getMessage());
            if (session.getTeacherEmitter() == emitter) {
                clearPresenterEmitter(sessionId);
            }
        });

        if (sendInitialState) {
            notifyTeacherAboutParticipants(session);
            Map<String, Object> stateData = new HashMap<>();
            stateData.put("sessionStatus", session.getSessionStatus());
            stateData.put("currentSlideIndex", session.getCurrentSlideIndex());
            stateData.put("totalSlides", (session.getSlides() != null && session.getSlides().getAddedSlides() != null) ? session.getSlides().getAddedSlides().size() : 0);
            // Add other relevant state...
            try {
                emitter.send(SseEmitter.event().name("session_state_presenter").id(UUID.randomUUID().toString()).data(stateData));
            } catch (IOException e) {
                System.err.println("Error sending initial state to presenter for session " + sessionId + ": " + e.getMessage());
            }
        }
    }

    private AddPresentationDto getLinkedPresentation(CreateSessionDto presentation) {
        if ("PRESENTATION".equals(presentation.getSource())) {
            // Ensure presentationCrudManager.getPresentation().getBody() does not return null if not found
            // or handle null appropriately
            ResponseEntity<AddPresentationDto> response = presentationCrudManager.getPresentation(presentation.getSourceId());
            return (response != null) ? response.getBody() : null;
        }
        return null;
    }

    public LiveSessionDto startSession(StartPresentationDto startPresentationDto) {
        if (!StringUtils.hasText(startPresentationDto.getSessionId())) {
            throw new VacademyException("Invalid session ID");
        }
        LiveSessionDto session = sessions.get(startPresentationDto.getSessionId());
        if (session == null) throw new VacademyException("Session not found");
        if ("LIVE".equals(session.getSessionStatus())) throw new VacademyException("Session is already live");

        session.setSessionStatus("LIVE");
        session.setCurrentSlideIndex(0); // Start from the first slide
        session.setStartTime(new Date(System.currentTimeMillis()));
        sendSlideToStudents(session); // Notify students about the first slide
        notifyTeacherAboutParticipants(session); // Update teacher
        return session;
    }

    public LiveSessionDto moveTo(StartPresentationDto startPresentationDto) {
        if (!StringUtils.hasText(startPresentationDto.getSessionId())) {
            throw new VacademyException("Invalid session ID");
        }
        LiveSessionDto session = sessions.get(startPresentationDto.getSessionId());
        if (session == null) {
            throw new VacademyException("Error Moving Session: Session not found");
        }
        if (!"LIVE".equals(session.getSessionStatus())) {
            throw new VacademyException("Error Moving Session: Session is not live");
        }
        // Add validation for moveTo index if necessary (e.g., within bounds of available slides)
        session.setCurrentSlideIndex(startPresentationDto.getMoveTo());
        sendSlideToStudents(session);
        // Optionally, notify teacher about the move as well if they need specific confirmation
        // notifyTeacherAboutSlideChange(session);
        return session;
    }

    public LiveSessionDto finishSession(StartPresentationDto startPresentationDto) {
        LiveSessionDto session = sessions.get(startPresentationDto.getSessionId());
        if (session == null) throw new VacademyException("Error Finishing Session: Session not found");
        if ("FINISHED".equals(session.getSessionStatus())) {
            System.out.println("Session " + session.getSessionId() + " is already finished.");
            return session;
        }

        session.setSessionStatus("FINISHED");
        session.setEndTime(new Date());
        Map<String, Object> endEventData = Map.of("type", "SESSION_STATUS", "status", "ENDED", "message", "Session has ended.");

        if (session.getStudentEmitters() != null) {
            session.getStudentEmitters().forEach(emitter -> {
                try {
                    emitter.send(SseEmitter.event().name("session_event_learner").id(UUID.randomUUID().toString()).data(endEventData));
                    emitter.complete();
                } catch (Exception e) { /* ignore, emitter might be dead */ }
            });
            session.getStudentEmitters().clear();
        }

        if (session.getTeacherEmitter() != null) {
            try {
                session.getTeacherEmitter().send(SseEmitter.event().name("session_state_presenter").id(UUID.randomUUID().toString()).data(Map.of("sessionStatus", "FINISHED")));
                session.getTeacherEmitter().complete();
            } catch (Exception e) { /* ignore */ }
            session.setTeacherEmitter(null);
        }

        sessionParticipantHeartbeats.remove(session.getSessionId());
        System.out.println("Session " + session.getSessionId() + " finished.");
        // Session itself is removed by cleanupExpiredSessions later or can be removed here if desired
        return session;
    }

    public void cleanupExpiredSessions() {
        long currentTime = System.currentTimeMillis();
        sessions.entrySet().removeIf(entry -> {
            LiveSessionDto session = entry.getValue();
            boolean expired = session.getCreationTime().getTime() + SESSION_EXPIRY_MS < currentTime || "FINISHED".equals(session.getSessionStatus());
            // For finished sessions, we might want a shorter expiry or immediate cleanup after some grace period.
            // For simplicity, let's say finished sessions are also subject to SESSION_EXPIRY_MS from creation,
            // or you could add specific logic for faster cleanup of FINISHED sessions.
            // Example: finished and older than 1 hour:
            // boolean finishedAndOld = "FINISHED".equals(session.getSessionStatus()) && session.getEndTime().getTime() + (60*60*1000) < currentTime;
            // expired = expired || finishedAndOld;


            if (expired) {
                System.out.println("Cleaning up session: " + entry.getKey() + (("FINISHED".equals(session.getSessionStatus())) ? " (already finished)" : " (expired)"));
                if (session.getStudentEmitters() != null) {
                    session.getStudentEmitters().forEach(emitter -> { try { emitter.complete(); } catch (Exception e) {/*ignore*/} });
                    session.getStudentEmitters().clear();
                }
                if (session.getTeacherEmitter() != null) {
                    try { session.getTeacherEmitter().complete(); } catch (Exception e) {/*ignore*/}
                    session.setTeacherEmitter(null);
                }
                inviteCodeToSessionId.remove(session.getInviteCode());
                sessionParticipantHeartbeats.remove(session.getSessionId());
                return true; // Remove from sessions map
            }
            return false;
        });
    }

    private void sendStatsToTeacher(LiveSessionDto session) {
        if (session.getTeacherEmitter() != null) {
            try {
                List<ParticipantDto> participantInfo = session.getParticipants().stream()
                        .map(p -> new ParticipantDto(p.getUsername(), p.getStatus())) // Or more detailed stats
                        .collect(Collectors.toList());
                SseEmitter.SseEventBuilder event = SseEmitter.event()
                        .name("quiz_stats_update")
                        .id(UUID.randomUUID().toString())
                        .data(participantInfo);
                session.getTeacherEmitter().send(event);
            } catch (Exception e) { // Catch broadly
                System.err.println("Error sending quiz stats to teacher for session " + session.getSessionId() + ": " + e.getMessage());
                // Potentially clear a consistently failing teacher emitter
                // clearPresenterEmitter(session.getSessionId());
            }
        }
    }
    public void recordParticipantResponse(String sessionId, String slideId, MarkResponseRequestDto responseRequest) {
        LiveSessionDto session = sessions.get(sessionId);
        if (session == null) {
            throw new VacademyException("Session not found: " + sessionId);
        }
        if (!"LIVE".equals(session.getSessionStatus())) {
            throw new VacademyException("Session is not live. Cannot record response.");
        }
        if (session.getSlides() == null || session.getSlides().getAddedSlides() == null ||
                session.getSlides().getAddedSlides().stream().noneMatch(s -> s.getId().equals(slideId))) {
            throw new VacademyException("Invalid slide ID: " + slideId + " for this session.");
        }

        ParticipantResponseDto participantResponse = new ParticipantResponseDto(
                responseRequest.getUsername(),
                responseRequest.getTimeToResponseMillis(),
                System.currentTimeMillis(),
                new SubmittedResponseDataDto(
                        responseRequest.getResponseType(),
                        responseRequest.getSelectedOptionIds(),
                        responseRequest.getTextAnswer()
                )
        );

        session.getSlideStatsJson().compute(slideId, (sId, currentJson) -> {
            SlideResponsesLogDto slideLog;
            if (currentJson == null) {
                slideLog = new SlideResponsesLogDto();
            } else {
                try {
                    slideLog = objectMapper.readValue(currentJson, SlideResponsesLogDto.class);
                } catch (JsonProcessingException e) {
                    System.err.println("Error deserializing slide stats for slide " + sId + ": " + e.getMessage());
                    slideLog = new SlideResponsesLogDto(); // Start fresh if corruption
                }
            }
            // Optional: Prevent duplicate responses or allow updates based on studentAttempts
            // For now, we add all responses.
            slideLog.getResponses().add(participantResponse);
            try {
                return objectMapper.writeValueAsString(slideLog);
            } catch (JsonProcessingException e) {
                System.err.println("Error serializing slide stats for slide " + sId + ": " + e.getMessage());
                return currentJson; // Fallback to old value on error
            }
        });

        System.out.println("Response recorded for user " + responseRequest.getUsername() + " for slide " + slideId + " in session " + sessionId);
        scheduleTeacherResponseUpdateNotification(sessionId, slideId);
    }


    public List<AdminSlideResponseViewDto> getSlideResponses(String sessionId, String slideId) {
        LiveSessionDto session = sessions.get(sessionId);
        if (session == null) {
            throw new VacademyException("Session not found: " + sessionId);
        }
        if (session.getSlides() == null || session.getSlides().getAddedSlides() == null) {
            throw new VacademyException("No slides found in session " + sessionId);
        }

        PresentationSlideDto currentSlide = session.getSlides().getAddedSlides().stream()
                .filter(s -> s.getId().equals(slideId))
                .findFirst()
                .orElseThrow(() -> new VacademyException("Slide not found: " + slideId + " in session " + sessionId));

        String responsesJson = session.getSlideStatsJson().get(slideId);
        if (responsesJson == null) {
            return Collections.emptyList();
        }

        SlideResponsesLogDto slideLog;
        try {
            slideLog = objectMapper.readValue(responsesJson, SlideResponsesLogDto.class);
        } catch (JsonProcessingException e) {
            System.err.println("Error deserializing slide responses for admin view: " + e.getMessage());
            throw new VacademyException("Could not retrieve responses due to data error.");
        }

        List<AdminSlideResponseViewDto> adminViews = new ArrayList<>();
        for (ParticipantResponseDto pResponse : slideLog.getResponses()) {
            Boolean isCorrect = evaluateResponse(pResponse, currentSlide.getAddedQuestion());
            adminViews.add(new AdminSlideResponseViewDto(
                    pResponse.getUsername(),
                    pResponse.getTimeToResponseMillis(),
                    pResponse.getSubmittedAt(),
                    pResponse.getResponseData(),
                    isCorrect
            ));
        }

        // Sort: Correct answers first, then by timeToResponseMillis
        adminViews.sort(Comparator
                .comparing((AdminSlideResponseViewDto r) -> r.getIsCorrect() == null ? 2 : (r.getIsCorrect() ? 0 : 1)) // nulls last, then true, then false
                .thenComparing(AdminSlideResponseViewDto::getTimeToResponseMillis, Comparator.nullsLast(Long::compareTo))
        );

        return adminViews;
    }
    private Boolean evaluateResponse(ParticipantResponseDto participantResponse, QuestionDTO question) {
        if (question == null || !StringUtils.hasText(question.getAutoEvaluationJson())) {
            return null; // Cannot evaluate
        }

        AutoEvaluationDto autoEval;
        try {
            autoEval = objectMapper.readValue(question.getAutoEvaluationJson(), AutoEvaluationDto.class);
        } catch (JsonProcessingException e) {
            System.err.println("Error parsing autoEvaluationJson: " + e.getMessage());
            return null; // Cannot parse evaluation criteria
        }

        if (autoEval.getData() == null) return null;

        String questionType = autoEval.getType() != null ? autoEval.getType().toUpperCase() : "";
        String participantResponseType = participantResponse.getResponseData().getType() != null ? participantResponse.getResponseData().getType().toUpperCase() : "";

        // Ensure response type matches question type from auto-evaluation.
        // The participantResponse.responseData.type should ideally come from the question definition client-side.
        // If autoEval.type is the source of truth for question type:
        if (!questionType.equals(participantResponseType)) {
            System.err.println("Mismatch between question type in auto-eval ("+questionType+") and response type ("+participantResponseType+") for user " + participantResponse.getUsername());
            // Consider how to handle this: for now, let's proceed if participantResponseType is one we know.
        }


        switch (participantResponseType) { // Using participant's declared response type
            case "MCQS":
            case "MCQM":
                List<String> correctOptionIds = autoEval.getData().getCorrectOptionIds();
                List<String> submittedOptionIds = participantResponse.getResponseData().getSelectedOptionIds();
                if (correctOptionIds == null || submittedOptionIds == null) return null;
                if (correctOptionIds.size() != submittedOptionIds.size()) return null;
                return new HashSet<>(correctOptionIds).equals(new HashSet<>(submittedOptionIds));
            case "ONE_WORD":
            case "NUMERIC":
                String correctAnswerText = autoEval.getData().getAnswer();
                String submittedAnswerText = participantResponse.getResponseData().getTextAnswer();
                if (correctAnswerText == null || submittedAnswerText == null) return null;
                // Simple comparison: case-insensitive and trimmed
                return correctAnswerText.trim().equalsIgnoreCase(submittedAnswerText.trim());
            case "LONG_ANSWER":
                // Typically not auto-evaluated, or needs more complex logic
                return null; // Or false if we decide non-auto-evaluable are "incorrect" by default
            default:
                return null; // Unknown type
        }
    }

    public LiveSessionDto getUpdatedSession(String sessionId) {
        if (sessionId == null) {
            throw new VacademyException("Invalid session code: " + sessionId);
        }
        LiveSessionDto session = sessions.get(sessionId);
        if (session == null) {
            throw new VacademyException("Session not found for session code: " + sessionId);
        }
        if ("FINISHED".equals(session.getSessionStatus())) {
            throw new VacademyException("Session has already finished.");
        }

        return session;

    }

    @Transactional
    public LiveSessionDto addSlideInLiveSession(PresentationSlideDto presentationSlideDto, String sessionId, Integer afterSlideOrder) {
        if (sessionId == null) {
            throw new VacademyException("Invalid session code: " + sessionId);
        }
        LiveSessionDto session = sessions.get(sessionId);
        PresentationSlideDto newSlide = presentationCrudManager.addSlideAfterIndex(presentationSlideDto.getPresentationId(), afterSlideOrder, presentationSlideDto).getBody();
        session.setSlides(presentationCrudManager.getPresentation(presentationSlideDto.getPresentationId()).getBody());
        sendUpdateSlideAnnouncementToStudents(session);
        return session;
    }

    private void sendUpdateSlideAnnouncementToStudents(LiveSessionDto session) {
        if (!"LIVE".equals(session.getSessionStatus()) || session.getCurrentSlideIndex() == null || session.getStudentEmitters() == null) {
            return;
        }

        // Iterate over student emitters. CopyOnWriteArrayList handles concurrent modification safely for iteration.
        // If not using CopyOnWriteArrayList, new ArrayList<>(session.getStudentEmitters()) creates a snapshot.
        for (SseEmitter emitter : session.getStudentEmitters()) {
            try {
                SseEmitter.SseEventBuilder event = SseEmitter.event()
                        .name("update_slides")
                        .id(UUID.randomUUID().toString())
                        .data(Map.of(
                                "lastUpdated", DateUtil.getCurrentUtcTime()
                        ));
                emitter.send(event);
            } catch (IllegalStateException e) {
                // This often means the emitter was already completed (client disconnected, timed out, etc.)
                System.err.println("Error sending UpdateSlideAnnouncement to a student emitter (already completed) for session " +
                        session.getSessionId() + ": " + e.getMessage() + ". Emitter: " + emitter.toString());
                // The emitter's own onError, onCompletion, or onTimeout handlers (set in addStudentEmitter)
                // are responsible for cleaning it up from the session.getStudentEmitters() list.
            } catch (IOException e) {
                // For other network-related send issues
                System.err.println("IOException sending UpdateSlideAnnouncement to a student emitter for session " +
                        session.getSessionId() + ": " + e.getMessage() + ". Emitter: " + emitter.toString());
                // Spring's SseEmitter usually triggers onError for IOException during send,
                // which should then call your studentEmitterCleanup.
            } catch (Exception e) {
                // Catch any other unexpected exceptions during send
                System.err.println("Unexpected error sending UpdateSlideAnnouncement to a student emitter for session " +
                        session.getSessionId() + ": " + e.getClass().getName() + " - " + e.getMessage() + ". Emitter: " + emitter.toString());
            }
        }
    }
}