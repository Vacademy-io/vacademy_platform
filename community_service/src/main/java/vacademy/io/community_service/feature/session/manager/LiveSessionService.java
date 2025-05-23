package vacademy.io.community_service.feature.session.manager;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.community_service.feature.presentation.dto.question.AddPresentationDto;
import vacademy.io.community_service.feature.presentation.dto.question.PresentationSlideDto;
import vacademy.io.community_service.feature.presentation.manager.PresentationCrudManager;
import vacademy.io.community_service.feature.session.dto.admin.CreateSessionDto;
import vacademy.io.community_service.feature.session.dto.admin.LiveSessionDto;
import vacademy.io.community_service.feature.session.dto.admin.ParticipantDto;
import vacademy.io.community_service.feature.session.dto.admin.StartPresentationDto;

import java.io.IOException;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors; // Added for better stream usage

@Service
public class LiveSessionService {
    private static final long SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
    private static final long HEARTBEAT_TIMEOUT_MS = 60000; // 60 seconds

    // In-memory map for LiveSessionDto - SINGLE INSTANCE ONLY
    private final Map<String, LiveSessionDto> sessions = new ConcurrentHashMap<>();
    private final Map<String, String> inviteCodeToSessionId = new ConcurrentHashMap<>();

    // Heartbeat tracking remains the same
    private final Map<String, Map<String, Long>> sessionParticipantHeartbeats = new ConcurrentHashMap<>();
    private final ScheduledExecutorService heartbeatMonitor = Executors.newSingleThreadScheduledExecutor();
    private final ScheduledExecutorService sessionCleanupScheduler = Executors.newSingleThreadScheduledExecutor();

    @Autowired
    PresentationCrudManager presentationCrudManager;

    public LiveSessionService() {
        // Schedule periodic check for inactive participants
        heartbeatMonitor.scheduleAtFixedRate(
                this::checkInactiveParticipants,
                0,
                15,
                TimeUnit.SECONDS
        );
        // Schedule periodic cleanup for expired sessions
        sessionCleanupScheduler.scheduleAtFixedRate(
                this::cleanupExpiredSessions,
                0,
                1, // Run every hour
                TimeUnit.HOURS
        );
    }

    /**
     * Check for participants who haven't sent heartbeats recently and mark them inactive
     */
    private void checkInactiveParticipants() {
        long currentTime = System.currentTimeMillis();

        sessionParticipantHeartbeats.forEach((sessionId, participants) -> {
            LiveSessionDto session = sessions.get(sessionId);
            if (session == null) {
                // Clean up if session no longer exists in main map
                sessionParticipantHeartbeats.remove(sessionId);
                return;
            }

            List<String> inactiveUsers = new ArrayList<>();
            participants.forEach((username, lastHeartbeat) -> {
                if (currentTime - lastHeartbeat > HEARTBEAT_TIMEOUT_MS) {
                    inactiveUsers.add(username);
                }
            });

            // Update status and notify teacher
            if (!inactiveUsers.isEmpty()) {
                inactiveUsers.forEach(username -> updateParticipantStatus(session, username, "INACTIVE"));
                // Remove inactive participants from the heartbeat map
                inactiveUsers.forEach(participants::remove);
            }
        });
    }

    /**
     * Record a heartbeat from a participant
     */
    public void recordHeartbeat(String sessionId, String username) {
        // Get or create the heartbeat map for this session
        Map<String, Long> participantHeartbeats = sessionParticipantHeartbeats
                .computeIfAbsent(sessionId, k -> new ConcurrentHashMap<>());

        // Update the timestamp for this participant
        participantHeartbeats.put(username, System.currentTimeMillis());

        // If participant was previously inactive, mark as active
        LiveSessionDto session = sessions.get(sessionId);
        if (session != null) {
            session.getParticipants().stream()
                    .filter(p -> p.getUsername().equals(username) &&
                            (p.getStatus() == null || p.getStatus().equals("INACTIVE")))
                    .findFirst()
                    .ifPresent(p -> updateParticipantStatus(session, username, "ACTIVE"));
        }
    }


