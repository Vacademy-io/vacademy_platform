package vacademy.io.admin_core_service.features.workflow.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.audience.entity.AudienceResponse;
import vacademy.io.admin_core_service.features.audience.repository.AudienceResponseRepository;
import vacademy.io.admin_core_service.features.common.entity.CustomFields;
import vacademy.io.admin_core_service.features.common.repository.CustomFieldRepository;
import vacademy.io.admin_core_service.features.institute.service.setting.InstituteSettingService;
import vacademy.io.admin_core_service.features.institute_learner.entity.StudentSessionInstituteGroupMapping;
import vacademy.io.admin_core_service.features.institute_learner.enums.LearnerStatusEnum;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionInstituteGroupMappingRepository;
import vacademy.io.admin_core_service.features.packages.repository.PackageRepository;
import vacademy.io.admin_core_service.features.workflow.engine.QueryNodeHandler;
import vacademy.io.admin_core_service.features.common.repository.CustomFieldValuesRepository;
import vacademy.io.admin_core_service.features.common.entity.CustomFieldValues;
import vacademy.io.admin_core_service.features.live_session.repository.SessionScheduleRepository;
import vacademy.io.admin_core_service.features.live_session.repository.LiveSessionParticipantRepository;
import vacademy.io.admin_core_service.features.live_session.entity.SessionSchedule;
import vacademy.io.admin_core_service.features.live_session.entity.LiveSessionParticipants;
import vacademy.io.admin_core_service.features.live_session.repository.LiveSessionRepository;
import vacademy.io.admin_core_service.features.live_session.entity.LiveSession;
import vacademy.io.common.institute.entity.PackageEntity;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;

import java.sql.Timestamp;
import java.sql.Time;
import java.util.*;
import java.util.stream.Collectors;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;

@Slf4j
@Service
@RequiredArgsConstructor
public class QueryServiceImpl implements QueryNodeHandler.QueryService {

    private final StudentSessionInstituteGroupMappingRepository ssigmRepo;
    private final CustomFieldValuesRepository customFieldValuesRepository;
    private final SessionScheduleRepository sessionScheduleRepository;
    private final LiveSessionParticipantRepository liveSessionParticipantRepository;
    private final LiveSessionRepository liveSessionRepository;
    private final InstituteSettingService instituteSettingService;
    private final AudienceResponseRepository audienceResponseRepository;
    private final CustomFieldRepository customFieldRepository;
    private final PackageRepository packageRepository;
    private final ObjectMapper objectMapper;

    @Override
    public Map<String, Object> execute(String prebuiltKey, Map<String, Object> params) {
        log.info("Executing query with key: {}, params: {}", prebuiltKey, params);

        switch (prebuiltKey) {
            case "fetch_ssigm_by_package":
                return fetchSSIGMByPackage(params);
            case "getSSIGMByStatusAndPackageSessionIds":
                return getSSIGMByStatusAndSessions(params);
            case "updateSSIGMRemaingDaysByOne":
                return updateSSIGMRemainingDaysByOne(params);
            case "createSessionSchedule":
                return createSessionSchedule(params);
            case "createSessionParticipent":
                return createSessionParticipent(params);
            case "createLiveSession":
                return createLiveSession(params);
            case "checkStudentIsPresentInPackageSession":
                return isAlreadyPresentInGivenPackageSession(params);
            case "fetchInstituteSetting":
                return fetchInstituteSetting(params);
            case "getAudienceResponsesByDayDifference":
                return getAudienceResponsesByDayDifference(params);
            case "fetchPackageLMSSetting":
                return fetchPackageLMSSetting(params);
            default:
                log.warn("Unknown prebuilt query key: {}", prebuiltKey);
                return Map.of("error", "Unknown query key: " + prebuiltKey);
        }
    }

