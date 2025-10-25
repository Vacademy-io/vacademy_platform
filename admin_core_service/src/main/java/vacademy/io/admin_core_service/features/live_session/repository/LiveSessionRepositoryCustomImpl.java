package vacademy.io.admin_core_service.features.live_session.repository;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.Query;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Repository;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.live_session.dto.SessionSearchRequest;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Repository
public class LiveSessionRepositoryCustomImpl implements LiveSessionRepositoryCustom {

    @PersistenceContext
    private EntityManager entityManager;

    @Override
    public Page<LiveSessionRepository.LiveSessionListProjection> searchSessions(
            SessionSearchRequest request, Pageable pageable) {

        // Build dynamic query
        StringBuilder queryBuilder = new StringBuilder();
        StringBuilder countQueryBuilder = new StringBuilder();
        Map<String, Object> parameters = new HashMap<>();

        // Base query
        String baseSelect = """
            SELECT DISTINCT
                s.id AS sessionId,
                s.waiting_room_time AS waitingRoomTime,
                s.thumbnail_file_id AS thumbnailFileId,
                s.background_score_file_id AS backgroundScoreFileId,
                s.session_streaming_service_type AS sessionStreamingServiceType,
                ss.id AS scheduleId,
                ss.meeting_date AS meetingDate,
                ss.start_time AS startTime,
                ss.last_entry_time AS lastEntryTime,
                ss.recurrence_type AS recurrenceType,
                s.access_level AS accessLevel,
                s.title AS title,
                s.subject AS subject,
                s.registration_form_link_for_public_sessions AS registrationFormLinkForPublicSessions,
                s.allow_play_pause AS allowPlayPause,
                s.timezone AS timezone,
                CASE
                    WHEN ss.custom_meeting_link IS NOT NULL AND ss.custom_meeting_link <> '' THEN ss.custom_meeting_link
                    ELSE s.default_meet_link
                END AS meetingLink
            """;

        String baseFrom = """
            FROM live_session s
            JOIN session_schedules ss ON s.id = ss.session_id
            """;

        String countSelect = "SELECT COUNT(DISTINCT ss.id) ";

        queryBuilder.append(baseSelect).append(baseFrom);
        countQueryBuilder.append(countSelect).append(baseFrom);

        // Add LEFT JOIN for participants if filtering by batchIds or userIds
        if ((request.getBatchIds() != null && !request.getBatchIds().isEmpty()) ||
            (request.getUserIds() != null && !request.getUserIds().isEmpty())) {
            String participantJoin = "LEFT JOIN live_session_participants lsp ON lsp.session_id = s.id ";
            queryBuilder.append(participantJoin);
            countQueryBuilder.append(participantJoin);
        }

        // WHERE clause
        List<String> conditions = new ArrayList<>();

        // Always filter: institute_id and ss.status != 'DELETED'
        conditions.add("s.institute_id = :instituteId");
        parameters.put("instituteId", request.getInstituteId());

        conditions.add("ss.status != 'DELETED'");

        // Status filter (default: exclude DELETED from live_session)
        if (request.getStatuses() != null && !request.getStatuses().isEmpty()) {
            conditions.add("s.status IN :statuses");
            parameters.put("statuses", request.getStatuses());
        } else {
            // Default: show LIVE and DRAFT only
            conditions.add("s.status IN ('LIVE', 'DRAFT')");
        }

        // Session IDs filter
        if (request.getSessionIds() != null && !request.getSessionIds().isEmpty()) {
            conditions.add("s.id IN :sessionIds");
            parameters.put("sessionIds", request.getSessionIds());
        }

        // Date range filter with smart defaults
        LocalDate startDate = request.getStartDate();
        LocalDate endDate = request.getEndDate();

        // Apply smart date defaults if not provided
        if (startDate == null && endDate == null) {
            // Determine if we're looking at past or future sessions based on status
            List<String> statuses = request.getStatuses();
            if (statuses != null && !statuses.isEmpty()) {
                boolean hasLive = statuses.stream().anyMatch(s -> s.equalsIgnoreCase("LIVE"));
                boolean hasDraft = statuses.stream().anyMatch(s -> s.equalsIgnoreCase("DRAFT"));
                
                if (hasLive || hasDraft) {
                    // Upcoming: show next month
                    startDate = LocalDate.now();
                    endDate = LocalDate.now().plusMonths(1);
                }
            } else {
                // Default behavior: show next month for upcoming sessions
                startDate = LocalDate.now();
                endDate = LocalDate.now().plusMonths(1);
            }
        }

        if (startDate != null) {
            conditions.add("ss.meeting_date >= :startDate");
            parameters.put("startDate", java.sql.Date.valueOf(startDate));
        }

        if (endDate != null) {
            conditions.add("ss.meeting_date <= :endDate");
            parameters.put("endDate", java.sql.Date.valueOf(endDate));
        }

        // Time of day filter
        if (request.getStartTimeOfDay() != null) {
            conditions.add("ss.start_time >= :startTimeOfDay");
            parameters.put("startTimeOfDay", java.sql.Time.valueOf(request.getStartTimeOfDay()));
        }

        if (request.getEndTimeOfDay() != null) {
            conditions.add("ss.start_time <= :endTimeOfDay");
            parameters.put("endTimeOfDay", java.sql.Time.valueOf(request.getEndTimeOfDay()));
        }

        // Recurrence types filter
        if (request.getRecurrenceTypes() != null && !request.getRecurrenceTypes().isEmpty()) {
            conditions.add("ss.recurrence_type IN :recurrenceTypes");
            parameters.put("recurrenceTypes", request.getRecurrenceTypes());
        }

        // Access levels filter
        if (request.getAccessLevels() != null && !request.getAccessLevels().isEmpty()) {
            conditions.add("s.access_level IN :accessLevels");
            parameters.put("accessLevels", request.getAccessLevels());
        }

        // Timezone filter
        if (request.getTimezones() != null && !request.getTimezones().isEmpty()) {
            conditions.add("s.timezone IN :timezones");
            parameters.put("timezones", request.getTimezones());
        }

        // Streaming service types filter
        if (request.getStreamingServiceTypes() != null && !request.getStreamingServiceTypes().isEmpty()) {
            conditions.add("s.session_streaming_service_type IN :streamingServiceTypes");
            parameters.put("streamingServiceTypes", request.getStreamingServiceTypes());
        }

        // Schedule IDs filter
        if (request.getScheduleIds() != null && !request.getScheduleIds().isEmpty()) {
            conditions.add("ss.id IN :scheduleIds");
            parameters.put("scheduleIds", request.getScheduleIds());
        }

        // Batch IDs filter
        if (request.getBatchIds() != null && !request.getBatchIds().isEmpty()) {
            conditions.add("lsp.source_type = 'BATCH' AND lsp.source_id IN :batchIds");
            parameters.put("batchIds", request.getBatchIds());
        }

        // User IDs filter
        if (request.getUserIds() != null && !request.getUserIds().isEmpty()) {
            conditions.add("lsp.source_type = 'USER' AND lsp.source_id IN :userIds");
            parameters.put("userIds", request.getUserIds());
        }

        // Search query filter (title or subject)
        if (StringUtils.hasText(request.getSearchQuery())) {
            conditions.add("(LOWER(s.title) LIKE :searchQuery OR LOWER(s.subject) LIKE :searchQuery)");
            parameters.put("searchQuery", "%" + request.getSearchQuery().toLowerCase() + "%");
        }

        // Append WHERE clause
        if (!conditions.isEmpty()) {
            String whereClause = " WHERE " + String.join(" AND ", conditions);
            queryBuilder.append(whereClause);
            countQueryBuilder.append(whereClause);
        }

        // ORDER BY
        String orderBy = buildOrderByClause(request);
        queryBuilder.append(orderBy);

        // Execute count query
        Query countQuery = entityManager.createNativeQuery(countQueryBuilder.toString());
        setQueryParameters(countQuery, parameters);
        Long totalCount = ((Number) countQuery.getSingleResult()).longValue();

        // Execute data query with pagination
        Query dataQuery = entityManager.createNativeQuery(queryBuilder.toString(), "LiveSessionListProjectionMapping");
        setQueryParameters(dataQuery, parameters);
        dataQuery.setFirstResult((int) pageable.getOffset());
        dataQuery.setMaxResults(pageable.getPageSize());

        @SuppressWarnings("unchecked")
        List<LiveSessionRepository.LiveSessionListProjection> results = dataQuery.getResultList();

        return new PageImpl<>(results, pageable, totalCount);
    }

    private String buildOrderByClause(SessionSearchRequest request) {
        String sortBy = request.getSortBy() != null ? request.getSortBy() : "meetingDate";
        String sortDirection = request.getSortDirection() != null ? request.getSortDirection() : "ASC";

        // Map sortBy to actual column names
        String column = switch (sortBy.toLowerCase()) {
            case "meetingdate" -> "ss.meeting_date";
            case "starttime" -> "ss.start_time";
            case "title" -> "s.title";
            case "createdat" -> "s.created_at";
            default -> "ss.meeting_date";
        };

        // Add secondary sort by start_time if primary is not time-related
        if (column.equals("ss.meeting_date")) {
            return String.format(" ORDER BY %s %s, ss.start_time %s", column, sortDirection, sortDirection);
        } else {
            return String.format(" ORDER BY %s %s", column, sortDirection);
        }
    }

    private void setQueryParameters(Query query, Map<String, Object> parameters) {
        for (Map.Entry<String, Object> entry : parameters.entrySet()) {
            query.setParameter(entry.getKey(), entry.getValue());
        }
    }
}