    public LiveSessionDto createSession(CreateSessionDto createSessionDto) {
        LiveSessionDto session = new LiveSessionDto();
        session.setSessionId(UUID.randomUUID().toString());
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

    private void sendSlideToStudents(LiveSessionDto session) {
        if (!"LIVE".equals(session.getSessionStatus()) || session.getCurrentSlideIndex() == null) return;

        new ArrayList<>(session.getStudentEmitters()).forEach(emitter -> {
            try {
                SseEmitter.SseEventBuilder event = SseEmitter.event()
                        .name("session_event_learner") // Consistent event name
                        .id(UUID.randomUUID().toString())
                        .data(Map.of(
                                "type", "CURRENT_SLIDE",
                                "currentSlideIndex", session.getCurrentSlideIndex(),
                                "totalSlides", (session.getSlides() != null && session.getSlides().getAddedSlides() != null) ? session.getSlides().getAddedSlides().size() : 0
                        ));
                emitter.send(event);
            } catch (IOException e) {
                // Emitter's onError callback (set in addStudentEmitter) will handle cleanup.
                // Log here if needed, but avoid duplicate completion calls.
                System.err.println("Error sending slide to a student emitter during broadcast for session " + session.getSessionId() + ": " + e.getMessage());
            }
        });
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
            // This implies /get-details was not called or participant was removed.
            // For robustness, if canJoinInBetween is true or session not live, could add them.
            // But safer to assume /get-details is prerequisite.
            emitter.completeWithError(new VacademyException("Participant " + username + " not registered in session " + sessionId + ". Please join first using invite code."));
            return;
        }

        // Simple way to handle potential old emitters for the same user:
        // Iterate and complete any other emitters that might be associated with this user if we had a mapping.
        // With current List<SseEmitter>, it's harder to pinpoint an old emitter for *this specific user*.
        // A Map<String (username), SseEmitter> in LiveSessionDto would be better.
        // For now, we add the new one. The old one, if any, should eventually timeout or error.

        session.getStudentEmitters().add(emitter);
        System.out.println("Student emitter added for " + username + " in session " + sessionId);

        // Mark participant ACTIVE and notify teacher
        updateParticipantStatus(session, username, "ACTIVE");

        // Initialize/update heartbeat tracking for this user
        sessionParticipantHeartbeats.computeIfAbsent(sessionId, k -> new ConcurrentHashMap<>())
                .put(username, System.currentTimeMillis());


        // Send current session/slide state to the connecting/reconnecting student
        if ("LIVE".equals(session.getSessionStatus()) && session.getCurrentSlideIndex() != null) {
            try {
                SseEmitter.SseEventBuilder event = SseEmitter.event()
                        .name("session_event_learner") // General event name
                        .id(UUID.randomUUID().toString())
                        .data(Map.of(
                                "type", "CURRENT_SLIDE",
                                "currentSlideIndex", session.getCurrentSlideIndex(),
                                "totalSlides", (session.getSlides() != null && session.getSlides().getAddedSlides() != null) ? session.getSlides().getAddedSlides().size() : 0
                        ));
                emitter.send(event);
            } catch (IOException e) {
                System.err.println("Error sending initial slide to " + username + " for session " + sessionId + ": " + e.getMessage());
                // Emitter's onError will handle full cleanup.
            }
        } else { // Session is INIT (waiting to start) or some other state
            try {
                SseEmitter.SseEventBuilder event = SseEmitter.event()
                        .name("session_event_learner")
                        .id(UUID.randomUUID().toString())
                        .data(Map.of("type", "SESSION_STATUS", "status", session.getSessionStatus(), "message", "Waiting for session to start or resume."));
                emitter.send(event);
            } catch (IOException e) {
                System.err.println("Error sending waiting status to " + username + " for session " + sessionId + ": " + e.getMessage());
            }
        }

        // Cleanup logic when this specific emitter completes/times out/errors
        Runnable studentEmitterCleanup = () -> {
            session.getStudentEmitters().remove(emitter);
            // Participant status is updated to INACTIVE by the heartbeat mechanism (checkInactiveParticipants)
            // if no new heartbeat or connection comes in.
            // For immediate feedback upon explicit disconnect/error, we can also update status here.
            // updateParticipantStatus(session, username, "INACTIVE"); // This will notify teacher.
            // Let's rely on recordHeartbeat and checkInactiveParticipants for definitive status,
            // but log the disconnection.
            System.out.println("Student emitter for " + username + " in session " + sessionId + " cleaned up (completed/timed out/errored).");
            // The checkInactiveParticipants will eventually mark them INACTIVE if no new heartbeat or connection.
        };

        emitter.onCompletion(studentEmitterCleanup);
        emitter.onTimeout(() -> { // Spring's SseEmitter calls complete() internally on timeout.
            studentEmitterCleanup.run();
        });
        emitter.onError(e -> {
            System.err.println("Student emitter error for " + username + " in session " + sessionId + ": " + e.getMessage());
            studentEmitterCleanup.run();
        });
    }
    /**
     * Updates a participant's active status and notifies the teacher of this change
     */
    // Ensure updateParticipantStatus handles the joinedAt timestamp correctly for "ACTIVE"
    private void updateParticipantStatus(LiveSessionDto session, String username, String status) {
        session.getParticipants().stream()
                .filter(p -> p.getUsername().equals(username))
                .findFirst()
                .ifPresent(participant -> {
                    String oldStatus = participant.getStatus();
                    participant.setStatus(status);

                    if ("ACTIVE".equals(status) && participant.getJoinedAt() == null) {
                        participant.setJoinedAt(new Date()); // Set joinedAt when first becoming active
                    }
                    // If rejoining and was INACTIVE, joinedAt might already be set. Policy: keep original or update?
                    // Current code only sets if null.

                    if (!Objects.equals(oldStatus, status)) {
                        System.out.println("Participant " + username + " status changed from " + oldStatus + " to " + status + " in session " + session.getSessionId());
                        notifyTeacherAboutParticipants(session);
                    }
                });
    }

