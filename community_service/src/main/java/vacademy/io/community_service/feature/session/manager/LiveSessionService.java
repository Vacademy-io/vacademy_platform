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
import vacademy.io.community_service.feature.presentation.dto.question.OptionDTO;
import vacademy.io.community_service.feature.presentation.dto.question.PresentationSlideDto;
import vacademy.io.community_service.feature.presentation.dto.question.QuestionDTO;
import vacademy.io.community_service.feature.presentation.manager.PresentationCrudManager;
import vacademy.io.community_service.feature.session.dto.admin.*;
import vacademy.io.community_service.feature.session.dto.participant.MarkResponseRequestDto;
import vacademy.io.community_service.feature.session.dto.participant.ParticipantResponseDto;
import vacademy.io.community_service.feature.session.dto.participant.SlideResponsesLogDto;
import vacademy.io.community_service.feature.session.dto.participant.SubmittedResponseDataDto;
import vacademy.io.community_service.feature.session.util.JsonUtils;

import java.io.IOException;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList; // Recommended for studentEmitters
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class LiveSessionService {
    private static final long SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
    private static final long HEARTBEAT_TIMEOUT_MS = 60000; // 60 seconds
    private static final long TEACHER_RESPONSE_UPDATE_DEBOUNCE_MS = 10000; // 10 seconds
    private final Map<String, LiveSessionDto> sessions = new ConcurrentHashMap<>();
    private final Map<String, String> inviteCodeToSessionId = new ConcurrentHashMap<>();
    private final Map<String, Map<String, Long>> sessionParticipantHeartbeats = new ConcurrentHashMap<>();
    private final ScheduledExecutorService heartbeatMonitor = Executors.newSingleThreadScheduledExecutor();
    private final ScheduledExecutorService sessionCleanupScheduler = Executors.newSingleThreadScheduledExecutor();

    private final ScheduledExecutorService teacherResponseUpdateNotifier = Executors.newSingleThreadScheduledExecutor();
    private final Map<String, Map<String, Long>> pendingTeacherNotifications = new ConcurrentHashMap<>(); // sessionId -> slideId -> lastUpdateTime

    @Autowired
    PresentationCrudManager presentationCrudManager;

    @Autowired
    NotificationService notificationService;

    @Autowired
    DeepSeekApiService deepSeekApiService;


    public LiveSessionService() {
        heartbeatMonitor.scheduleAtFixedRate(this::checkInactiveParticipants, 0, 15, TimeUnit.SECONDS);
        sessionCleanupScheduler.scheduleAtFixedRate(this::cleanupExpiredSessions, 0, 1, TimeUnit.HOURS);
        teacherResponseUpdateNotifier.scheduleAtFixedRate(this::processPendingTeacherNotifications, TEACHER_RESPONSE_UPDATE_DEBOUNCE_MS, // Initial delay
                TEACHER_RESPONSE_UPDATE_DEBOUNCE_MS, // Period
                TimeUnit.MILLISECONDS);
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
                        SseEmitter.SseEventBuilder event = SseEmitter.event().name("slide_response_updated").id(UUID.randomUUID().toString()).data(Map.of("session_id", sessionId, "slide_id", slideId, "last_updated_at", lastUpdateTime));
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
        pendingTeacherNotifications.computeIfAbsent(sessionId, k -> new ConcurrentHashMap<>()).put(slideId, System.currentTimeMillis());
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
        Map<String, Long> participantHeartbeats = sessionParticipantHeartbeats.computeIfAbsent(sessionId, k -> new ConcurrentHashMap<>());
        participantHeartbeats.put(username, System.currentTimeMillis());
        LiveSessionDto session = sessions.get(sessionId);
        if (session != null) {
            session.getParticipants().stream().filter(p -> p.getUsername().equals(username) && (p.getStatus() == null || "INACTIVE".equals(p.getStatus()))).findFirst().ifPresent(p -> updateParticipantStatus(session, username, "ACTIVE"));
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
        session.setIsSessionRecorded(createSessionDto.getIsSessionRecorded());
        session.setAllowChat(createSessionDto.getAllowChat());
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
                SseEmitter.SseEventBuilder event = SseEmitter.event().name("session_event_learner").id(UUID.randomUUID().toString()).data(Map.of("type", "CURRENT_SLIDE", "currentSlideIndex", session.getCurrentSlideIndex(), "totalSlides", (session.getSlides() != null && session.getSlides().getAddedSlides() != null) ? session.getSlides().getAddedSlides().size() : 0));
                emitter.send(event);
            } catch (IllegalStateException e) {
                // This often means the emitter was already completed (client disconnected, timed out, etc.)
                System.err.println("Error sending slide to a student emitter (already completed) for session " + session.getSessionId() + ": " + e.getMessage() + ". Emitter: " + emitter.toString());
                // The emitter's own onError, onCompletion, or onTimeout handlers (set in addStudentEmitter)
                // are responsible for cleaning it up from the session.getStudentEmitters() list.
            } catch (IOException e) {
                // For other network-related send issues
                System.err.println("IOException sending slide to a student emitter for session " + session.getSessionId() + ": " + e.getMessage() + ". Emitter: " + emitter.toString());
                // Spring's SseEmitter usually triggers onError for IOException during send,
                // which should then call your studentEmitterCleanup.
            } catch (Exception e) {
                // Catch any other unexpected exceptions during send
                System.err.println("Unexpected error sending slide to a student emitter for session " + session.getSessionId() + ": " + e.getClass().getName() + " - " + e.getMessage() + ". Emitter: " + emitter.toString());
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

        ParticipantDto participant = session.getParticipants().stream().filter(p -> p.getUsername().equals(username)).findFirst().orElse(null);

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
        sessionParticipantHeartbeats.computeIfAbsent(sessionId, k -> new ConcurrentHashMap<>()).put(username, System.currentTimeMillis());

        // Send current state
        if ("LIVE".equals(session.getSessionStatus()) && session.getCurrentSlideIndex() != null) {
            try {
                emitter.send(SseEmitter.event().name("session_event_learner").id(UUID.randomUUID().toString()).data(Map.of("type", "CURRENT_SLIDE", "currentSlideIndex", session.getCurrentSlideIndex(), "totalSlides", (session.getSlides() != null && session.getSlides().getAddedSlides() != null) ? session.getSlides().getAddedSlides().size() : 0)));
            } catch (IOException e) {
                System.err.println("Error sending initial slide to " + username + " for session " + sessionId + ": " + e.getMessage());
            }
        } else {
            try {
                emitter.send(SseEmitter.event().name("session_event_learner").id(UUID.randomUUID().toString()).data(Map.of("type", "SESSION_STATUS", "status", session.getSessionStatus(), "message", "Waiting for session.")));
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
        session.getParticipants().stream().filter(p -> p.getUsername().equals(username)).findFirst().ifPresent(participant -> {
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

        Optional<ParticipantDto> existingParticipantOpt = session.getParticipants().stream().filter(p -> p.getUsername().equals(participantDto.getUsername())).findFirst();

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
                SseEmitter.SseEventBuilder event = SseEmitter.event().name("participants").id(UUID.randomUUID().toString()).data(session.getParticipants()); // Send the whole list
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
                    session.getStudentEmitters().forEach(emitter -> {
                        try {
                            emitter.complete();
                        } catch (Exception e) {/*ignore*/}
                    });
                    session.getStudentEmitters().clear();
                }
                if (session.getTeacherEmitter() != null) {
                    try {
                        session.getTeacherEmitter().complete();
                    } catch (Exception e) {/*ignore*/}
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
                List<ParticipantDto> participantInfo = session.getParticipants().stream().map(p -> new ParticipantDto(p.getUsername(), p.getStatus())) // Or more detailed stats
                        .collect(Collectors.toList());
                SseEmitter.SseEventBuilder event = SseEmitter.event().name("quiz_stats_update").id(UUID.randomUUID().toString()).data(participantInfo);
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
        ObjectMapper objectMapper = new ObjectMapper();

        if (session == null) {
            throw new VacademyException("Session not found: " + sessionId);
        }
        if (!"LIVE".equals(session.getSessionStatus())) {
            throw new VacademyException("Session is not live. Cannot record response.");
        }
        if (session.getSlides() == null || session.getSlides().getAddedSlides() == null || session.getSlides().getAddedSlides().stream().noneMatch(s -> s.getId().equals(slideId))) {
            throw new VacademyException("Invalid slide ID: " + slideId + " for this session.");
        }

        ParticipantResponseDto participantResponse = new ParticipantResponseDto(responseRequest.getUsername(), responseRequest.getTimeToResponseMillis(), System.currentTimeMillis(), new SubmittedResponseDataDto(responseRequest.getResponseType(), responseRequest.getSelectedOptionIds(), responseRequest.getTextAnswer()));

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
        ObjectMapper objectMapper = new ObjectMapper();

        if (session == null) {
            throw new VacademyException("Session not found: " + sessionId);
        }
        if (session.getSlides() == null || session.getSlides().getAddedSlides() == null) {
            throw new VacademyException("No slides found in session " + sessionId);
        }

        PresentationSlideDto currentSlide = session.getSlides().getAddedSlides().stream().filter(s -> s.getId().equals(slideId)).findFirst().orElseThrow(() -> new VacademyException("Slide not found: " + slideId + " in session " + sessionId));

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
            adminViews.add(new AdminSlideResponseViewDto(pResponse.getUsername(), pResponse.getTimeToResponseMillis(), pResponse.getSubmittedAt(), pResponse.getResponseData(), isCorrect));
        }

        // Sort: Correct answers first, then by timeToResponseMillis
        adminViews.sort(Comparator.comparing((AdminSlideResponseViewDto r) -> r.getIsCorrect() == null ? 2 : (r.getIsCorrect() ? 0 : 1)) // nulls last, then true, then false
                .thenComparing(AdminSlideResponseViewDto::getTimeToResponseMillis, Comparator.nullsLast(Long::compareTo)));

        return adminViews;
    }

    private Boolean evaluateResponse(ParticipantResponseDto participantResponse, QuestionDTO question) {

        ObjectMapper objectMapper = new ObjectMapper();

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
            System.err.println("Mismatch between question type in auto-eval (" + questionType + ") and response type (" + participantResponseType + ") for user " + participantResponse.getUsername());
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
                SseEmitter.SseEventBuilder event = SseEmitter.event().name("update_slides").id(UUID.randomUUID().toString()).data(Map.of("lastUpdated", DateUtil.getCurrentUtcTime()));
                emitter.send(event);
            } catch (IllegalStateException e) {
                // This often means the emitter was already completed (client disconnected, timed out, etc.)
                System.err.println("Error sending UpdateSlideAnnouncement to a student emitter (already completed) for session " + session.getSessionId() + ": " + e.getMessage() + ". Emitter: " + emitter.toString());
                // The emitter's own onError, onCompletion, or onTimeout handlers (set in addStudentEmitter)
                // are responsible for cleaning it up from the session.getStudentEmitters() list.
            } catch (IOException e) {
                // For other network-related send issues
                System.err.println("IOException sending UpdateSlideAnnouncement to a student emitter for session " + session.getSessionId() + ": " + e.getMessage() + ". Emitter: " + emitter.toString());
                // Spring's SseEmitter usually triggers onError for IOException during send,
                // which should then call your studentEmitterCleanup.
            } catch (Exception e) {
                // Catch any other unexpected exceptions during send
                System.err.println("Unexpected error sending UpdateSlideAnnouncement to a student emitter for session " + session.getSessionId() + ": " + e.getClass().getName() + " - " + e.getMessage() + ". Emitter: " + emitter.toString());
            }
        }
    }

    public LiveSessionDto sendParticipantNotifications(NotifyPresentationRequestDto notifyPresentationRequestDto) {
        NotifyPresentationDto notifyPresentationDto = getNotifyPresentationRequestDto(notifyPresentationRequestDto);
        if (notifyPresentationDto == null || !StringUtils.hasText(notifyPresentationDto.getSessionId())) {
            throw new VacademyException("NotifyPresentationDto and SessionId cannot be null");
        }

        LiveSessionDto session = sessions.get(notifyPresentationDto.getSessionId());
        if (session == null) {
            throw new VacademyException("Session not found: " + notifyPresentationDto.getSessionId());
        }
        final Pattern EMAIL_PATTERN = Pattern.compile("^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,6}$", Pattern.CASE_INSENSITIVE);

        // Filter for participants who have an email address
        session.getParticipants().stream().filter(participant -> StringUtils.hasText(participant.getUsername()) && EMAIL_PATTERN.matcher(participant.getUsername()).matches()).forEach(participant -> {
            try {
                String userResponsesHtml = buildUserResponsesHtml(session, participant);
                String emailBody = buildHtmlEmailBody(session, notifyPresentationDto, participant, userResponsesHtml);
                String subject = "Summary of your session: " + session.getSlides().getTitle();

                // Create the request payload for the notification service
                EmailUserDto emailUser = new EmailUserDto(participant.getUserId(), participant.getUsername(), Collections.emptyMap());
                EmailRequestDto emailRequest = new EmailRequestDto(emailBody, "EMAIL", subject, "COMMUNITY_SERVICE_SESSION_SUMMARY", session.getSessionId(), Collections.singletonList(emailUser));

                // Send the email via the notification service
                notificationService.sendEmail(emailRequest);
            } catch (Exception e) {
                System.err.println("Failed to process and send email for participant " + participant.getUsername() + ". Error: " + e.getMessage());
                // Continue to the next participant
            }
        });

        return session;
    }

    private String buildUserResponsesHtml(LiveSessionDto session, ParticipantDto participant) {
        ObjectMapper objectMapper = new ObjectMapper();

        StringBuilder responsesBuilder = new StringBuilder();
        responsesBuilder.append("<h3>Your Responses</h3>");

        if (session.getSlideStatsJson() == null || session.getSlideStatsJson().isEmpty()) {
            responsesBuilder.append("<p>No responses were recorded for you in this session.</p>");
            return responsesBuilder.toString();
        }

        Map<String, String> userResponseMap = new HashMap<>();

        for (PresentationSlideDto slide : session.getSlides().getAddedSlides()) {
            if (slide.getAddedQuestion() == null) continue;

            String responsesJson = session.getSlideStatsJson().get(slide.getId());
            if (!StringUtils.hasText(responsesJson)) continue;

            try {
                SlideResponsesLogDto slideLog = objectMapper.readValue(responsesJson, SlideResponsesLogDto.class);

                // Find the last response by the user for this slide
                slideLog.getResponses().stream().filter(pResponse -> participant.getUsername().equals(pResponse.getUsername())).reduce((first, second) -> second) // get last element
                        .ifPresent(pResponse -> {
                            String questionTitle = slide.getTitle();
                            String answerText = "N/A";
                            String responseType = pResponse.getResponseData().getType();

                            if ("MCQS".equalsIgnoreCase(responseType) || "MCQM".equalsIgnoreCase(responseType)) {
                                List<String> selectedIds = pResponse.getResponseData().getSelectedOptionIds();
                                if (selectedIds != null && !selectedIds.isEmpty()) {
                                    Map<String, String> optionMap = slide.getAddedQuestion().getOptions().stream().collect(Collectors.toMap(OptionDTO::getId, o -> o.getText().getContent()));
                                    answerText = selectedIds.stream().map(id -> optionMap.getOrDefault(id, "Unknown Option")).collect(Collectors.joining(", "));
                                }
                            } else { // Handles ONE_WORD, NUMERIC, LONG_ANSWER
                                answerText = pResponse.getResponseData().getTextAnswer();
                            }

                            userResponseMap.put(questionTitle, answerText);
                        });

            } catch (JsonProcessingException e) {
                System.err.println("Could not parse responses for slide " + slide.getId() + " for user " + participant.getUsername() + ". Error: " + e.getMessage());
            }
        }

        if (userResponseMap.isEmpty()) {
            responsesBuilder.append("<p>No responses were recorded for you in this session.</p>");
        } else {
            responsesBuilder.append("<ul style='padding-left: 20px; list-style-type: none;'>");
            userResponseMap.forEach((question, answer) -> {
                responsesBuilder.append(String.format("<li style='margin-bottom: 12px;'><strong>%s:</strong><br/>%s</li>", question, answer));
            });
            responsesBuilder.append("</ul>");
        }

        return responsesBuilder.toString();
    }

    private String buildHtmlEmailBody(LiveSessionDto session, NotifyPresentationDto notifyDto, ParticipantDto participant, String userResponsesHtml) {
        String presentationUrl = "https://engage.vacademy.io/presentation/public/" + session.getSlides().getId();
        String sessionTitle = session.getSlides().getTitle();
        String participantName = participant.getName() != null ? participant.getName() : "there";

        String adminCommentHtml = "";
        if (StringUtils.hasText(notifyDto.getAdminComment())) {
            adminCommentHtml = String.format("""
                    <h3 style="color: #2c3e50; font-size: 18px; margin-top: 20px;">A Note from the Host</h3>
                    <p style="color: #34495e; font-size: 16px; line-height: 1.6;">%s</p>
                    """, notifyDto.getAdminComment());
        }

        String summaryHtml = "";
        if (StringUtils.hasText(notifyDto.getHtmlSummary())) {
            summaryHtml = String.format("""
                    <h3 style="color: #2c3e50; font-size: 18px; margin-top: 20px;">Session Summary</h3>
                    <div style="color: #34495e; font-size: 16px; line-height: 1.6;">%s</div>
                    """, notifyDto.getHtmlSummary());
        }

        String actionPointsHtml = "";
        if (notifyDto.getHtmlActionPoints() != null && !notifyDto.getHtmlActionPoints().isEmpty()) {
            StringBuilder pointsBuilder = new StringBuilder();
            notifyDto.getHtmlActionPoints().forEach(point -> pointsBuilder.append(String.format("<li style=\"margin-bottom: 10px;\">%s</li>", point)));
            actionPointsHtml = String.format("""
                    <h3 style="color: #2c3e50; font-size: 18px; margin-top: 20px;">Action Points</h3>
                    <ul style="color: #34495e; font-size: 16px; line-height: 1.6; padding-left: 20px;">%s</ul>
                    """, pointsBuilder.toString());
        }

        String userResponsesContent = "";
        if (StringUtils.hasText(userResponsesHtml)) {
            userResponsesContent = String.format("""
                    <h3 style="color: #2c3e50; font-size: 18px; margin-top: 20px;">Your Responses</h3>
                    <div style="color: #34495e; font-size: 16px; line-height: 1.6;">%s</div>
                    """, userResponsesHtml);
        }

        return String.format("""
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Session Follow-up: %s</title>
                    <style>
                        @import url('https://fonts.googleapis.com/css2?family=Lato:wght@400;700&display=swap');
                        body {
                            margin: 0;
                            padding: 0;
                            background-color: #f4f4f4;
                            font-family: 'Lato', sans-serif;
                        }
                        .email-container {
                            max-width: 600px;
                            margin: 20px auto;
                            background-color: #ffffff;
                            border-radius: 8px;
                            overflow: hidden;
                            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
                        }
                        .header {
                            background-color: #2c3e50;
                            color: #ffffff;
                            padding: 40px;
                            text-align: center;
                        }
                        .header h1 {
                            margin: 0;
                            font-size: 24px;
                        }
                        .content {
                            padding: 30px 40px;
                        }
                        .content h3 {
                            color: #2c3e50;
                            font-size: 18px;
                            margin-top: 20px;
                        }
                        .content p, .content ul, .content div {
                            color: #34495e;
                            font-size: 16px;
                            line-height: 1.6;
                        }
                        .button-container {
                            text-align: center;
                            margin-top: 30px;
                        }
                        .button {
                            background-color: #3498db;
                            color: #ffffff;
                            padding: 15px 30px;
                            text-decoration: none;
                            border-radius: 5px;
                            font-weight: bold;
                            display: inline-block;
                        }
                        .footer {
                            background-color: #ecf0f1;
                            padding: 20px;
                            text-align: center;
                            font-size: 12px;
                            color: #7f8c8d;
                        }
                    </style>
                </head>
                <body>
                    <div class="email-container">
                        <div class="header">
                            <h1>Session Follow-up</h1>
                        </div>
                        <div class="content">
                            <p>Hi %s,</p>
                            <p>Thank you for attending the session: <strong>%s</strong>.</p>
                            %s
                            %s
                            %s
                            %s
                            <div class="button-container">
                                <a href="%s" class="button">View Full Presentation</a>
                            </div>
                        </div>
                        <div class="footer">
                            <p>&copy; %s Vcademy.io. All rights reserved.</p>
                        </div>
                    </div>
                </body>
                </html>
                """,
                sessionTitle,
                participantName,
                sessionTitle,
                adminCommentHtml,
                summaryHtml,
                actionPointsHtml,
                userResponsesContent,
                presentationUrl,
                java.time.Year.now()
        );
    }

    // Helper to keep the main builder method clean
    private String getEmailTemplatePrefix() {
        return "<!DOCTYPE html>...<div class=\"content\">"; // Paste the first part of your template here
    }

    private String getEmailTemplateSuffix() {
        return "</div><div class=\"footer\"><p>&copy; 2025 Volt by Vacademy</p></div></div></body></html>";
    }

    /**
     * Processes a session transcript using an AI service to generate a summary,
     * action points, and an admin comment.
     *
     * @param notifyPresentationRequestDto The request containing the transcript and sessionId.
     * @return A NotifyPresentationDto populated with AI-generated content.
     */
    private NotifyPresentationDto getNotifyPresentationRequestDto(NotifyPresentationRequestDto notifyPresentationRequestDto) {
        if (notifyPresentationRequestDto == null || !StringUtils.hasText(notifyPresentationRequestDto.getTranscript()) || notifyPresentationRequestDto.getSessionId() == null || notifyPresentationRequestDto.getSessionId().isEmpty()) {
            throw new VacademyException("Transcript cannot be empty for AI processing.");
        }

        // 1. Construct the prompt for the AI model
        String prompt = "You are an expert session summarizer. Based on the following session transcript, please generate a JSON object with three keys: 'htmlSummary', 'htmlActionPoints', and 'adminComment'.\n\n" + "1.  'htmlSummary': Provide a concise summary of the session's key topics and discussions. The summary must be formatted as a single HTML string, using <p> tags for paragraphs.\n" + "2.  'htmlActionPoints': Identify the main action items or key takeaways from the session. Format this as a JSON array of strings, where each string is an action point.\n" + "3.  'adminComment': Write a brief, friendly, and encouraging comment from the session host to the participants. This should be a single string of plain text.\n\n" + "Your entire output must be a single, valid JSON object and nothing else. Do not include explanations or markdown formatting like ```json.\n\n" + "Here is the transcript:\n" + "---\n" + notifyPresentationRequestDto.getTranscript() + "\n" + "---\n\n" + "JSON Output:";

        // 2. Call the DeepSeek API
        // Model: "deepseek/chat", maxTokens can be adjusted as needed.
        DeepSeekResponse aiResponse = deepSeekApiService.getChatCompletion("google/gemini-2.5-flash-preview-05-20", prompt, 10024);

        if (aiResponse == null || aiResponse.getChoices() == null || aiResponse.getChoices().isEmpty() || !StringUtils.hasText(aiResponse.getChoices().get(0).getMessage().getContent())) {
            throw new RuntimeException("Failed to get a valid response from the AI service.");
        }

        String jsonContent = aiResponse.getChoices().get(0).getMessage().getContent().trim();
        jsonContent = JsonUtils.extractAndSanitizeJson(jsonContent);
        ObjectMapper objectMapper = new ObjectMapper();


        try {
            // 3. Parse the JSON content into our DTO
            AiGeneratedContentDto parsedContent = objectMapper.readValue(jsonContent, AiGeneratedContentDto.class);

            // 4. Create and return the final DTO for the email logic
            NotifyPresentationDto finalDto = new NotifyPresentationDto();
            finalDto.setSessionId(notifyPresentationRequestDto.getSessionId());
            finalDto.setHtmlSummary(parsedContent.getHtmlSummary());
            finalDto.setHtmlActionPoints(parsedContent.getHtmlActionPoints());
            finalDto.setAdminComment(parsedContent.getAdminComment());

            return finalDto;

        } catch (Exception e) {
            System.err.println("Failed to parse JSON response from AI. Raw content was: " + jsonContent);
            throw new RuntimeException("Failed to parse AI response content. See server logs for details.", e);
        }
    }

}