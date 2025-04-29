package vacademy.io.admin_core_service.features.presentation_mode.manager;

import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import vacademy.io.admin_core_service.features.presentation_mode.admin.dto.CreatePresentationDto;
import vacademy.io.admin_core_service.features.presentation_mode.admin.dto.StartPresentationDto;
import vacademy.io.admin_core_service.features.presentation_mode.learner.dto.LiveSessionDto;
import vacademy.io.admin_core_service.features.presentation_mode.learner.dto.ParticipantDto;
import vacademy.io.admin_core_service.features.presentation_mode.learner.dto.PresentationSlideDto;
import vacademy.io.admin_core_service.features.presentation_mode.learner.dto.QuizData;
import vacademy.io.common.exceptions.VacademyException;

import java.io.IOException;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

@Service
public class LiveSessionService {
    // Add this constant
    private static final long SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
    // Maximum time without heartbeat before marking participant as inactive (ms)
    private static final long HEARTBEAT_TIMEOUT_MS = 60000; // 60 seconds
    private final Map<String, LiveSessionDto> sessions = new ConcurrentHashMap<>();
    private final Map<String, String> inviteCodeToSessionId = new ConcurrentHashMap<>();
    private final Map<String, Map<String, Long>> sessionParticipantHeartbeats = new ConcurrentHashMap<>();
    private final ScheduledExecutorService heartbeatMonitor = Executors.newSingleThreadScheduledExecutor();