    public void updateQuizStats(String sessionId, String answer) {
        LiveSessionDto session = sessions.get(sessionId);
        if (session != null) {
            // Logic to update quiz stats in session object
            // For now, just sending participants list as an example for teacher
            sendStatsToTeacher(session);
        } else {
            throw new VacademyException("Session not found");
        }
    }


    // Improved invite code generation for better uniqueness
    private String generateInviteCode() {
        String chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        Random random = new Random();
        String code;
        String sessionId;
        do {
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < 6; i++) { // Increased length to 6
                sb.append(chars.charAt(random.nextInt(chars.length())));
            }
            code = sb.toString();
            sessionId = inviteCodeToSessionId.get(code); // Check if code is already mapped
        } while (sessionId != null); // Keep generating until a unique code is found
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
            inviteCodeToSessionId.remove(inviteCode); // Clean up dangling invite code
            throw new VacademyException("Session not found for invite code: " + inviteCode);
        }

        if ("FINISHED".equals(session.getSessionStatus())) {
            throw new VacademyException("Session has already finished. Cannot join/rejoin.");
        }

        Optional<ParticipantDto> existingParticipantOpt = session.getParticipants().stream()
                .filter(p -> p.getUsername().equals(participantDto.getUsername()))
                .findFirst();

        if (existingParticipantOpt.isPresent()) {
            ParticipantDto existingParticipant = existingParticipantOpt.get();
            // If participant was INACTIVE or in some other non-ACTIVE state, allow rejoining by resetting.
            // If they are already ACTIVE, it might be a duplicate attempt or very quick reconnect where old emitter hasn't cleared.
            // For simplicity, we allow re-affirmation. The emitter setup will handle one active stream.
            System.out.println("Participant " + participantDto.getUsername() + " rejoining/affirming session " + sessionId + ". Old status: " + existingParticipant.getStatus());
            existingParticipant.setStatus("INIT"); // Will become ACTIVE on establishing SSE stream
            // existingParticipant.setJoinedAt(new Date()); // Optionally update joinedAt on rejoin, or keep original
        } else {
            // New participant joining
            if (!session.getCanJoinInBetween() && "LIVE".equals(session.getSessionStatus())) {
                throw new VacademyException("Session is live and does not allow new participants to join in between.");
            }
            participantDto.setStatus("INIT"); // New participants start as INIT
            participantDto.setJoinedAt(new Date());
            session.getParticipants().add(participantDto);
            System.out.println("New participant " + participantDto.getUsername() + " added to session " + sessionId);
        }
        // The LiveSessionDto returned will reflect the participant's presence (and INIT status).
        // We don't directly return participant DTO here, but the session DTO contains the list.
        return session;
    }
    private void notifyTeacherAboutParticipants(LiveSessionDto session) {
        if (session.getTeacherEmitter() != null) {
            try {
                SseEmitter.SseEventBuilder event = SseEmitter.event()
                        .name("participants")
                        .id(UUID.randomUUID().toString())
                        .data(session.getParticipants());
                session.getTeacherEmitter().send(event);
            } catch (IOException e) {
                // Log the error
                session.getTeacherEmitter().completeWithError(e);
                session.setTeacherEmitter(null); // Clear broken emitter
            }
        }
    }

    public void clearPresenterEmitter(String sessionId) {
        LiveSessionDto session = sessions.get(sessionId);
        if (session != null && session.getTeacherEmitter() != null) {
            session.setTeacherEmitter(null);
            System.out.println("Presenter emitter cleared for session: " + sessionId);
        }
    }

    public void setPresenterEmitter(String sessionId, SseEmitter emitter, boolean sendInitialState) {
        LiveSessionDto session = sessions.get(sessionId);
        if (session == null) {
            emitter.completeWithError(new VacademyException("Session not found (ID: " + sessionId + ") for presenter."));
            return;
        }

        // If there's an old emitter for this session, complete it.
        SseEmitter oldEmitter = session.getTeacherEmitter();
        if (oldEmitter != null && oldEmitter != emitter) { // Check it's not the same instance
            try {
                oldEmitter.complete(); // Gracefully complete the old one
            } catch (Exception e) {
                System.err.println("Error completing old presenter emitter for session " + sessionId + ": " + e.getMessage());
            }
        }

        session.setTeacherEmitter(emitter);
        System.out.println("Presenter emitter set for session: " + sessionId);

        emitter.onCompletion(() -> {
            System.out.println("Presenter emitter completed for session: " + sessionId);
            clearPresenterEmitter(sessionId);
        });
        emitter.onTimeout(() -> { // Spring's SseEmitter handles calling complete on timeout.
            System.out.println("Presenter emitter timed out for session: " + sessionId);
            clearPresenterEmitter(sessionId); // Ensure it's cleared from our map
        });
        emitter.onError(e -> {
            System.err.println("Presenter emitter error for session " + sessionId + ": " + e.getMessage());
            clearPresenterEmitter(sessionId);
        });

        if (sendInitialState) {
            // Send current participant list immediately
            notifyTeacherAboutParticipants(session); // This already sends participant data

            // Send current session state (slide, status, etc.)
            String sessionStatus = session.getSessionStatus();
            Map<String, Object> stateData = new HashMap<>();
            stateData.put("sessionStatus", sessionStatus);
            stateData.put("currentSlideIndex", session.getCurrentSlideIndex()); // Will be null if not started
            stateData.put("totalSlides", (session.getSlides() != null && session.getSlides().getAddedSlides() != null) ? session.getSlides().getAddedSlides().size() : 0);
            stateData.put("canJoinInBetween", session.getCanJoinInBetween());
            stateData.put("allowLearnerHandRaise", session.getAllowLearnerHandRaise());
            // Add other relevant session details for the teacher

            try {
                SseEmitter.SseEventBuilder event = SseEmitter.event()
                        .name("session_state_presenter") // Clear event name
                        .id(UUID.randomUUID().toString())
                        .data(stateData);
                emitter.send(event);
            } catch (IOException e) {
                // Error sending initial state; onError callback for emitter will handle cleanup.
                System.err.println("Error sending initial state to presenter for session " + sessionId + ": " + e.getMessage());
            }
        }
    }



    private AddPresentationDto getLinkedPresentation(CreateSessionDto presentation) {
        if ("PRESENTATION".equals(presentation.getSource())) {
            return presentationCrudManager.getPresentation(presentation.getSourceId()).getBody();
        }
        return null;
    }

    public LiveSessionDto startSession(StartPresentationDto startPresentationDto) {
        if (!StringUtils.hasText(startPresentationDto.getSessionId())) {
            throw new VacademyException("Invalid session ID");
        }

        LiveSessionDto session = sessions.get(startPresentationDto.getSessionId());
        if (session == null) {
            throw new VacademyException("Session not found");
        }

        if ("LIVE".equals(session.getSessionStatus())) {
            throw new VacademyException("Session is already live");
        }

        session.setSessionStatus("LIVE");
        session.setCurrentSlideIndex(0);
        session.setStartTime(new Date(System.currentTimeMillis()));
        sendSlideToStudents(session);
        notifyTeacherAboutParticipants(session); // Notify teacher about initial participants
        return session;
    }

    public LiveSessionDto moveTo(StartPresentationDto startPresentationDto) {
        if (!StringUtils.hasText(startPresentationDto.getSessionId())) {
            throw new VacademyException("Invalid session ID"); // Changed from invite code/username
        }

        LiveSessionDto session = sessions.get(startPresentationDto.getSessionId());

        if (session != null) {
            session.setCurrentSlideIndex(startPresentationDto.getMoveTo());
            sendSlideToStudents(session);
            return session;
        }

        throw new VacademyException("Error Moving Session: Session not found");
    }

    public LiveSessionDto finishSession(StartPresentationDto startPresentationDto) {
        // ... (validation)
        LiveSessionDto session = sessions.get(startPresentationDto.getSessionId());
        if (session == null) throw new VacademyException("Error Finishing Session: Session not found");
        if ("FINISHED".equals(session.getSessionStatus())) {
            System.out.println("Session " + session.getSessionId() + " is already finished.");
            return session; // Or throw error
        }

        session.setSessionStatus("FINISHED");
        session.setEndTime(new Date()); // Record end time

        Map<String, Object> endEventData = Map.of("type", "SESSION_STATUS", "status", "ENDED", "message", "Session has ended.");

        // Notify students
        new ArrayList<>(session.getStudentEmitters()).forEach(emitter -> {
            try {
                emitter.send(SseEmitter.event().name("session_event_learner").id(UUID.randomUUID().toString()).data(endEventData));
                emitter.complete();
            } catch (IOException e) { emitter.completeWithError(e); }
        });
        session.getStudentEmitters().clear();

        // Notify teacher
        if (session.getTeacherEmitter() != null) {
            try {
                session.getTeacherEmitter().send(SseEmitter.event().name("session_state_presenter").id(UUID.randomUUID().toString()).data(Map.of("sessionStatus", "FINISHED")));
                session.getTeacherEmitter().complete();
            } catch (IOException e) { session.getTeacherEmitter().completeWithError(e); }
            session.setTeacherEmitter(null);
        }

        // Don't remove from 'sessions' map immediately if you want to query details post-finish.
        // The cleanupExpiredSessions will handle it. Or remove here if no post-finish queries are needed.
        // For now, let cleanupExpiredSessions handle removal based on expiry.
        // inviteCodeToSessionId.remove(session.getInviteCode());
        // sessions.remove(session.getSessionId());
        sessionParticipantHeartbeats.remove(session.getSessionId());
        System.out.println("Session " + session.getSessionId() + " finished.");
        return session;
    }


    public void cleanupExpiredSessions() {
        long currentTime = System.currentTimeMillis();
        List<String> sessionsToRemove = new ArrayList<>();

        sessions.forEach((id, session) -> {
            if (session.getCreationTime().getTime() + SESSION_EXPIRY_MS < currentTime) {
                sessionsToRemove.add(id);
            }
        });

        sessionsToRemove.forEach(id -> {
            LiveSessionDto session = sessions.get(id);
            if (session != null) {
                // Ensure all emitters are completed before removing session data
                new ArrayList<>(session.getStudentEmitters()).forEach(SseEmitter::complete);
                session.getStudentEmitters().clear();
                if (session.getTeacherEmitter() != null) {
                    session.getTeacherEmitter().complete();
                    session.setTeacherEmitter(null);
                }

                inviteCodeToSessionId.remove(session.getInviteCode());
                sessions.remove(id);
                sessionParticipantHeartbeats.remove(id); // Clean up associated heartbeat data
                System.out.println("Cleaned up expired session: " + id); // For logging
            }
        });
    }

    // Ensure sendStatsToTeacher sends a clearly named event
    private void sendStatsToTeacher(LiveSessionDto session) {
        if (session.getTeacherEmitter() != null) {
            try {
                // Example: Sending participant DTOs, replace with actual quiz stats DTO
                List<ParticipantDto> participantInfo = session.getParticipants().stream()
                        .map(p -> new ParticipantDto(p.getUsername(), p.getStatus()))
                        .collect(Collectors.toList());

                SseEmitter.SseEventBuilder event = SseEmitter.event()
                        .name("quiz_stats_update") // Clear event name
                        .id(UUID.randomUUID().toString())
                        .data(participantInfo); // Replace with actual QuizStatsDto
                session.getTeacherEmitter().send(event);
            } catch (IOException e) {
                System.err.println("Error sending quiz stats to teacher for session " + session.getSessionId() + ": " + e.getMessage());
                session.getTeacherEmitter().completeWithError(e); // Complete this problematic one
                session.setTeacherEmitter(null);
            }
        }
    }
}