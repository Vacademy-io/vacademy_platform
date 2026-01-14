package vacademy.io.notification_service.features.analytics.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import vacademy.io.common.core.internal_api_wrapper.InternalClientUtils;
import vacademy.io.notification_service.features.analytics.dto.*;
import vacademy.io.notification_service.features.analytics.repository.NotificationTemplateDayMapRepository;
import vacademy.io.notification_service.features.combot.entity.ChannelToInstituteMapping;
import vacademy.io.notification_service.features.combot.repository.ChannelToInstituteMappingRepository;
import vacademy.io.notification_service.features.notification_log.repository.NotificationLogRepository;
import vacademy.io.common.exceptions.VacademyException;

import java.sql.Timestamp;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class DailyParticipationService {

    private final NotificationTemplateDayMapRepository templateDayMapRepository;
    private final NotificationLogRepository notificationLogRepository;
    private final ChannelToInstituteMappingRepository channelMappingRepository;
    private final InternalClientUtils internalClientUtils;
    private final ObjectMapper objectMapper;

    @Value("${admin.core.service.baseurl:http://admin-core-service:8072}")
    private String adminCoreServiceUrl;

    @Value("${spring.application.name:notification_service}")
    private String clientName;

    @org.springframework.cache.annotation.Cacheable(value = "dailyParticipation", key = "#instituteId + '_' + #startDate + '_' + #endDate")
    public DailyParticipationResponseDTO getDailyParticipation(
            String instituteId,
            Timestamp startDate,
            Timestamp endDate
    ) {
        log.info("Fetching daily participation for institute: {}", instituteId);

        // Convert Timestamp to String for repository queries
        String startDateStr = startDate != null ? startDate.toString() : "";
        String endDateStr = endDate != null ? endDate.toString() : "";

        // Fetch outgoing and incoming metrics
        List<Object[]> outgoingResults = templateDayMapRepository.getOutgoingMessageMetrics(
                instituteId, startDateStr, endDateStr);
        List<Object[]> incomingResults = templateDayMapRepository.getIncomingMessageMetrics(
                instituteId, startDateStr, endDateStr);

        // Fetch unique users per day (to avoid double-counting users who received multiple templates)
        List<Object[]> uniqueUsersOutgoing = templateDayMapRepository.getUniqueUsersPerDayOutgoing(
                instituteId, startDateStr, endDateStr);
        List<Object[]> uniqueUsersIncoming = templateDayMapRepository.getUniqueUsersPerDayIncoming(
                instituteId, startDateStr, endDateStr);

        // Get unique users who said "YES" on Day 2 (engagement confirmation metric)
        // This is configurable - change day number (2) and template ("YES") as needed
        Long totalUniqueResponders = templateDayMapRepository.getUniqueRespondersForDayAndTemplate(
                instituteId, startDateStr, endDateStr, 2, "YES");

        // Create maps for quick lookup: day_number -> unique_users_count
        Map<Integer, Long> uniqueUsersOutgoingMap = uniqueUsersOutgoing.stream()
                .collect(Collectors.toMap(
                        row -> (Integer) row[0],
                        row -> ((Number) row[1]).longValue()
                ));
        
        Map<Integer, Long> uniqueUsersIncomingMap = uniqueUsersIncoming.stream()
                .collect(Collectors.toMap(
                        row -> (Integer) row[0],
                        row -> ((Number) row[1]).longValue()
                ));

        log.info("Outgoing results: {}, Incoming results: {}", outgoingResults.size(), incomingResults.size());

        // Group outgoing and incoming separately by day_number
        Map<Integer, List<Object[]>> outgoingByDay = outgoingResults.stream()
                .collect(Collectors.groupingBy(row -> (Integer) row[0]));
        
        Map<Integer, List<Object[]>> incomingByDay = incomingResults.stream()
                .collect(Collectors.groupingBy(row -> (Integer) row[0]));

        // Build day participation list
        List<DayParticipationDTO> days = new ArrayList<>();
        long totalMessagesSent = 0;
        long totalMessagesReceived = 0;

        // Get all unique days
        Set<Integer> allDays = new TreeSet<>(outgoingByDay.keySet());
        allDays.addAll(incomingByDay.keySet());

        for (Integer dayNumber : allDays) {
            List<Object[]> dayOutgoingRows = outgoingByDay.getOrDefault(dayNumber, new ArrayList<>());
            List<Object[]> dayIncomingRows = incomingByDay.getOrDefault(dayNumber, new ArrayList<>());

            String dayLabel = "";
            
            // Process OUTGOING templates
            List<TemplateDataDTO> outgoingTemplates = new ArrayList<>();
            long dayOutgoingMessages = 0;
            
            for (Object[] row : dayOutgoingRows) {
                dayLabel = (String) row[1]; // day_label
                String templateId = (String) row[2];
                String subTemplateLabel = row[3] != null ? (String) row[3] : null;
                Long uniqueUsers = ((Number) row[4]).longValue();
                Long totalMessages = ((Number) row[5]).longValue();
                
                outgoingTemplates.add(TemplateDataDTO.builder()
                        .templateIdentifier(templateId)
                        .subTemplateLabel(subTemplateLabel)
                        .uniqueUsers(uniqueUsers)
                        .totalMessages(totalMessages)
                        .build());
                
                // Sum total messages only - unique users come from separate query
                dayOutgoingMessages += totalMessages;
            }

            // Get correct unique users count for this day (not summed from templates)
            long dayOutgoingUsers = uniqueUsersOutgoingMap.getOrDefault(dayNumber, 0L);

            // Process INCOMING templates (user responses)
            List<TemplateDataDTO> incomingTemplates = new ArrayList<>();
            long dayIncomingMessages = 0;
            
            for (Object[] row : dayIncomingRows) {
                if (dayLabel.isEmpty()) {
                    dayLabel = (String) row[1]; // day_label
                }
                String templateId = (String) row[2]; // This is the user response like "YES"
                String subTemplateLabel = row[3] != null ? (String) row[3] : null;
                Long uniqueUsers = ((Number) row[4]).longValue();
                Long totalMessages = ((Number) row[5]).longValue();
                
                incomingTemplates.add(TemplateDataDTO.builder()
                        .templateIdentifier(templateId)
                        .subTemplateLabel(subTemplateLabel)
                        .uniqueUsers(uniqueUsers)
                        .totalMessages(totalMessages)
                        .build());
                
                // Sum total messages only - unique users come from separate query
                dayIncomingMessages += totalMessages;
            }

            // Get correct unique users count for this day (not summed from templates)
            long dayIncomingUsers = uniqueUsersIncomingMap.getOrDefault(dayNumber, 0L);

            // Calculate day response rate
            Double dayResponseRate = dayOutgoingUsers > 0 
                    ? (dayIncomingUsers * 100.0) / dayOutgoingUsers 
                    : 0.0;
            dayResponseRate = Math.round(dayResponseRate * 10) / 10.0;

            DayParticipationDTO dayDto = DayParticipationDTO.builder()
                    .dayNumber(dayNumber)
                    .dayLabel(dayLabel)
                    .outgoing(OutgoingDataDTO.builder()
                            .uniqueUsers(dayOutgoingUsers)
                            .totalMessages(dayOutgoingMessages)
                            .templates(outgoingTemplates)
                            .build())
                    .incoming(IncomingDataDTO.builder()
                            .uniqueUsers(dayIncomingUsers)
                            .totalMessages(dayIncomingMessages)
                            .templates(incomingTemplates)
                            .build())
                    .responseRate(dayResponseRate)
                    .build();

            days.add(dayDto);

            // Aggregate overall totals
            totalMessagesSent += dayOutgoingMessages;
            totalMessagesReceived += dayIncomingMessages;
        }

        // Calculate overall unique users
        // Total reached = Unique users from Day 0 (entry point of the challenge)
        long totalUniqueUsersReached = uniqueUsersOutgoingMap.getOrDefault(0, 0L);
        
        // Total responded = Distinct users who responded at least once across ALL days
        long totalUniqueUsersResponded = totalUniqueResponders != null ? totalUniqueResponders : 0L;

        Double overallResponseRate = totalUniqueUsersReached > 0 
                ? (totalUniqueUsersResponded * 100.0) / totalUniqueUsersReached 
                : 0.0;
        overallResponseRate = Math.round(overallResponseRate * 10) / 10.0;

        // Build response
        DailyParticipationDataDTO participationData = DailyParticipationDataDTO.builder()
                .totalDays(allDays.size())
                .totalMessagesSent(totalMessagesSent)
                .totalMessagesReceived(totalMessagesReceived)
                .days(days)
                .summary(ParticipationSummaryDTO.builder()
                        .totalUniqueUsersReached(totalUniqueUsersReached)
                        .totalUniqueUsersResponded(totalUniqueUsersResponded)
                        .overallResponseRate(overallResponseRate)
                        .build())
                .build();

        return DailyParticipationResponseDTO.builder()
                .instituteId(instituteId)
                .dateRange(DateRangeDTO.builder()
                        .startDate(startDate != null ? startDate.toString() : null)
                        .endDate(endDate != null ? endDate.toString() : null)
                        .build())
                .dailyParticipation(participationData)
                .build();
    }

    /**
     * Get Engagement Leaderboard - Feature 7
     * Cached for 5 minutes
     */
    @org.springframework.cache.annotation.Cacheable(value = "engagementLeaderboard", key = "#instituteId + '_' + #startDate + '_' + #endDate + '_' + #page + '_' + #pageSize")
    public EngagementLeaderboardResponseDTO getEngagementLeaderboard(
            String instituteId,
            Timestamp startDate,
            Timestamp endDate,
            Integer page,
            Integer pageSize
    ) {
        log.info("Fetching engagement leaderboard for institute: {}, page: {}, pageSize: {}", 
                instituteId, page, pageSize);

        // Step 1: Resolve channel ID from institute ID
        String channelId = getChannelIdByInstituteId(instituteId);
        
        // Step 2: Calculate pagination
        int offset = (page - 1) * pageSize;
        String startDateStr = startDate != null ? startDate.toString() : "";
        String endDateStr = endDate != null ? endDate.toString() : "";

        // Step 3: Fetch leaderboard data
        List<Object[]> results = notificationLogRepository.getEngagementLeaderboard(
                channelId, startDateStr, endDateStr, pageSize, offset);
        
        Long totalUsers = notificationLogRepository.getTotalEngagedUsers(
                channelId, startDateStr, endDateStr);

        // Step 4: Extract phone numbers
        List<String> phoneNumbers = results.stream()
                .map(row -> (String) row[1]) // channel_id is phone number
                .collect(Collectors.toList());

        // Step 5: Fetch user details from admin_core_service
        Map<String, UserWithCustomFieldsDTO> userDetailsMap = fetchUserDetailsByPhones(phoneNumbers);

        // Step 6: Build leaderboard entries
        List<LeaderboardEntryDTO> leaderboard = new ArrayList<>();
        int rank = offset + 1;
        
        for (Object[] row : results) {
            String userId = (String) row[0];
            String phoneNumber = (String) row[1];
            Long outgoingCount = ((Number) row[2]).longValue();
            Long incomingCount = ((Number) row[3]).longValue();
            Long totalMessages = ((Number) row[4]).longValue();

            LeaderboardEntryDTO entry = LeaderboardEntryDTO.builder()
                    .rank(rank++)
                    .phoneNumber(phoneNumber)
                    .engagementMetrics(EngagementMetricsDTO.builder()
                            .totalMessages(totalMessages)
                            .outgoingMessages(outgoingCount)
                            .incomingMessages(incomingCount)
                            .engagementScore(totalMessages) // Can be customized
                            .build())
                    .userDetails(userDetailsMap.get(phoneNumber))
                    .build();
            
            leaderboard.add(entry);
        }

        // Step 7: Build pagination
        int totalPages = (int) Math.ceil((double) totalUsers / pageSize);
        
        PaginationDTO pagination = PaginationDTO.builder()
                .currentPage(page)
                .pageSize(pageSize)
                .totalUsers(totalUsers)
                .totalPages(totalPages)
                .build();

        return EngagementLeaderboardResponseDTO.builder()
                .instituteId(instituteId)
                .dateRange(DateRangeDTO.builder()
                        .startDate(startDateStr)
                        .endDate(endDateStr)
                        .build())
                .pagination(pagination)
                .leaderboard(leaderboard)
                .build();
    }

    /**
     * Get Completion Cohort - Feature 8
     * Cached for 5 minutes
     */
    @org.springframework.cache.annotation.Cacheable(value = "completionCohort", key = "#instituteId + '_' + #completionTemplateIdentifiers + '_' + #startDate + '_' + #endDate + '_' + #page + '_' + #pageSize")
    public CompletionCohortResponseDTO getCompletionCohort(
            String instituteId,
            List<String> completionTemplateIdentifiers,
            Timestamp startDate,
            Timestamp endDate,
            Integer page,
            Integer pageSize
    ) {
        log.info("Fetching completion cohort for institute: {}, templates: {}, page: {}, pageSize: {}", 
                instituteId, completionTemplateIdentifiers, page, pageSize);

        // Step 1: Resolve channel ID from institute ID
        String channelId = getChannelIdByInstituteId(instituteId);
        
        // Step 2: Calculate pagination
        int offset = (page - 1) * pageSize;
        String startDateStr = startDate != null ? startDate.toString() : "";
        String endDateStr = endDate != null ? endDate.toString() : "";

        // Step 3: Convert List to array for query
        String[] templateArray = completionTemplateIdentifiers.toArray(new String[0]);

        // Step 4: Fetch completion data
        List<Object[]> results = notificationLogRepository.getCompletionCohort(
                channelId, templateArray, startDateStr, endDateStr, pageSize, offset);
        
        Long totalCompleted = notificationLogRepository.getTotalCompletedUsers(
                channelId, templateArray, startDateStr, endDateStr);

        // Step 5: Extract phone numbers
        List<String> phoneNumbers = results.stream()
                .map(row -> (String) row[1]) // channel_id is phone number
                .collect(Collectors.toList());

        // Step 6: Fetch user details from admin_core_service
        Map<String, UserWithCustomFieldsDTO> userDetailsMap = fetchUserDetailsByPhones(phoneNumbers);

        // Step 7: Build completed users list
        List<CompletedUserDTO> completedUsers = new ArrayList<>();
        
        for (Object[] row : results) {
            String userId = (String) row[0];
            String phoneNumber = (String) row[1];
            Timestamp completionDate = (Timestamp) row[2];

            CompletedUserDTO user = CompletedUserDTO.builder()
                    .phoneNumber(phoneNumber)
                    .completionDate(completionDate)
                    .userDetails(userDetailsMap.get(phoneNumber))
                    .build();
            
            completedUsers.add(user);
        }

        // Step 8: Build pagination
        int totalPages = (int) Math.ceil((double) totalCompleted / pageSize);
        
        PaginationDTO pagination = PaginationDTO.builder()
                .currentPage(page)
                .pageSize(pageSize)
                .totalUsers(totalCompleted)
                .totalPages(totalPages)
                .build();

        // Step 9: Build summary
        CompletionSummaryDTO summary = CompletionSummaryDTO.builder()
                .totalCompletedUsers(totalCompleted)
                .completionTemplateIdentifiers(completionTemplateIdentifiers)
                .dateRange(DateRangeDTO.builder()
                        .startDate(startDateStr)
                        .endDate(endDateStr)
                        .build())
                .build();

        return CompletionCohortResponseDTO.builder()
                .instituteId(instituteId)
                .completionSummary(summary)
                .pagination(pagination)
                .completedUsers(completedUsers)
                .build();
    }

    /**
     * Helper: Get channel ID from institute ID
     */
    private String getChannelIdByInstituteId(String instituteId) {
        ChannelToInstituteMapping mapping = channelMappingRepository.findByInstituteId(instituteId)
                .orElseThrow(() -> new VacademyException("No channel mapping found for institute: " + instituteId));
        return mapping.getChannelId();
    }

    /**
     * Helper: Fetch user details from admin_core_service in batch
     */
    private Map<String, UserWithCustomFieldsDTO> fetchUserDetailsByPhones(List<String> phoneNumbers) {
        if (phoneNumbers.isEmpty()) {
            return new HashMap<>();
        }

        try {
            String route = "/admin-core-service/internal/users/by-phones";
            
            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("phoneNumbers", phoneNumbers);
            
            String requestBodyJson = objectMapper.writeValueAsString(requestBody);

            // Use InternalClientUtils to automatically add clientName and HMAC Signature headers
            ResponseEntity<String> response = internalClientUtils.makeHmacRequest(
                    clientName,
                    HttpMethod.POST.name(),
                    adminCoreServiceUrl,
                    route,
                    requestBodyJson
            );

            String body = response.getBody();
            if (body == null || body.isBlank()) {
                log.warn("No users returned from admin_core_service");
                return new HashMap<>();
            }

            // Parse JSON response directly to UserWithCustomFieldsDTO list
            List<UserWithCustomFieldsDTO> users = objectMapper.readValue(body, new TypeReference<List<UserWithCustomFieldsDTO>>() {});

            // Build map with phone number as key
            Map<String, UserWithCustomFieldsDTO> userMap = new HashMap<>();
            for (UserWithCustomFieldsDTO userWithFields : users) {
                if (userWithFields.getUser() != null && userWithFields.getUser().getMobileNumber() != null) {
                    userMap.put(userWithFields.getUser().getMobileNumber(), userWithFields);
                }
            }

            log.info("Fetched {} user details from admin_core_service", userMap.size());
            return userMap;

        } catch (Exception e) {
            log.error("Failed to fetch user details from admin_core_service", e);
            return new HashMap<>();
        }
    }

    /**
     * Get Outgoing Templates - List all outgoing template identifiers grouped by day
     * Cached for 10 minutes
     */
    @org.springframework.cache.annotation.Cacheable(value = "outgoingTemplates", key = "#instituteId")
    public TemplateIdentifiersResponseDTO getOutgoingTemplates(String instituteId) {
        log.info("Fetching outgoing templates for institute: {}", instituteId);

        // Fetch all template mappings from notification_template_day_map
        List<Object[]> results = templateDayMapRepository.getOutgoingTemplatesByInstitute(instituteId);

        // Group templates by day
        Map<Integer, List<String>> templatesByDay = new java.util.LinkedHashMap<>();
        Map<Integer, String> dayLabels = new java.util.HashMap<>();

        for (Object[] row : results) {
            Integer dayNumber = (Integer) row[0];
            String dayLabel = (String) row[1];
            String templateIdentifier = (String) row[2];

            dayLabels.put(dayNumber, dayLabel);
            templatesByDay.computeIfAbsent(dayNumber, k -> new ArrayList<>()).add(templateIdentifier);
        }

        // Build response
        List<DayTemplatesDTO> days = new ArrayList<>();
        for (Map.Entry<Integer, List<String>> entry : templatesByDay.entrySet()) {
            List<TemplateInfoDTO> templates = entry.getValue().stream()
                    .map(templateId -> TemplateInfoDTO.builder()
                            .templateIdentifier(templateId)
                            .build())
                    .collect(Collectors.toList());

            DayTemplatesDTO dayDto = DayTemplatesDTO.builder()
                    .dayNumber(entry.getKey())
                    .dayLabel(dayLabels.get(entry.getKey()))
                    .templates(templates)
                    .build();

            days.add(dayDto);
        }

        return TemplateIdentifiersResponseDTO.builder()
                .instituteId(instituteId)
                .days(days)
                .build();
    }
}