    private Map<String, Object> fetchSSIGMByPackage(Map<String, Object> params) {
        try {
            List<String> packageSessionIds = (List<String>) params.get("package_session_ids");
            List<String> statusList = (List<String>) params.get("status_list");

            if (packageSessionIds == null || statusList == null) {
                return Map.of("error", "Missing required parameters");
            }

            List<Object[]> rows = ssigmRepo.findMappingsWithStudentContacts(packageSessionIds, statusList);
            List<Map<String, Object>> ssigmList = new ArrayList<>();

            for (Object[] row : rows) {
                Map<String, Object> mapping = new HashMap<>();
                mapping.put("mapping_id", String.valueOf(row[0]));
                mapping.put("user_id", String.valueOf(row[1]));
                mapping.put("expiry_date", (row[2] instanceof Timestamp ts) ? new Date(ts.getTime()) : row[2]);
                mapping.put("full_name", String.valueOf(row[3]));
                mapping.put("mobile_number", String.valueOf(row[4]));
                mapping.put("email", String.valueOf(row[5]));
                mapping.put("username", String.valueOf(row[6]));
                mapping.put("package_session_id", String.valueOf(row[7]));
                ssigmList.add(mapping);
            }

            return Map.of(
                    "ssigm_list", ssigmList,
                    "mapping_count", ssigmList.size());

        } catch (Exception e) {
            log.error("Error executing fetch_ssigm_by_package query", e);
            return Map.of("error", e.getMessage());
        }
    }

    // In QueryServiceImpl.java

    private Map<String, Object> getSSIGMByStatusAndSessions(Map<String, Object> params) {
        try {
            List<String> packageSessionIds = (List<String>) params.get("packageSessionIds");
            List<String> statusList = (List<String>) params.get("statusList");

            if (packageSessionIds == null || statusList == null) {
                return Map.of("error", "Missing required parameters");
            }

            List<Object[]> rows = ssigmRepo.findMappingsWithStudentContacts(packageSessionIds, statusList);
            List<Map<String, Object>> ssigmList = new ArrayList<>();

            for (Object[] row : rows) {
                Map<String, Object> mapping = new HashMap<>();

                mapping.put("ssigmId", String.valueOf(row[0]));
                mapping.put("userId", String.valueOf(row[1]));
                Date expiryDate = (row[2] instanceof Date d) ? d : null;
                mapping.put("expiryDate", expiryDate);
                mapping.put("name", String.valueOf(row[3]));
                mapping.put("mobileNumber", String.valueOf(row[4]));
                mapping.put("email", String.valueOf(row[5]));
                mapping.put("username", String.valueOf(row[6]));
                mapping.put("packageSessionId", String.valueOf(row[7]));

                // --- ENROLLED DATE SELECTION ---
                Date enrolledDate = (row[8] instanceof Date d) ? d : null;
                if (enrolledDate == null) {
                    enrolledDate = (row[9] instanceof Date d) ? d : null;
                }
                mapping.put("enrolledDate", enrolledDate);

                // --- EARNING DAY LOGIC ---
                long learningDay = 0;
                if (enrolledDate != null) {
                    // Convert enrolled date to midnight (12:00 AM) of that day
                    Calendar cal = Calendar.getInstance();
                    cal.setTime(enrolledDate);
                    cal.set(Calendar.HOUR_OF_DAY, 0);
                    cal.set(Calendar.MINUTE, 0);
                    cal.set(Calendar.SECOND, 0);
                    cal.set(Calendar.MILLISECOND, 0);
                    Date startOfDay = cal.getTime();

                    long diffInMillis = System.currentTimeMillis() - startOfDay.getTime();
                    learningDay = (diffInMillis / (1000 * 60 * 60 * 24)) + 1; // Add 1 for inclusive day count
                }
                mapping.put("learningDay", learningDay);

                // --- REMAINING DAYS ---
                long remainingDays = calculateRemainingDays(String.valueOf(row[0]), expiryDate);
                mapping.put("remainingDays", remainingDays);

                ssigmList.add(mapping);
            }

            return Map.of(
                    "ssigmList", ssigmList,
                    "ssigmListCount", ssigmList.size());

        } catch (Exception e) {
            log.error("Error executing getSSIGMByStatusAndSessions query", e);
            return Map.of("error", e.getMessage());
        }
    }