    public LiveSessionService() {
        // Schedule periodic check for inactive participants
        heartbeatMonitor.scheduleAtFixedRate(
                this::checkInactiveParticipants,
                0,
                15,
                TimeUnit.SECONDS
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
                // Clean up if session no longer exists
                sessionParticipantHeartbeats.remove(sessionId);
                return;
            }

            // Check each participant's last heartbeat
            participants.forEach((userId, lastHeartbeat) -> {
                if (currentTime - lastHeartbeat > HEARTBEAT_TIMEOUT_MS) {
                    // Participant hasn't sent heartbeat in too long, mark inactive
                    updateParticipantStatus(session, userId, "INACTIVE");
                }
            });
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
                    .filter(p -> p.getUserId().equals(username) &&
                            (p.getStatus() == null || p.getStatus().equals("INACTIVE")))
                    .findFirst()
                    .ifPresent(p -> updateParticipantStatus(session, username, "ACTIVE"));
        }
    }


    public LiveSessionDto createSession(CreatePresentationDto presentation) {
        LiveSessionDto session = new LiveSessionDto();
        session.setSessionId(UUID.randomUUID().toString());
        session.setInviteCode(generateInviteCode());
        session.setCreatePresentationDto(presentation);
        session.setSessionStatus("INIT");
        session.setCreationTime(new Date(System.currentTimeMillis()));
        session.setSlides(makeSamplePresentation());
        sessions.put(session.getSessionId(), session);
        inviteCodeToSessionId.put(session.getInviteCode(), session.getSessionId());
        return session;
    }

    private void sendSlideToStudents(LiveSessionDto session) {
        session.getStudentEmitters().forEach(emitter -> {

            try {
                SseEmitter.SseEventBuilder event = SseEmitter.event()
                        .name("moveToNextSlide")
                        .id(UUID.randomUUID().toString())
                        .data(session.getCurrentSlideIndex());
                emitter.send(event);
            } catch (IOException e) {
                emitter.completeWithError(e);
            }
        });
    }

    public void addStudentEmitter(String sessionId, SseEmitter emitter, String username) {
        LiveSessionDto session = sessions.get(sessionId);
        if (session != null) {
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

            // Update connection status handlers
            emitter.onCompletion(() -> {
                session.getStudentEmitters().remove(emitter);
                // Don't immediately mark inactive on completion
                // The heartbeat monitor will handle this if no heartbeats arrive
            });

            emitter.onTimeout(() -> {
                session.getStudentEmitters().remove(emitter);
                // Don't immediately mark inactive on timeout
                // The heartbeat monitor will handle this if no heartbeats arrive
            });

            emitter.onError(e -> {
                session.getStudentEmitters().remove(emitter);
                // Don't immediately mark inactive on error
                // The heartbeat monitor will handle this if no heartbeats arrive
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
                    participant.setStatus(status);

                    // If becoming active for the first time, set joinedAt
                    if (status.equals("ACTIVE") && participant.getJoinedAt() == null) {
                        participant.setJoinedAt(new Date());
                    }

                    // Notify teacher about the participant status change
                    notifyTeacherAboutParticipants(session);
                });
    }


    public void updateQuizStats(String sessionId, String answer) {
        LiveSessionDto session = sessions.get(sessionId);
        sendStatsToTeacher(session);
    }

    private void sendStatsToTeacher(LiveSessionDto session) {
        if (session.getTeacherEmitter() != null) {

        }
    }

    private String generateInviteCode() {
        // Current method creates a UUID substring which may not be user-friendly
        // Replace with more readable characters for easier sharing
        String chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        StringBuilder sb = new StringBuilder();
        Random random = new Random();
        for (int i = 0; i < 6; i++) {
            sb.append(chars.charAt(random.nextInt(chars.length())));
        }
        return sb.toString();
    }

    public LiveSessionDto getDetailsSession(String inviteCode, ParticipantDto participantDto) {
        if (!StringUtils.hasText(inviteCode) || !StringUtils.hasText(participantDto.getUsername())) {
            throw new VacademyException("Invalid invite code or username");
        }
        String sessionId = inviteCodeToSessionId.get(inviteCode);
        if (sessionId != null) {
            LiveSessionDto session = sessions.get(sessionId);
            if (session == null) {
                // Clean up the dangling reference
                inviteCodeToSessionId.remove(inviteCode);
                throw new VacademyException("Session not found");
            }
            // Check if username is already taken
            boolean usernameTaken = session.getParticipants().stream()
                    .anyMatch(p -> p.getUsername().equals(participantDto.getUsername()));
            if (usernameTaken) {
                throw new VacademyException("Username already taken");
            }

            // Add participant
            session.getParticipants().add(participantDto);

            return session;
        }

        throw new VacademyException("Invalid invite code or username");
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
                // Add logging
                session.setTeacherEmitter(null);
            }
        }
    }

    public void setPresenterEmitter(String sessionId, SseEmitter emitter) {
        LiveSessionDto session = sessions.get(sessionId);
        if (session != null) {
            session.setTeacherEmitter(emitter);
        } else throw new VacademyException("Session not found");
    }

    private List<PresentationSlideDto> makeSamplePresentation() {
        List<PresentationSlideDto> slides = new ArrayList<>();

        PresentationSlideDto slide1 = new PresentationSlideDto();
        slide1.setSlideId("1");
        slide1.setName("Slide 1");
        slide1.setType("TITLE");
        slide1.setSlideData(String.valueOf("Lets Start the Presentation"));
        slide1.setIndex(0);
        slide1.setIsLoaded(true);
        slide1.setIsAcceptingResponses(false);
        slides.add(slide1);

        PresentationSlideDto slide2 = new PresentationSlideDto();
        slide2.setSlideId("2");
        slide2.setName("Slide 2");
        slide2.setType("VIDEO_YOUTUBE");
        slide2.setSlideData(String.valueOf("https://www.youtube.com/watch?v=mJoWTNu1Xeo"));
        slide2.setIndex(1);
        slide2.setIsLoaded(true);
        slide2.setIsAcceptingResponses(false);
        slides.add(slide2);

        PresentationSlideDto slide3 = new PresentationSlideDto();
        slide3.setSlideId("2");
        slide3.setName("Slide 2");
        slide3.setType("QUIZ");
        QuizData quizData = new QuizData();
        quizData.setType("MCQS");
        quizData.setQuestion("What is the capital of India?");
        quizData.setOptions(Arrays.asList("Mumbai", "Delhi", "Chennai", "Kolkata"));
        slide3.setSlideData(quizData);
        slide3.setIndex(2);
        slide3.setIsLoaded(true);
        slide3.setIsAcceptingResponses(true);
        slides.add(slide3);

        return slides;
    }

    public LiveSessionDto startSession(StartPresentationDto startPresentationDto) {
        if (!StringUtils.hasText(startPresentationDto.getSessionId())) {
            throw new VacademyException("Invalid session ID");
        }

        LiveSessionDto session = sessions.get(startPresentationDto.getSessionId());
        if (session == null) {
            throw new VacademyException("Session not found");
        }

        // Check if session is already live
        if ("LIVE".equals(session.getSessionStatus())) {
            throw new VacademyException("Session is already live");
        }

        session.setSessionStatus("LIVE");
        session.setCurrentSlideIndex(0);
        session.setStartTime(new Date(System.currentTimeMillis()));
        sendSlideToStudents(session);
        return session;
    }

    public LiveSessionDto moveTo(StartPresentationDto startPresentationDto) {
        if (!StringUtils.hasText(startPresentationDto.getSessionId())) {
            throw new VacademyException("Invalid invite code or username");
        }

        LiveSessionDto session = sessions.get(startPresentationDto.getSessionId());

        if (session != null) {
            session.setCurrentSlideIndex(startPresentationDto.getMoveTo());
            sendSlideToStudents(session);
            return session;
        }

        throw new VacademyException("Error Moving Session");
    }

    public LiveSessionDto finishSession(StartPresentationDto startPresentationDto) {
        if (!StringUtils.hasText(startPresentationDto.getSessionId())) {
            throw new VacademyException("Invalid invite code or username");
        }

        LiveSessionDto session = sessions.get(startPresentationDto.getSessionId());

        if (session != null) {
            // Set session status to FINISHED
            session.setSessionStatus("FINISHED");

            // Notify all connected students that the session has ended
            session.getStudentEmitters().forEach(emitter -> {
                try {
                    SseEmitter.SseEventBuilder event = SseEmitter.event()
                            .name("sessionEnded")
                            .id(UUID.randomUUID().toString())
                            .data("Session has ended");
                    emitter.send(event);
                    // Complete the emitter after sending the final event
                    emitter.complete();
                } catch (IOException e) {
                    emitter.completeWithError(e);
                }
            });

            // Clear student emitters list after notifying them
            session.getStudentEmitters().clear();

            // Complete teacher emitter if exists
            if (session.getTeacherEmitter() != null) {
                try {
                    SseEmitter.SseEventBuilder event = SseEmitter.event()
                            .name("sessionEnded")
                            .id(UUID.randomUUID().toString())
                            .data("Session has ended");
                    session.getTeacherEmitter().send(event);
                    session.getTeacherEmitter().complete();
                    session.setTeacherEmitter(null);
                } catch (IOException e) {
                    session.getTeacherEmitter().completeWithError(e);
                }
            }

            // Remove the invite code mapping
            inviteCodeToSessionId.remove(session.getInviteCode());

            // Return the updated session before removing it from memory
            return session;
        }

        throw new VacademyException("Error Finishing Session");
    }

    // Add a new method to clean up expired sessions
    public void cleanupExpiredSessions() {
        long currentTime = System.currentTimeMillis();
        List<String> sessionsToRemove = new ArrayList<>();

        sessions.forEach((id, session) -> {
            // Add a timestamp to session creation and check if it's older than a threshold
            if (session.getCreationTime().getTime() + SESSION_EXPIRY_MS < currentTime) {
                sessionsToRemove.add(id);
            }
        });

        sessionsToRemove.forEach(id -> {
            LiveSessionDto session = sessions.get(id);
            inviteCodeToSessionId.remove(session.getInviteCode());
            sessions.remove(id);
        });
    }
}

