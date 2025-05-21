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
        // Use a defensive copy to avoid ConcurrentModificationException during iteration
        // if an emitter completes while iterating.
        new ArrayList<>(session.getStudentEmitters()).forEach(emitter -> {
            try {
                SseEmitter.SseEventBuilder event = SseEmitter.event()
                        .name("moveToNextSlide")
                        .id(UUID.randomUUID().toString())
                        .data(session.getCurrentSlideIndex());
                emitter.send(event);
            } catch (IOException e) {
                // If an error occurs (e.g., client disconnected), complete the emitter
                // and let the onCompletion/onError handler clean up the list.
                emitter.completeWithError(e);
            }
        });
    }

    public void addStudentEmitter(String sessionId, SseEmitter emitter, String username) {
        LiveSessionDto session = sessions.get(sessionId);
        if (session != null) {
            // If participant is not in the session yet (should not happen if joined via getDetailsSession)
            if (!session.getParticipants().stream().anyMatch(p -> p.getUsername().equals(username))) {
                emitter.completeWithError(new VacademyException("Participant not found in session."));
                return;
            }

            // Mark the participant as active
            updateParticipantStatus(session, username, "ACTIVE");

            // Initialize heartbeat tracking
            Map<String, Long> participantHeartbeats = sessionParticipantHeartbeats
                    .computeIfAbsent(sessionId, k -> new ConcurrentHashMap<>());
            participantHeartbeats.put(username, System.currentTimeMillis());

            session.getStudentEmitters().add(emitter);

            // Send current slide information immediately to the new student
            try {
                SseEmitter.SseEventBuilder event = SseEmitter.event()
                        .name("moveToNextSlide")
                        .id(UUID.randomUUID().toString())
                        .data(session.getCurrentSlideIndex());
                emitter.send(event);
            } catch (IOException e) {
                emitter.completeWithError(e);
            }

            // Update connection status handlers: immediately mark inactive on disconnect
            emitter.onCompletion(() -> {
                session.getStudentEmitters().remove(emitter);
                updateParticipantStatus(session, username, "INACTIVE");
            });

            emitter.onTimeout(() -> {
                session.getStudentEmitters().remove(emitter);
                updateParticipantStatus(session, username, "INACTIVE");
            });

            emitter.onError(e -> {
                session.getStudentEmitters().remove(emitter);
                updateParticipantStatus(session, username, "INACTIVE");
            });
        } else {
            emitter.completeWithError(new VacademyException("Session not found"));
        }
    }

    /**
     * Updates a participant's active status and notifies the teacher of this change
     */
    private void updateParticipantStatus(LiveSessionDto session, String username, String status) {
        // Find the participant by userId and update status
        session.getParticipants().stream()
                .filter(p -> p.getUsername().equals(username))
                .findFirst()
                .ifPresent(participant -> {
                    String oldStatus = participant.getStatus();
                    participant.setStatus(status);

                    // If becoming active for the first time, set joinedAt
                    if (status.equals("ACTIVE") && participant.getJoinedAt() == null) {
                        participant.setJoinedAt(new Date());
                    }

                    // Only notify teacher if status actually changed
                    if (!Objects.equals(oldStatus, status)) {
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

    private void sendStatsToTeacher(LiveSessionDto session) {
        if (session.getTeacherEmitter() != null) {
            try {
                SseEmitter.SseEventBuilder event = SseEmitter.event()
                        .name("quizStatsUpdate")
                        .id(UUID.randomUUID().toString())
                        // Send current participants or a dedicated QuizStatsDto
                        .data(session.getParticipants().stream()
                                .map(p -> new ParticipantDto(p.getUsername(), p.getStatus()))
                                .collect(Collectors.toList()));
                session.getTeacherEmitter().send(event);
            } catch (IOException e) {
                // Log and complete if connection is broken
                session.getTeacherEmitter().completeWithError(e);
                session.setTeacherEmitter(null); // Clear broken emitter
            }
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
        if (!StringUtils.hasText(inviteCode) || !StringUtils.hasText(participantDto.getUsername())) {
            throw new VacademyException("Invalid invite code or username");
        }
        String sessionId = inviteCodeToSessionId.get(inviteCode);
        if (sessionId != null) {
            LiveSessionDto session = sessions.get(sessionId);
            if (session == null) {
                // Clean up the dangling reference if session object was removed but inviteCode mapping exists
                inviteCodeToSessionId.remove(inviteCode);
                throw new VacademyException("Session not found");
            }

            // Check if username is already taken AND active
            Optional<ParticipantDto> existingParticipant = session.getParticipants().stream()
                    .filter(p -> p.getUsername().equals(participantDto.getUsername()))
                    .findFirst();

            if (existingParticipant.isPresent()) {
                if ("ACTIVE".equals(existingParticipant.get().getStatus())) {
                    throw new VacademyException("Username already taken and active in this session. Please choose another username.");
                } else {
                    // Participant exists but is INACTIVE, allow them to rejoin
                    existingParticipant.get().setStatus("INIT"); // Will become ACTIVE on emitter connection
                    existingParticipant.get().setJoinedAt(null); // Reset joined time
                }
            } else {
                // Add new participant
                session.getParticipants().add(participantDto);
            }
            return session;
        }
        throw new VacademyException("Invalid invite code");
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

    public void setPresenterEmitter(String sessionId, SseEmitter emitter) {
        LiveSessionDto session = sessions.get(sessionId);
        if (session != null) {
            session.setTeacherEmitter(emitter);
            emitter.onCompletion(() -> session.setTeacherEmitter(null));
            emitter.onTimeout(() -> session.setTeacherEmitter(null));
            emitter.onError(e -> session.setTeacherEmitter(null));
        } else {
            emitter.completeWithError(new VacademyException("Session not found"));
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
        if (!StringUtils.hasText(startPresentationDto.getSessionId())) {
            throw new VacademyException("Invalid session ID"); // Changed from invite code/username
        }

        LiveSessionDto session = sessions.get(startPresentationDto.getSessionId());

        if (session != null) {
            session.setSessionStatus("FINISHED");

            // Notify all connected students that the session has ended and complete their emitters
            // Use a defensive copy to iterate to avoid ConcurrentModificationException
            new ArrayList<>(session.getStudentEmitters()).forEach(emitter -> {
                try {
                    SseEmitter.SseEventBuilder event = SseEmitter.event()
                            .name("sessionEnded")
                            .id(UUID.randomUUID().toString())
                            .data("Session has ended");
                    emitter.send(event);
                    emitter.complete(); // Complete after sending final event
                } catch (IOException e) {
                    emitter.completeWithError(e);
                }
            });
            session.getStudentEmitters().clear(); // Clear the list after completing emitters

            // Complete teacher emitter if exists
            if (session.getTeacherEmitter() != null) {
                try {
                    SseEmitter.SseEventBuilder event = SseEmitter.event()
                            .name("sessionEnded")
                            .id(UUID.randomUUID().toString())
                            .data("Session has ended");
                    session.getTeacherEmitter().send(event);
                    session.getTeacherEmitter().complete();
                } catch (IOException e) {
                    session.getTeacherEmitter().completeWithError(e);
                }
                session.setTeacherEmitter(null); // Clear after completing
            }

            // Remove the session and invite code mapping from in-memory storage
            inviteCodeToSessionId.remove(session.getInviteCode());
            sessions.remove(session.getSessionId());
            sessionParticipantHeartbeats.remove(session.getSessionId()); // Also clean heartbeats

            return session;
        }

        throw new VacademyException("Error Finishing Session: Session not found");
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
}