    /**
     * Calculate remaining days prioritizing custom field value, with date-based
     * fallback
     */
    private long calculateRemainingDays(String ssigmId, Date endDate) {
        try {
            // First, try to get remaining days from custom field values
            Optional<CustomFieldValues> customFieldValue = customFieldValuesRepository
                    .findBySourceIdAndFieldKeyAndSourceType(ssigmId, "remaining_days",
                            "STUDENT_SESSION_INSTITUTE_GROUP_MAPPING");

            if (customFieldValue.isPresent()) {
                try {
                    String value = customFieldValue.get().getValue();
                    if (value != null && !value.trim().isEmpty()) {
                        long remainingDays = Long.parseLong(value.trim());
                        log.debug("Found remaining_days in custom field for SSIGM {}: {}", ssigmId, remainingDays);
                        return remainingDays;
                    }
                } catch (NumberFormatException e) {
                    log.warn("Invalid remaining_days value in custom field for SSIGM {}: {}", ssigmId,
                            customFieldValue.get().getValue());
                }
            }

            // Fallback to date-based calculation
            log.debug("No valid custom field value found for SSIGM {}, using date-based calculation", ssigmId);
            Date startDate = new Date();

            if (endDate == null) {
                return 9999;
            }

            // Truncate both to midnight
            Calendar startCal = Calendar.getInstance();
            startCal.setTime(startDate);
            startCal.set(Calendar.HOUR_OF_DAY, 0);
            startCal.set(Calendar.MINUTE, 0);
            startCal.set(Calendar.SECOND, 0);
            startCal.set(Calendar.MILLISECOND, 0);

            Calendar endCal = Calendar.getInstance();
            endCal.setTime(endDate);
            endCal.set(Calendar.HOUR_OF_DAY, 0);
            endCal.set(Calendar.MINUTE, 0);
            endCal.set(Calendar.SECOND, 0);
            endCal.set(Calendar.MILLISECOND, 0);

            long diffMillis = endCal.getTimeInMillis() - startCal.getTimeInMillis();
            long remainingDays = (diffMillis / (1000 * 60 * 60 * 24)) + 1; // include today

            return Math.max(remainingDays, 0);
        } catch (Exception e) {
            log.error("Error calculating remaining days for SSIGM: {}", ssigmId, e);
            // Ultimate fallback
            return endDate != null ? 0 : 9999;
        }
    }

    private Map<String, Object> updateSSIGMRemainingDaysByOne(Map<String, Object> params) {
        try {
            Map<String, Object> mappingData = (Map<String, Object>) params.get("ssigm");
            if (mappingData == null) {
                return Map.of("error", "Missing ssigm data");
            }

            String ssigmId = String.valueOf(mappingData.get("ssigmId"));
            Object remainingObj = mappingData.getOrDefault("remainingDays", 9999);
            long remainingDays;

            if (remainingObj instanceof Number num) {
                remainingDays = num.longValue() - 1;
            } else {
                remainingDays = 9999;
            }

            if (remainingDays < 0) {
                remainingDays = -1; // prevent negatives
            }

            // Update the mapping data
            mappingData.put("remainingDays", remainingDays);

            // Try to update custom field value if it exists
            try {
                Optional<CustomFieldValues> customFieldValue = customFieldValuesRepository
                        .findBySourceIdAndFieldKeyAndSourceType(ssigmId, "remaining_days", "SSIGM");

                if (customFieldValue.isPresent()) {
                    CustomFieldValues cfv = customFieldValue.get();
                    cfv.setValue(String.valueOf(remainingDays));
                    customFieldValuesRepository.save(cfv);
                    log.debug("Updated remaining_days custom field value for SSIGM {} to {}", ssigmId, remainingDays);
                } else {
                    log.debug("No custom field found for remaining_days on SSIGM {}, skipping custom field update",
                            ssigmId);
                }
            } catch (Exception e) {
                log.warn("Failed to update custom field value for SSIGM {}: {}", ssigmId, e.getMessage());
                // Continue with the workflow even if custom field update fails
            }

            return Map.of("ssigm", mappingData);
        } catch (Exception e) {
            log.error("Error in updateSSIGMRemainingDaysByOne", e);
            return Map.of("error", e.getMessage());
        }
    }

