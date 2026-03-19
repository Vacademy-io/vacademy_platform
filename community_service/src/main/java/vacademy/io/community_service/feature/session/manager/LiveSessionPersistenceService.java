package vacademy.io.community_service.feature.session.manager;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.community_service.feature.session.dto.admin.AdminSlideResponseViewDto;
import vacademy.io.community_service.feature.session.dto.admin.LeaderboardEntryDto;
import vacademy.io.community_service.feature.session.dto.admin.ParticipantDto;
import vacademy.io.community_service.feature.session.dto.participant.SubmittedResponseDataDto;
import vacademy.io.community_service.feature.session.entity.LiveSessionParticipantRecord;
import vacademy.io.community_service.feature.session.entity.LiveSessionRecord;
import vacademy.io.community_service.feature.session.entity.LiveSessionResponseRecord;
import vacademy.io.community_service.feature.session.repository.LiveSessionParticipantRepository;
import vacademy.io.community_service.feature.session.repository.LiveSessionRecordRepository;
import vacademy.io.community_service.feature.session.repository.LiveSessionResponseRepository;

import java.util.*;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.stream.Collectors;

/**
 * Handles all asynchronous DB persistence for live sessions.
 * Also provides DB-backed fallback methods for leaderboard and slide responses
 * when a session is no longer in memory (server restart / 24-hour cleanup).
 */
@Service
public class LiveSessionPersistenceService {

    @Autowired
    private LiveSessionRecordRepository sessionRepo;

    @Autowired
    private LiveSessionParticipantRepository participantRepo;

    @Autowired
    private LiveSessionResponseRepository responseRepo;

    private final ObjectMapper objectMapper = new ObjectMapper();

