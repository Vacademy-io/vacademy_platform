package vacademy.io.admin_core_service.features.live_session.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.live_session.dto.GroupedSessionsByDateDTO;
import vacademy.io.admin_core_service.features.live_session.dto.LiveSessionListDTO;
import vacademy.io.admin_core_service.features.live_session.repository.LiveSessionRepository;
import vacademy.io.admin_core_service.features.live_session.repository.SessionScheduleRepository;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class GetLiveSessionService {
    @Autowired
    private LiveSessionRepository sessionRepository;

    @Autowired
    private SessionScheduleRepository scheduleRepository;

    public List<LiveSessionListDTO> getLiveSession(String instituteId, CustomUserDetails user) {

        List<LiveSessionRepository.LiveSessionListProjection> projections =
                sessionRepository.findCurrentlyLiveSessions(instituteId);

        return projections.stream().map(p -> new LiveSessionListDTO(
                p.getSessionId(),
                p.getWaitingRoomTime(),
                p.getThumbnailFileId(),
                p.getBackgroundScoreFileId(),
                p.getSessionStreamingServiceType(),
                p.getScheduleId(),
                p.getMeetingDate(),
                p.getStartTime(),
                p.getLastEntryTime(),
                p.getRecurrenceType(),
                p.getAccessLevel(),
                p.getTitle(),
                p.getSubject(),
                p.getMeetingLink(),
                p.getRegistrationFormLinkForPublicSessions()
        )).toList();
    }

    public List<GroupedSessionsByDateDTO> getUpcomingSession(String instituteId, CustomUserDetails user) {
        List<LiveSessionRepository.LiveSessionListProjection> projections =
                sessionRepository.findUpcomingSessions(instituteId);

        List<LiveSessionListDTO> flatList = projections.stream().map(p -> new LiveSessionListDTO(
                p.getSessionId(),
                p.getWaitingRoomTime(),
                p.getThumbnailFileId(),
                p.getBackgroundScoreFileId(),
                p.getSessionStreamingServiceType(),
                p.getScheduleId(),
                p.getMeetingDate(),
                p.getStartTime(),
                p.getLastEntryTime(),
                p.getRecurrenceType(),
                p.getAccessLevel(),
                p.getTitle(),
                p.getSubject(),
                p.getMeetingLink(),
                p.getRegistrationFormLinkForPublicSessions()
        )).toList();

        // Group by date
        return flatList.stream()
                .collect(Collectors.groupingBy(
                        LiveSessionListDTO::getMeetingDate,
                        TreeMap::new, // to keep dates sorted
                        Collectors.toList()
                ))
                .entrySet()
                .stream()
                .map(entry -> new GroupedSessionsByDateDTO(entry.getKey(), entry.getValue()))
                .toList();
    }

    public List<GroupedSessionsByDateDTO> getPreviousSession(String instituteId, CustomUserDetails user) {
        List<LiveSessionRepository.LiveSessionListProjection> projections =
                sessionRepository.findPreviousSessions(instituteId);

        List<LiveSessionListDTO> flatList = projections.stream().map(p -> new LiveSessionListDTO(
                p.getSessionId(),
                p.getWaitingRoomTime(),
                p.getThumbnailFileId(),
                p.getBackgroundScoreFileId(),
                p.getSessionStreamingServiceType(),
                p.getScheduleId(),
                p.getMeetingDate(),
                p.getStartTime(),
                p.getLastEntryTime(),
                p.getRecurrenceType(),
                p.getAccessLevel(),
                p.getTitle(),
                p.getSubject(),
                p.getMeetingLink(),
                p.getRegistrationFormLinkForPublicSessions()
        )).toList();

        // Group by date
        return flatList.stream()
                .collect(Collectors.groupingBy(
                        LiveSessionListDTO::getMeetingDate,
                        TreeMap::new, // to keep dates sorted
                        Collectors.toList()
                ))
                .entrySet()
                .stream()
                .map(entry -> new GroupedSessionsByDateDTO(entry.getKey(), entry.getValue()))
                .toList();
    }

//    public List<GroupedSessionsByDateDTO> getDraftedSession(String instituteId, CustomUserDetails user) {
//        List<LiveSessionRepository.LiveSessionListProjection> projections =
//                sessionRepository.findDraftedSessions(instituteId);
//
//        List<LiveSessionListDTO> flatList = projections.stream().map(p -> new LiveSessionListDTO(
//                p.getSessionId(),
//                p.getWaitingRoomTime(),
//                p.getThumbnailFileId(),
//                p.getBackgroundScoreFileId(),
//                p.getSessionStreamingServiceType(),
//                p.getScheduleId(),
//                p.getMeetingDate(),
//                p.getStartTime(),
//                p.getLastEntryTime(),
//                p.getRecurrenceType(),
//                p.getAccessLevel(),
//                p.getTitle(),
//                p.getSubject(),
//                p.getMeetingLink(),
//                p.getRegistrationFormLinkForPublicSessions()
//        )).toList();
//
//        // Group by date
//        return flatList.stream()
//                .collect(Collectors.groupingBy(
//                        LiveSessionListDTO::getMeetingDate,
//                        TreeMap::new, // to keep dates sorted
//                        Collectors.toList()
//                ))
//                .entrySet()
//                .stream()
//                .map(entry -> new GroupedSessionsByDateDTO(entry.getKey(), entry.getValue()))
//                .toList();
//    }

    public List<LiveSessionListDTO> getDraftedSession(String instituteId, CustomUserDetails user) {
        List<LiveSessionRepository.LiveSessionListProjection> projections =
                sessionRepository.findDraftedSessions(instituteId);

        // Deduplicate by sessionId using LinkedHashMap to preserve insertion order
        Map<String, LiveSessionListDTO> uniqueSessions = new LinkedHashMap<>();

        for (LiveSessionRepository.LiveSessionListProjection p : projections) {
            String sessionId = p.getSessionId();
            if (!uniqueSessions.containsKey(sessionId)) {
                LiveSessionListDTO dto = new LiveSessionListDTO(
                        sessionId,
                        p.getWaitingRoomTime(),
                        p.getThumbnailFileId(),
                        p.getBackgroundScoreFileId(),
                        p.getSessionStreamingServiceType(),
                        null,               // scheduleId removed
                        null,               // meetingDate removed
                        null,               // startTime removed
                        null,               // lastEntryTime removed
                        p.getRecurrenceType(),
                        p.getAccessLevel(),
                        p.getTitle(),
                        p.getSubject(),
                        p.getMeetingLink(),
                        p.getRegistrationFormLinkForPublicSessions()
                );
                uniqueSessions.put(sessionId, dto);
            }
        }

        return new ArrayList<>(uniqueSessions.values());
    }


    public List<GroupedSessionsByDateDTO> getLiveAndUpcomingSession(String instituteId, CustomUserDetails user) {
        List<LiveSessionRepository.LiveSessionListProjection> projections =
                sessionRepository.findUpcomingSessionsForBatch(instituteId);

        List<LiveSessionListDTO> flatList = projections.stream().map(p -> new LiveSessionListDTO(
                p.getSessionId(),
                p.getWaitingRoomTime(),
                p.getThumbnailFileId(),
                p.getBackgroundScoreFileId(),
                p.getSessionStreamingServiceType(),
                p.getScheduleId(),
                p.getMeetingDate(),
                p.getStartTime(),
                p.getLastEntryTime(),
                p.getRecurrenceType(),
                p.getAccessLevel(),
                p.getTitle(),
                p.getSubject(),
                p.getMeetingLink(),
                p.getRegistrationFormLinkForPublicSessions()
        )).toList();

        // Group by date
        return flatList.stream()
                .collect(Collectors.groupingBy(
                        LiveSessionListDTO::getMeetingDate,
                        TreeMap::new, // to keep dates sorted
                        Collectors.toList()
                ))
                .entrySet()
                .stream()
                .map(entry -> new GroupedSessionsByDateDTO(entry.getKey(), entry.getValue()))
                .toList();
    }

    public String deleteLiveSessions(List<String> ids, String type) {
        if (ids == null || ids.isEmpty()) {
            return "Id can't be empty";
        }

        if (Objects.equals(type, "session")) {
            String sessionId=ids.get(0);
            sessionRepository.softDeleteLiveSessionById(sessionId);
            scheduleRepository.softDeleteScheduleBySessionId(sessionId);
        } else if (Objects.equals(type, "schedule")) {

            for (String scheduleId : ids) {
                String sessionId = scheduleRepository.findSessionIdByScheduleId(scheduleId,"DELETED");
                int activeSchedules = scheduleRepository.countActiveSchedulesBySessionId(sessionId,"DELETED");

                if (activeSchedules == 1) {
                    scheduleRepository.softDeleteScheduleByIdIn(List.of(scheduleId));
                    sessionRepository.softDeleteLiveSessionById(sessionId);
                } else {
                    scheduleRepository.softDeleteScheduleByIdIn(List.of(scheduleId));
                }
            }

        }
        return type+" is deleted";
    }


}