    /**
     * Creates a session schedule for a live session. This method is designed to be
     * called from Iterator workflow nodes.
     *
     * @param params Map containing:
     *               - sessionId: String - The session ID (ssigmId from context)
     *               - recurrenceType: String - Recurrence type for the schedule
     *               - meetingDate: String/Date - Meeting date
     *               - startTime: String/Time - Start time
     *               - lastEntryTime: String/Time - Last entry time
     *               - linkType: String - Link type
     *               - customMeetingLink: String - Custom meeting link
     *               - status: String - Schedule status
     *               - dailyAttendance: Boolean - Daily attendance flag
     * @return Map with operation result and created schedule
     */
    private Map<String, Object> createSessionSchedule(Map<String, Object> params) {
        try {
            String sessionId = (String) params.get("sessionId");
            String recurrenceType = (String) params.get("recurrenceType");
            Object meetingDateObj = params.get("meetingDate");
            Object startTimeObj = params.get("startTime");
            Object lastEntryTimeObj = params.get("lastEntryTime");
            String linkType = (String) params.get("linkType");
            String customMeetingLink = (String) params.get("customMeetingLink");
            String status = (String) params.get("status");
            Object dailyAttendanceObj = params.get("dailyAttendance");

            if (sessionId == null) {
                return Map.of("error", "Missing required parameter: sessionId");
            }

            log.info("Creating session schedule for session: {}", sessionId);

            // Parse meeting date - use the value from params
            Date meetingDate = null;
            if (meetingDateObj != null) {
                if (meetingDateObj instanceof Date date) {
                    meetingDate = date;
                } else if (meetingDateObj instanceof String string) {
                    try {
                        meetingDate = java.sql.Date.valueOf(string);
                    } catch (IllegalArgumentException e) {
                        log.warn("Invalid date format: {}", meetingDateObj);
                        return Map.of("error", "Invalid date format: " + meetingDateObj);
                    }
                }
            }

            // Parse start time - use the value from params
            Time startTime = null;
            if (startTimeObj != null) {
                if (startTimeObj instanceof Time time) {
                    startTime = time;
                } else if (startTimeObj instanceof String string) {
                    try {
                        startTime = Time.valueOf(string);
                    } catch (IllegalArgumentException e) {
                        log.warn("Invalid time format: {}", startTimeObj);
                        return Map.of("error", "Invalid time format: " + startTimeObj);
                    }
                }
            }

            // Parse last entry time - use the value from params
            Time lastEntryTime = null;
            if (lastEntryTimeObj != null) {
                if (lastEntryTimeObj instanceof Time time) {
                    lastEntryTime = time;
                } else if (lastEntryTimeObj instanceof String string) {
                    try {
                        lastEntryTime = Time.valueOf(string);
                    } catch (IllegalArgumentException e) {
                        log.warn("Invalid time format: {}", lastEntryTimeObj);
                        return Map.of("error", "Invalid time format: " + lastEntryTimeObj);
                    }
                }
            }

            // Parse daily attendance - use the value from params
            Boolean dailyAttendance = null;
            if (dailyAttendanceObj != null) {
                if (dailyAttendanceObj instanceof Boolean booleanValue) {
                    dailyAttendance = booleanValue;
                } else if (dailyAttendanceObj instanceof String string) {
                    dailyAttendance = Boolean.parseBoolean(string);
                }
            }

            // Create session schedule using only the values from params
            SessionSchedule schedule = SessionSchedule.builder()
                    .sessionId(sessionId)
                    .recurrenceType(recurrenceType)
                    .meetingDate(meetingDate)
                    .startTime(startTime)
                    .lastEntryTime(lastEntryTime)
                    .linkType(linkType)
                    .customMeetingLink(customMeetingLink)
                    .customWaitingRoomMediaId(null)
                    .status(status)
                    .thumbnailFileId(null)
                    .dailyAttendance(dailyAttendance != null ? dailyAttendance : false)
                    .build();

            // Save the schedule
            SessionSchedule savedSchedule = sessionScheduleRepository.save(schedule);

            log.info("Successfully created session schedule: {} for session: {}", savedSchedule.getId(), sessionId);

            return Map.of(
                    "SESSION_SCHEDULE", "SUCCEESS");

        } catch (Exception e) {
            log.error("Error creating session schedule", e);
            return Map.of(
                    "error", "Failed to create session schedule: " + e.getMessage(),
                    "success", false);
        }
    }

