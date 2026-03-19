package vacademy.io.admin_core_service.features.live_session.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.live_session.dto.GroupedSessionsByDateDTO;
import vacademy.io.admin_core_service.features.live_session.dto.LiveSessionListDTO;
import vacademy.io.admin_core_service.features.live_session.dto.SessionSearchRequest;
import vacademy.io.admin_core_service.features.live_session.dto.SessionSearchResponse;
import vacademy.io.admin_core_service.features.live_session.enums.NotificationStatusEnum;
import vacademy.io.admin_core_service.features.live_session.repository.LiveSessionParticipantRepository;
import vacademy.io.admin_core_service.features.live_session.repository.LiveSessionRepository;
import vacademy.io.admin_core_service.features.live_session.repository.ScheduleNotificationRepository;
import vacademy.io.admin_core_service.features.live_session.repository.SessionScheduleRepository;
import vacademy.io.admin_core_service.features.live_session.scheduler.LiveSessionNotificationProcessor;
import vacademy.io.admin_core_service.features.packages.repository.PackageSessionRepository;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class GetLiveSessionService {
    @Autowired
    private LiveSessionRepository sessionRepository;

    @Autowired
    private SessionScheduleRepository scheduleRepository;

    @Autowired
    private LiveSessionNotificationProcessor notificationProcessor;

    @Autowired
    private ScheduleNotificationRepository scheduleNotificationRepository;

    @Autowired
    private LiveSessionParticipantRepository liveSessionParticipantRepository;

    @Autowired
    private PackageSessionRepository packageSessionRepository;

        private GroupedSessionsByDateDTO createGroupedSessionsByDateDTO(Date date, List<LiveSessionListDTO> sessions) {
                String defaultLink = null;
                String defaultName = null;

                // Find first non-null config/link and clear default link/name from sessions
                for (LiveSessionListDTO session : sessions) {
                        // LearnerButtonConfig should remain in session and NOT be moved to group level.

                        if (session.getDefaultClassLink() != null) {
                                if (defaultLink == null) {
                                        defaultLink = session.getDefaultClassLink();
                                }
                                session.setDefaultClassLink(null);
                        }
                        if (session.getDefaultClassName() != null) {
                                if (defaultName == null) {
                                        defaultName = session.getDefaultClassName();
                                }
                                session.setDefaultClassName(null);
                        }
                }

                // Pass null for learnerButtonConfig so it is excluded from group level response
                return new GroupedSessionsByDateDTO(date, sessions, null, defaultLink, defaultName);
        }

        public List<LiveSessionListDTO> getLiveSession(String instituteId, CustomUserDetails user) {

                List<LiveSessionRepository.LiveSessionListProjection> projections = sessionRepository
                                .findCurrentlyLiveSessions(instituteId);

        List<LiveSessionListDTO> result = new ArrayList<>(projections.stream().map(p -> new LiveSessionListDTO(
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
                p.getRegistrationFormLinkForPublicSessions(),
                p.getTimezone(),
                deserializeLearnerButtonConfig(p.getLearnerButtonConfig()),
                p.getDefaultClassLink(),
                p.getDefaultClassName(),
                p.getLinkType()
        )).toList());

        enrichWithPackageSessionDetails(result);
        return result;
    }

        public List<GroupedSessionsByDateDTO> getUpcomingSession(String instituteId, CustomUserDetails user) {
                List<LiveSessionRepository.LiveSessionListProjection> projections = sessionRepository
                                .findUpcomingSessions(instituteId);

        List<LiveSessionListDTO> flatList = new ArrayList<>(projections.stream().map(p -> new LiveSessionListDTO(
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
                p.getRegistrationFormLinkForPublicSessions(),
                p.getTimezone(),
                deserializeLearnerButtonConfig(p.getLearnerButtonConfig()),
                p.getDefaultClassLink(),
                p.getDefaultClassName(),
                p.getLinkType()
        )).toList());

        enrichWithPackageSessionDetails(flatList);

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
                List<LiveSessionRepository.LiveSessionListProjection> projections = sessionRepository
                                .findPreviousSessions(instituteId);

        List<LiveSessionListDTO> flatList = new ArrayList<>(projections.stream().map(p -> new LiveSessionListDTO(
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
                p.getRegistrationFormLinkForPublicSessions(),
                p.getTimezone(),
                deserializeLearnerButtonConfig(p.getLearnerButtonConfig()),
                p.getDefaultClassLink(),
                p.getDefaultClassName(),
                p.getLinkType()
        )).toList());

        enrichWithPackageSessionDetails(flatList);

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
                        p.getRegistrationFormLinkForPublicSessions(),
                        p.getTimezone(),
                        deserializeLearnerButtonConfig(p.getLearnerButtonConfig()),
                        p.getDefaultClassLink(),
                        p.getDefaultClassName(),
                        p.getLinkType()
                );
                uniqueSessions.put(sessionId, dto);
            }
        }

        List<LiveSessionListDTO> result = new ArrayList<>(uniqueSessions.values());
        enrichWithPackageSessionDetails(result);
        return result;
    }


    public List<GroupedSessionsByDateDTO> getLiveAndUpcomingSession(String instituteId, CustomUserDetails user) {
        List<LiveSessionRepository.LiveSessionListProjection> projections =
                sessionRepository.findUpcomingSessionsForBatch(instituteId);

        List<LiveSessionListDTO> flatList = new ArrayList<>(projections.stream().map(p -> new LiveSessionListDTO(
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
                p.getRegistrationFormLinkForPublicSessions(),
                p.getTimezone(),
                deserializeLearnerButtonConfig(p.getLearnerButtonConfig()),
                p.getDefaultClassLink(),
                p.getDefaultClassName(),
                p.getLinkType()
        )).toList());

        enrichWithPackageSessionDetails(flatList);

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

    public List<GroupedSessionsByDateDTO> getLiveAndUpcomingSessionsForUser(String userId, CustomUserDetails user) {
        List<LiveSessionRepository.LiveSessionListProjection> projections =
                sessionRepository.findUpcomingSessionsForUser(userId);

        List<LiveSessionListDTO> flatList = new ArrayList<>(projections.stream().map(p -> new LiveSessionListDTO(
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
                p.getRegistrationFormLinkForPublicSessions(),
                p.getTimezone(),
                deserializeLearnerButtonConfig(p.getLearnerButtonConfig()),
                p.getDefaultClassLink(),
                p.getDefaultClassName(),
                p.getLinkType()
        )).toList());

        enrichWithPackageSessionDetails(flatList);

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

    @Cacheable(value = "liveAndUpcomingSessions", key = "#batchId + '_' + #userId + '_' + #page + '_' + #size + '_' + #startDate + '_' + #endDate")
    public List<GroupedSessionsByDateDTO> getLiveAndUpcomingSessionsForUserAndBatch(
            String batchId, String userId, int page, Integer size, String startDate, String endDate, CustomUserDetails user) {
        // Calculate offset for pagination (only if size is provided)
        Integer offset = (size != null) ? page * size : null;
        
        // Optimized: Single query that fetches both batch and user sessions with database-level deduplication
        List<LiveSessionRepository.LiveSessionListProjection> projections = 
                sessionRepository.findUpcomingSessionsForUserAndBatchWithFilters(batchId, userId, startDate, endDate, offset, size);

        // Map projections to DTOs
        List<LiveSessionListDTO> flatList = new ArrayList<>(projections.stream().map(p -> new LiveSessionListDTO(
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
                p.getRegistrationFormLinkForPublicSessions(),
                p.getTimezone(),
                deserializeLearnerButtonConfig(p.getLearnerButtonConfig()),
                p.getDefaultClassLink(),
                p.getDefaultClassName(),
                p.getLinkType()
        )).toList());

                enrichWithPackageSessionDetails(flatList);

                // Group by date
                return flatList.stream()
                                .collect(Collectors.groupingBy(
                                                LiveSessionListDTO::getMeetingDate,
                                                TreeMap::new, // to keep dates sorted
                                                Collectors.toList()))
                                .entrySet()
                                .stream()
                                .map(entry -> createGroupedSessionsByDateDTO(entry.getKey(), entry.getValue()))
                                .toList();
        }

    public SessionSearchResponse searchSessions(SessionSearchRequest request, CustomUserDetails user) {
        // Create pageable object
        Pageable pageable = PageRequest.of(request.getPage(), request.getSize());
        
        // Call repository with dynamic query
        Page<LiveSessionRepository.LiveSessionListProjection> page = 
            sessionRepository.searchSessions(request, pageable);
        
        // Map projections to DTOs
        List<LiveSessionListDTO> sessions = page.getContent().stream()
            .map(p -> new LiveSessionListDTO(
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
                p.getRegistrationFormLinkForPublicSessions(),
                p.getTimezone(),
                deserializeLearnerButtonConfig(p.getLearnerButtonConfig()),
                p.getDefaultClassLink(),
                p.getDefaultClassName(),
                p.getLinkType()
            ))
            .collect(Collectors.toList());

        enrichWithPackageSessionDetails(sessions);

        // Build pagination metadata
        SessionSearchResponse.PageMetadata pagination = new SessionSearchResponse.PageMetadata(
            page.getNumber(),
            page.getSize(),
            page.getTotalElements(),
            page.getTotalPages(),
            page.hasNext(),
            page.hasPrevious()
        );
        
        return new SessionSearchResponse(sessions, pagination);
    }

    public String deleteLiveSessions(List<String> ids, String type) {
        if (ids == null || ids.isEmpty()) {
            return "Id can't be empty";
        }

        if (Objects.equals(type, "session")) {
            String sessionId = ids.get(0);
            
            // Get session details before deletion for notification
            String instituteId = sessionRepository.findById(sessionId)
                    .map(session -> session.getInstituteId())
                    .orElse(null);
            
            // Get all schedule IDs for this session before deletion
            List<String> scheduleIds = scheduleRepository.findScheduleIdsBySessionId(sessionId, NotificationStatusEnum.DELETED.name());
            
            // Send delete notification for all schedules before deletion
            if (instituteId != null && !scheduleIds.isEmpty()) {
                notificationProcessor.sendDeleteNotificationForSchedules(scheduleIds, instituteId);
            }
            
            sessionRepository.softDeleteLiveSessionById(sessionId);
            scheduleRepository.softDeleteScheduleBySessionId(sessionId);
            // Disable all notifications for this session
            scheduleNotificationRepository.disableNotificationsBySessionId(sessionId,NotificationStatusEnum.DISABLED.name());
        } else if (Objects.equals(type, "schedule")) {
            List<String> scheduleIdsToNotify = new ArrayList<>();
            String instituteId = null;

            for (String scheduleId : ids) {
                String sessionId = scheduleRepository.findSessionIdByScheduleId(scheduleId, NotificationStatusEnum.DELETED.name());
                int activeSchedules = scheduleRepository.countActiveSchedulesBySessionId(sessionId, NotificationStatusEnum.DELETED.name());

                // Get institute ID from the first session for notification
                if (instituteId == null) {
                    instituteId = sessionRepository.findById(sessionId)
                            .map(session -> session.getInstituteId())
                            .orElse(null);
                }

                if (activeSchedules == 1) {
                    // Session will be deleted, so notify for session deletion
                    if (instituteId != null) {
                        notificationProcessor.sendDeleteNotification(sessionId, instituteId);
                    }
                    scheduleRepository.softDeleteScheduleByIdIn(List.of(scheduleId));
                    sessionRepository.softDeleteLiveSessionById(sessionId);
                    // Disable all notifications for this session
                    scheduleNotificationRepository.disableNotificationsBySessionId(sessionId,NotificationStatusEnum.DISABLED.name());
                } else {
                    // Only schedule deletion, collect for batch notification
                    scheduleIdsToNotify.add(scheduleId);
                }
            }

            // Send notifications for individual schedule deletions
            if (!scheduleIdsToNotify.isEmpty() && instituteId != null) {
                notificationProcessor.sendDeleteNotificationForSchedules(scheduleIdsToNotify, instituteId);
                // Disable notifications for the deleted schedules
                scheduleNotificationRepository.disableNotificationsByScheduleIds(scheduleIdsToNotify, NotificationStatusEnum.DISABLED.name());
            }
        }
        return type + " is deleted";
    }

    private void enrichWithPackageSessionDetails(List<LiveSessionListDTO> sessions) {
        if (sessions == null || sessions.isEmpty()) return;

        List<String> sessionIds = sessions.stream()
                .map(LiveSessionListDTO::getSessionId)
                .distinct()
                .collect(Collectors.toList());

        // Get batch (package_session) IDs for all sessions in one query
        List<LiveSessionParticipantRepository.SessionBatchProjection> batchMappings =
                liveSessionParticipantRepository.findBatchSourceIdsBySessionIds(sessionIds);

        // Group by sessionId
        Map<String, List<String>> sessionToBatchIds = batchMappings.stream()
                .collect(Collectors.groupingBy(
                        LiveSessionParticipantRepository.SessionBatchProjection::getSessionId,
                        Collectors.mapping(LiveSessionParticipantRepository.SessionBatchProjection::getSourceId, Collectors.toList())
                ));

        // Collect all unique package_session_ids
        List<String> allBatchIds = batchMappings.stream()
                .map(LiveSessionParticipantRepository.SessionBatchProjection::getSourceId)
                .distinct()
                .collect(Collectors.toList());

        if (allBatchIds.isEmpty()) return;

        // Resolve package session details in one query
        Map<String, PackageSessionRepository.PackageSessionDetailProjection> detailsMap =
                packageSessionRepository.findPackageSessionDetailsByIds(allBatchIds).stream()
                        .collect(Collectors.toMap(
                                PackageSessionRepository.PackageSessionDetailProjection::getPackageSessionId,
                                d -> d,
                                (a, b) -> a
                        ));

        // Enrich each session DTO
        for (LiveSessionListDTO session : sessions) {
            List<String> batchIds = sessionToBatchIds.get(session.getSessionId());
            if (batchIds != null && !batchIds.isEmpty()) {
                List<LiveSessionListDTO.PackageSessionInfo> details = batchIds.stream()
                        .map(detailsMap::get)
                        .filter(Objects::nonNull)
                        .map(d -> new LiveSessionListDTO.PackageSessionInfo(
                                d.getPackageSessionId(), d.getPackageName(), d.getLevelName(), d.getSessionName()))
                        .collect(Collectors.toList());
                session.setPackageSessionDetails(details);
            }
        }
    }

        private vacademy.io.admin_core_service.features.live_session.dto.LiveSessionStep1RequestDTO.LearnerButtonConfigDTO deserializeLearnerButtonConfig(
                        String json) {
                if (json == null)
                        return null;
                try {
                        return new com.fasterxml.jackson.databind.ObjectMapper().readValue(json,
                                        vacademy.io.admin_core_service.features.live_session.dto.LiveSessionStep1RequestDTO.LearnerButtonConfigDTO.class);
                } catch (Exception e) {
                        System.err.println("Error deserializing LearnerButtonConfig: " + e.getMessage());
                        return null;
                }
        }

}