    // Single-threaded executor keeps DB writes ordered and isolated from request threads
    private final ExecutorService dbWriter = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "session-db-writer");
        t.setDaemon(true);
        return t;
    });

    // -----------------------------------------------------------------------
    // Async write operations
    // -----------------------------------------------------------------------

    public void asyncSaveSession(LiveSessionRecord record) {
        dbWriter.submit(() -> {
            try {
                sessionRepo.save(record);
            } catch (Exception e) {
                System.err.println("[SessionPersistence] Failed to save session " + record.getId() + ": " + e.getMessage());
            }
        });
    }

    public void asyncUpdateSessionStatus(String sessionId, String status, Date startedAt, Date endedAt) {
        dbWriter.submit(() -> {
            try {
                sessionRepo.findById(sessionId).ifPresent(record -> {
                    record.setStatus(status);
                    if (startedAt != null) record.setStartedAt(startedAt);
                    if (endedAt != null) record.setEndedAt(endedAt);
                    sessionRepo.save(record);
                });
            } catch (Exception e) {
                System.err.println("[SessionPersistence] Failed to update status for session " + sessionId + ": " + e.getMessage());
            }
        });
    }

    public void asyncUpsertParticipant(String sessionId, ParticipantDto participant) {
        dbWriter.submit(() -> {
            try {
                Optional<LiveSessionParticipantRecord> existing =
                        participantRepo.findBySessionIdAndUsername(sessionId, participant.getUsername());
                if (existing.isPresent()) {
                    // Participant rejoined — update join time
                    LiveSessionParticipantRecord rec = existing.get();
                    if (participant.getJoinedAt() != null) rec.setJoinedAt(participant.getJoinedAt());
                    participantRepo.save(rec);
                } else {
                    LiveSessionParticipantRecord rec = LiveSessionParticipantRecord.builder()
                            .id(UUID.randomUUID().toString())
                            .sessionId(sessionId)
                            .username(participant.getUsername())
                            .userId(participant.getUserId())
                            .name(participant.getName())
                            .email(participant.getEmail())
                            .joinedAt(participant.getJoinedAt())
                            .build();
                    participantRepo.save(rec);
                }
            } catch (Exception e) {
                System.err.println("[SessionPersistence] Failed to upsert participant " + participant.getUsername()
                        + " in session " + sessionId + ": " + e.getMessage());
            }
        });
    }

    public void asyncSaveResponse(String sessionId, String slideId,
                                   String username, String responseType,
                                   List<String> selectedOptionIds, String textAnswer,
                                   Boolean isCorrect, Long timeToResponseMillis) {
        dbWriter.submit(() -> {
            try {
                String optionIdsJson = null;
                if (selectedOptionIds != null && !selectedOptionIds.isEmpty()) {
                    optionIdsJson = objectMapper.writeValueAsString(selectedOptionIds);
                }
                LiveSessionResponseRecord rec = LiveSessionResponseRecord.builder()
                        .id(UUID.randomUUID().toString())
                        .sessionId(sessionId)
                        .slideId(slideId)
                        .username(username)
                        .responseType(responseType)
                        .selectedOptionIds(optionIdsJson)
                        .textAnswer(textAnswer)
                        .isCorrect(isCorrect)
                        .timeToResponseMillis(timeToResponseMillis)
                        .submittedAt(new Date())
                        .build();
                responseRepo.save(rec);
            } catch (Exception e) {
                System.err.println("[SessionPersistence] Failed to save response for " + username
                        + " slide " + slideId + " session " + sessionId + ": " + e.getMessage());
            }
        });
    }

    // -----------------------------------------------------------------------
    // DB fallback: slide responses
    // -----------------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<AdminSlideResponseViewDto> getSlideResponsesFromDb(String sessionId, String slideId) {
        List<LiveSessionResponseRecord> records = responseRepo.findBySessionIdAndSlideId(sessionId, slideId);
        return records.stream().map(rec -> {
            List<String> optionIds = parseOptionIds(rec.getSelectedOptionIds());
            SubmittedResponseDataDto responseData = new SubmittedResponseDataDto(
                    rec.getResponseType(), optionIds, rec.getTextAnswer());
            return new AdminSlideResponseViewDto(
                    rec.getUsername(),
                    rec.getTimeToResponseMillis(),
                    rec.getSubmittedAt() != null ? rec.getSubmittedAt().getTime() : null,
                    responseData,
                    rec.getIsCorrect());
        }).sorted(Comparator
                .comparing((AdminSlideResponseViewDto r) ->
                        r.getIsCorrect() == null ? 2 : (r.getIsCorrect() ? 0 : 1))
                .thenComparing(AdminSlideResponseViewDto::getTimeToResponseMillis,
                        Comparator.nullsLast(Long::compareTo)))
                .collect(Collectors.toList());
    }

    // -----------------------------------------------------------------------
    // DB fallback: leaderboard
    // -----------------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<LeaderboardEntryDto> computeLeaderboardFromDb(String sessionId) {
        LiveSessionRecord session = sessionRepo.findById(sessionId).orElse(null);
        if (session == null) return Collections.emptyList();

        int pointsPerCorrect = session.getPointsPerCorrectAnswer() != null ? session.getPointsPerCorrectAnswer() : 10;
        boolean negativeEnabled = Boolean.TRUE.equals(session.getNegativeMarkingEnabled());
        double negativeMarks = session.getNegativeMarksPerWrongAnswer() != null
                ? session.getNegativeMarksPerWrongAnswer() : 0.0;
        int totalMcqSlides = session.getTotalMcqSlides() != null ? session.getTotalMcqSlides() : 0;

        if (totalMcqSlides == 0) return Collections.emptyList();

        List<LiveSessionResponseRecord> allResponses = responseRepo.findBySessionId(sessionId);

        // Only consider MCQ responses for scoring
        List<LiveSessionResponseRecord> mcqResponses = allResponses.stream()
                .filter(r -> "MCQS".equalsIgnoreCase(r.getResponseType())
                          || "MCQM".equalsIgnoreCase(r.getResponseType()))
                .collect(Collectors.toList());

        // Group by username
        Map<String, List<LiveSessionResponseRecord>> byUser = mcqResponses.stream()
                .collect(Collectors.groupingBy(LiveSessionResponseRecord::getUsername));

        // Also include participants with no MCQ responses
        List<LiveSessionParticipantRecord> participants = participantRepo.findBySessionId(sessionId);
        for (LiveSessionParticipantRecord p : participants) {
            byUser.putIfAbsent(p.getUsername(), Collections.emptyList());
        }

        List<LeaderboardEntryDto> entries = new ArrayList<>();

        for (Map.Entry<String, List<LiveSessionResponseRecord>> entry : byUser.entrySet()) {
            String username = entry.getKey();
            // For each slide, take only the LAST response (by submitted_at)
            Map<String, LiveSessionResponseRecord> latestPerSlide = new LinkedHashMap<>();
            for (LiveSessionResponseRecord r : entry.getValue()) {
                latestPerSlide.merge(r.getSlideId(), r, (existing, newRec) ->
                        (newRec.getSubmittedAt() != null && existing.getSubmittedAt() != null
                                && newRec.getSubmittedAt().after(existing.getSubmittedAt())) ? newRec : existing);
            }

            double score = 0;
            long totalTime = 0;
            int correct = 0;
            int wrong = 0;

            for (LiveSessionResponseRecord r : latestPerSlide.values()) {
                if (Boolean.TRUE.equals(r.getIsCorrect())) {
                    correct++;
                    score += pointsPerCorrect;
                } else if (Boolean.FALSE.equals(r.getIsCorrect())) {
                    wrong++;
                    if (negativeEnabled) score -= negativeMarks;
                }
                if (r.getTimeToResponseMillis() != null) totalTime += r.getTimeToResponseMillis();
            }

            int unanswered = totalMcqSlides - latestPerSlide.size();
            if (unanswered < 0) unanswered = 0;

            LeaderboardEntryDto dto = new LeaderboardEntryDto();
            dto.setUsername(username);
            dto.setTotalScore(score);
            dto.setTotalTimeMillis(totalTime);
            dto.setCorrectCount(correct);
            dto.setWrongCount(wrong);
            dto.setUnansweredCount(unanswered);
            dto.setTotalMcqQuestions(totalMcqSlides);
            entries.add(dto);
        }

        entries.sort(Comparator.comparingDouble(LeaderboardEntryDto::getTotalScore).reversed()
                .thenComparingLong(LeaderboardEntryDto::getTotalTimeMillis));

        for (int i = 0; i < entries.size(); i++) {
            if (i > 0
                    && entries.get(i).getTotalScore() == entries.get(i - 1).getTotalScore()
                    && entries.get(i).getTotalTimeMillis() == entries.get(i - 1).getTotalTimeMillis()) {
                entries.get(i).setRank(entries.get(i - 1).getRank());
            } else {
                entries.get(i).setRank(i + 1);
            }
        }
        return entries;
    }

    // -----------------------------------------------------------------------
    // Session history for a presentation
    // -----------------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getSessionHistoryForPresentation(String presentationId) {
        List<LiveSessionRecord> sessions = sessionRepo.findByPresentationIdOrderByCreatedAtDesc(presentationId);
        if (sessions.isEmpty()) return Collections.emptyList();

        // Batch-fetch counts for all sessions in 2 queries (instead of 2×N)
        List<String> sessionIds = sessions.stream().map(LiveSessionRecord::getId).collect(Collectors.toList());

        Map<String, Long> participantCounts = new HashMap<>();
        for (Object[] row : participantRepo.countBySessionIdIn(sessionIds)) {
            participantCounts.put((String) row[0], (Long) row[1]);
        }

        Map<String, Long> responseCounts = new HashMap<>();
        for (Object[] row : responseRepo.countBySessionIdIn(sessionIds)) {
            responseCounts.put((String) row[0], (Long) row[1]);
        }

        List<Map<String, Object>> result = new ArrayList<>();
        for (LiveSessionRecord s : sessions) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("session_id", s.getId());
            item.put("presentation_id", s.getPresentationId());
            item.put("presentation_title", s.getPresentationTitle());
            item.put("invite_code", s.getInviteCode());
            item.put("status", s.getStatus());
            item.put("created_at", s.getCreatedAt());
            item.put("started_at", s.getStartedAt());
            item.put("ended_at", s.getEndedAt());
            item.put("participant_count", participantCounts.getOrDefault(s.getId(), 0L));
            item.put("total_responses", responseCounts.getOrDefault(s.getId(), 0L));
            result.add(item);
        }
        return result;
    }

    // -----------------------------------------------------------------------
    // Helper
    // -----------------------------------------------------------------------

    @SuppressWarnings("unchecked")
    private List<String> parseOptionIds(String json) {
        if (json == null || json.isBlank()) return Collections.emptyList();
        try {
            return objectMapper.readValue(json, List.class);
        } catch (JsonProcessingException e) {
            return Collections.emptyList();
        }
    }
}