    /**
     * Creates a session participant for a live session. This method is designed to
     * be called from Iterator workflow nodes.
     *
     * @param params Map containing:
     *               - sourceId: String - The user ID (userId from context)
     *               - sourceType: String - Source type (usually "USER")
     *               - sessionId: String - The session ID
     * @return Map with operation result and created participant
     */
    private Map<String, Object> createSessionParticipent(Map<String, Object> params) {
        try {
            String sourceId = (String) params.get("sourceId");
            String sourceType = (String) params.getOrDefault("sourceType", "USER");
            String sessionId = (String) params.get("sessionId");

            if (sourceId == null || sessionId == null || sessionId.isEmpty()) {
                return Map.of("error", "Missing required parameters: sourceId and sessionId are required");
            }
            log.info("Creating session participant for user: {} in session: {}", sourceId, sessionId);

            // Check if participant already exists
            Optional<LiveSessionParticipants> existingParticipant = liveSessionParticipantRepository
                    .findBySessionId(sessionId)
                    .stream()
                    .filter(p -> sourceType.equals(p.getSourceType()) && sourceId.equals(p.getSourceId()))
                    .findFirst();

            if (existingParticipant.isPresent()) {
                log.info("Participant already exists for user {} in session {}", sourceId, sessionId);
                LiveSessionParticipants existing = existingParticipant.get();

                return Map.of(
                        "participant", Map.of(
                                "id", existing.getId(),
                                "sourceId", existing.getSourceId(),
                                "sourceType", existing.getSourceType(),
                                "sessionId", existing.getSessionId()),
                        "message", "Participant already exists",
                        "success", true);
            }

            // Create new participant
            LiveSessionParticipants participant = LiveSessionParticipants.builder()
                    .sessionId(sessionId)
                    .sourceType(sourceType)
                    .sourceId(sourceId)
                    .build();

            LiveSessionParticipants savedParticipant = liveSessionParticipantRepository.save(participant);

            log.info("Successfully created session participant: {} for user: {} in session: {}",
                    savedParticipant.getId(), sourceId, sessionId);

            return Map.of(
                    "participant", Map.of(
                            "id", savedParticipant.getId(),
                            "sourceId", savedParticipant.getSourceId(),
                            "sourceType", savedParticipant.getSourceType(),
                            "sessionId", savedParticipant.getSessionId()),
                    "message", "Participant created successfully",
                    "success", true);

        } catch (Exception e) {
            log.error("Error creating session participant", e);
            return Map.of(
                    "error", "Failed to create session participant: " + e.getMessage(),
                    "success", false);
        }
    }

    /**
     * Creates a live session based on the provided parameters. This method is
     * designed to be
     * called from workflow nodes and handles all the parameters shown in the
     * debugger screenshot.
     *
     * @param params Map containing live session parameters from the workflow
     *               context
     * @return Map with operation result and created session details
     */
    private Map<String, Object> createLiveSession(Map<String, Object> params) {
        try {
            log.info("Creating live session with params: {}", params);

            // Extract and validate required parameters
            String instituteId = (String) params.get("instituteId");
            String title = (String) params.get("title");
            String status = (String) params.get("status");
            String timezone = (String) params.get("timezone"); // Added timezone

            if (instituteId == null || title == null) {
                return Map.of("error", "Missing required parameters: instituteId and title are required");
            }

            // Parse ZonedDateTime fields
            Timestamp startTime = parseZonedDateTime(params.get("startTime"));
            Timestamp lastEntryTime = parseZonedDateTime(params.get("lastEntryTime"));

            // Parse Boolean fields with proper handling
            Boolean allowPlayPause = parseBoolean(params.get("allowPlayPause"));
            Boolean allowRewind = parseBoolean(params.get("allowRewind"));

            // Parse Integer fields
            Integer waitingRoomTime = parseInteger(params.get("waitingRoomTime"));

            // Create the LiveSession entity
            LiveSession liveSession = LiveSession.builder()
                    .instituteId(instituteId)
                    .title(title)
                    .status(status != null ? status : "DRAFT")
                    .startTime(startTime)
                    .lastEntryTime(lastEntryTime)
                    .timezone(timezone) // Added timezone
                    .accessLevel((String) params.get("accessLevel"))
                    .meetingType((String) params.get("meetingType"))
                    .defaultMeetLink((String) params.get("defaultMeetLink"))
                    .linkType((String) params.get("linkType"))
                    .waitingRoomLink((String) params.get("waitingRoomLink"))
                    .registrationFormLinkForPublicSessions((String) params.get("registrationFormLinkForPublicSessions"))
                    .createdByUserId((String) params.get("createdByUserId")) // Note: keeping original typo from params
                    .descriptionHtml((String) params.get("descriptionHtml"))
                    .notificationEmailMessage((String) params.get("notificationEmailMessage"))
                    .attendanceEmailMessage((String) params.get("attendanceEmailMessage"))
                    .coverFileId((String) params.get("coverFileId"))
                    .subject((String) params.get("subject"))
                    .waitingRoomTime(waitingRoomTime)
                    .thumbnailFileId((String) params.get("thumbnailFileId"))
                    .backgroundScoreFileId((String) params.get("backgroundScoreFileId"))
                    .allowRewind(allowRewind)
                    .sessionStreamingServiceType((String) params.get("sessionStreamingServiceType"))
                    .allowPlayPause(allowPlayPause != null ? allowPlayPause : false)
                    .build();

            // Save the live session
            LiveSession savedSession = liveSessionRepository.save(liveSession);

            log.info("Successfully created live session: {} with title: {}", savedSession.getId(), title);
            params.put("sessionId", savedSession.getId());
            return Map.of(
                    "success", true,
                    "sessionId", savedSession.getId(),
                    "message", "Live session created successfully",
                    "session", Map.of(
                            "id", savedSession.getId(),
                            "title", savedSession.getTitle(),
                            "status", savedSession.getStatus(),
                            "instituteId", savedSession.getInstituteId()));

        } catch (Exception e) {
            log.error("Error creating live session", e);
            return Map.of(
                    "error", "Failed to create live session: " + e.getMessage(),
                    "success", false);
        }
    }

    /**
     * Helper method to parse ZonedDateTime from various input types
     */
    private Timestamp parseZonedDateTime(Object dateTimeObj) {
        if (dateTimeObj == null) {
            return null;
        }

        try {
            if (dateTimeObj instanceof ZonedDateTime zdt) {
                return Timestamp.from(zdt.toInstant());
            } else if (dateTimeObj instanceof String str) {
                // Handle ISO 8601 format like "2025-09-08T05:00+01:00[Europe/London]"
                ZonedDateTime zdt = ZonedDateTime.parse(str, DateTimeFormatter.ISO_ZONED_DATE_TIME);
                return Timestamp.from(zdt.toInstant());
            } else if (dateTimeObj instanceof Timestamp ts) {
                return ts;
            }
        } catch (Exception e) {
            log.warn("Failed to parse date/time: {}", dateTimeObj, e);
        }

        return null;
    }

    /**
     * Helper method to parse Boolean from various input types
     */
    private Boolean parseBoolean(Object boolObj) {
        if (boolObj == null) {
            return null;
        }

        if (boolObj instanceof Boolean bool) {
            return bool;
        } else if (boolObj instanceof String str) {
            return Boolean.parseBoolean(str);
        }

        return null;
    }

    /**
     * Helper method to parse Integer from various input types
     */
    private Integer parseInteger(Object intObj) {
        if (intObj == null) {
            return null;
        }

        if (intObj instanceof Integer intVal) {
            return intVal;
        } else if (intObj instanceof Number num) {
            return num.intValue();
        } else if (intObj instanceof String str) {
            try {
                return Integer.parseInt(str);
            } catch (NumberFormatException e) {
                log.warn("Failed to parse integer: {}", str);
            }
        }

        return null;
    }

    private Map<String, Object> isAlreadyPresentInGivenPackageSession(Map<String, Object> params) {
        // This query finds if an active mapping exists for the user in the specified
        // package.
        Optional<StudentSessionInstituteGroupMapping> optionalStudentSessionInstituteGroupMapping = ssigmRepo
                .findByUserIdAndStatusInAndPackageSessionId(
                        (String) params.get("userId"),
                        List.of(LearnerStatusEnum.ACTIVE.name()),
                        (String) params.get("packageSessionId"));

        // If the optional has a value, it means the mapping exists.
        if (optionalStudentSessionInstituteGroupMapping.isPresent()) {
            // Return a map indicating the student is already a member.
            return Map.of("isAlreadyPresentInPackageSession", true);
        } else {
            // Otherwise, the student is not a member in this package.
            // Return a map indicating they are not a member.
            return Map.of("isAlreadyPresentInPackageSession", false);
        }
    }

    private Map<String, Object> getAudienceResponsesByDayDifference(Map<String, Object> params) {
        String instituteId = (String) params.get("instituteId");
        String audienceIdParam = (String) params.get("audienceId"); // Renamed to denote it can be multiple
        Integer daysAgo = (Integer) params.get("daysAgo");

        // Validate all required params
        if (instituteId == null || daysAgo == null || audienceIdParam == null) {
            throw new RuntimeException("Missing parameters: instituteId, audienceId, or daysAgo");
        }

        // 1. Calculate Date Range (Yesterday 00:00 to 23:59)
        LocalDateTime startLocal = LocalDateTime.now().minusDays(daysAgo).with(LocalTime.MIN);
        LocalDateTime endLocal = LocalDateTime.now().minusDays(daysAgo).with(LocalTime.MAX);

        Timestamp startDate = Timestamp.valueOf(startLocal);
        Timestamp endDate = Timestamp.valueOf(endLocal);

        // 2. Fetch Leads (Looping through comma-separated IDs)
        List<AudienceResponse> responses = new ArrayList<>();

        // Split by comma and trim whitespace (works for "id1, id2" and just "id1")
        String[] audienceIds = audienceIdParam.split(",");

        for (String aId : audienceIds) {
            if (aId != null && !aId.trim().isEmpty()) {
                List<AudienceResponse> audienceResponses = audienceResponseRepository.findLeadsByAudienceAndDateRange(
                        instituteId, aId.trim(), startDate, endDate);
                responses.addAll(audienceResponses);
            }
        }

        if (responses.isEmpty()) {
            return Map.of("leads", Collections.emptyList());
        }

        // --- START CUSTOM FIELD FETCHING LOGIC (Unchanged & Efficient) ---
        // Since 'responses' now contains leads from ALL audiences, this bulk fetch works perfectly.

        // 3. Extract Response IDs to bulk fetch values
        List<String> responseIds = responses.stream().map(AudienceResponse::getId).toList();

        // 4. Fetch Custom Field Values
        List<CustomFieldValues> cfValues = customFieldValuesRepository.findBySourceTypeAndSourceIdIn(
                "AUDIENCE_RESPONSE", responseIds);

        // 5. Fetch Field Definitions
        Set<String> customFieldIds = cfValues.stream()
                .map(CustomFieldValues::getCustomFieldId)
                .collect(Collectors.toSet());

        Map<String, String> fieldIdToName = customFieldRepository.findAllById(customFieldIds).stream()
                .collect(Collectors.toMap(
                        CustomFields::getId,
                        cf -> cf.getFieldName().toLowerCase(),
                        (k1, k2) -> k1));

        // 6. Group values by Response ID
        Map<String, Map<String, String>> responseDataMap = new HashMap<>();
        for (CustomFieldValues cfv : cfValues) {
            String fieldName = fieldIdToName.getOrDefault(cfv.getCustomFieldId(), cfv.getCustomFieldId());
            responseDataMap
                    .computeIfAbsent(cfv.getSourceId(), k -> new HashMap<>())
                    .put(fieldName, cfv.getValue());
        }

        // 7. Build Final List for Workflow
        List<Map<String, Object>> leads = new ArrayList<>();
        for (AudienceResponse ar : responses) {
            Map<String, Object> lead = new HashMap<>();
            lead.put("id", ar.getId());
            lead.put("userId", ar.getUserId());
            lead.put("createdAt", ar.getCreatedAt());

            // Merge custom fields
            Map<String, String> fields = responseDataMap.getOrDefault(ar.getId(), new HashMap<>());
            lead.putAll(fields);

            leads.add(lead);
        }

        // --- END CUSTOM FIELD FETCHING LOGIC ---

        return Map.of("leads", leads);
    }
    private Map<String, Object> fetchInstituteSetting(Map<String, Object> params) {
        try {
            String instituteId = (String) params.get("instituteId");
            String settingKey = (String) params.get("settingKey");

            if (instituteId == null || settingKey == null) {
                return Map.of("error", "Missing instituteId or settingKey");
            }

            // Fetch data using your existing service
            Object settingData = instituteSettingService.getSettingByInstituteIdAndKey(instituteId, settingKey);

            // Wrap in a map key so it's accessible as #ctx['lmsSettings']
            return Map.of("lmsConfig", settingData);

        } catch (Exception e) {
            log.error("Error executing fetchInstituteSetting", e);
            return Map.of("error", e.getMessage());
        }
    }

    private Map<String, Object> fetchPackageLMSSetting(Map<String, Object> params) {
        try {
            String packageId = (String) params.get("packageId");
            String settingKey = (String) params.get("settingKey");

            if (packageId == null || settingKey == null) {
                return Map.of("error", "Missing packageId or settingKey");
            }

            Optional<PackageEntity> packageEntityOpt = packageRepository.findById(packageId);
            if (packageEntityOpt.isEmpty()) {
                return Map.of("error", "Package not found with ID: " + packageId);
            }

            String settingJson = packageEntityOpt.get().getCourseSetting();

            if (settingJson == null || settingJson.isEmpty()) {
                return Map.of("lmsConfig", null);
            }

            // Parse JSON
            JsonNode rootNode = objectMapper.readTree(settingJson);

            // Navigate: setting -> [settingKey] -> data -> data
            JsonNode settingNode = rootNode.path("setting").path(settingKey);

            if (settingNode.isMissingNode()) {
                return Map.of("lmsConfig", null);
            }

            JsonNode dataNode = settingNode.path("data").path("data");

            if (dataNode.isMissingNode()) {
                return Map.of("lmsConfig", null);
            }

            // Convert back to Map
            Map<String, Object> settingData = objectMapper.convertValue(dataNode, Map.class);

            return Map.of("lmsConfig", settingData);

        } catch (Exception e) {
            log.error("Error executing fetchPackageLMSSetting", e);
            return Map.of("error", e.getMessage());
        }
    }
}
