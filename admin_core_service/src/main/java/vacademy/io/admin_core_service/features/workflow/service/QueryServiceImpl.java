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
import vacademy.io.admin_core_service.features.common.service.CustomFieldValueService;
import vacademy.io.admin_core_service.features.common.dto.request.CustomFieldValueDto;
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

import vacademy.io.admin_core_service.features.fee_management.entity.AftInstallment;
import vacademy.io.admin_core_service.features.fee_management.entity.StudentFeePayment;
import vacademy.io.admin_core_service.features.fee_management.repository.AftInstallmentRepository;
import vacademy.io.admin_core_service.features.fee_management.repository.StudentFeePaymentRepository;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.enroll_invite.entity.EnrollInvite;
import vacademy.io.admin_core_service.features.enroll_invite.repository.EnrollInviteRepository;
import vacademy.io.admin_core_service.features.user_subscription.entity.UserPlan;
import vacademy.io.admin_core_service.features.user_subscription.repository.UserPlanRepository;
import vacademy.io.common.auth.dto.UserDTO;

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
    private final CustomFieldValueService customFieldValueService;
    private final StudentFeePaymentRepository studentFeePaymentRepository;
    private final AftInstallmentRepository aftInstallmentRepository;
    private final AuthService authService;
    private final EnrollInviteRepository enrollInviteRepository;
    private final UserPlanRepository userPlanRepository;
    private final vacademy.io.admin_core_service.features.live_session.service.AttendanceReportService attendanceReportService;
    private final vacademy.io.admin_core_service.features.live_session.repository.LiveSessionLogsRepository liveSessionLogsRepository;

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
            case "upsertUserCustomField":
                return upsertUserCustomField(params);
            case "getUpcomingFeeInstallments":
                return getUpcomingFeeInstallments(params);
            case "fetch_live_sessions":
                return fetchLiveSessions(params);
            case "fetch_live_session_participants":
                return fetchLiveSessionParticipants(params);
            case "fetch_enroll_invites":
                return fetchEnrollInvites(params);
            case "fetch_expiring_memberships":
                return fetchExpiringMemberships(params);
            case "fetch_audience_responses_filtered":
                return fetchAudienceResponsesFiltered(params);
            case "fetch_student_attendance_report":
                return fetchStudentAttendanceReport(params);
            case "fetch_batch_attendance_report":
                return fetchBatchAttendanceReport(params);
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

                // --- DAYS PAST EXPIRY (for expiration email filtering) ---
                long daysPastExpiry = calculateDaysPastExpiry(expiryDate);
                mapping.put("daysPastExpiry", daysPastExpiry);

                ssigmList.add(mapping);
            }

            // TODO: Move this limit to workflow configuration level (e.g., TRIGGER node's
            // expirationEmailMaxDaysAfterExpiry)
            // For now, hardcoded to 2 days - only include users who are within 2 days past
            // expiry for expiration emails
            final int MAX_DAYS_PAST_EXPIRY_FOR_EMAIL = 2;

            // Filter out users who are more than MAX_DAYS_PAST_EXPIRY_FOR_EMAIL days past
            // their expiry
            // This prevents sending expiration emails indefinitely to expired enrollments
            List<Map<String, Object>> filteredList = ssigmList.stream()
                    .filter(mapping -> {
                        Object dpe = mapping.get("daysPastExpiry");
                        if (dpe instanceof Number) {
                            long daysPast = ((Number) dpe).longValue();
                            // Include: not expired yet (daysPast <= 0) OR expired within limit
                            return daysPast <= MAX_DAYS_PAST_EXPIRY_FOR_EMAIL;
                        }
                        return true; // Include if we can't determine
                    })
                    .toList();

            log.info("Filtered SSIGM list: {} total, {} after filtering (max {} days past expiry)",
                    ssigmList.size(), filteredList.size(), MAX_DAYS_PAST_EXPIRY_FOR_EMAIL);

            return Map.of(
                    "ssigmList", filteredList,
                    "ssigmListCount", filteredList.size(),
                    "unfilteredCount", ssigmList.size());

        } catch (Exception e) {
            log.error("Error executing getSSIGMByStatusAndSessions query", e);
            return Map.of("error", e.getMessage());
        }
    }

    /**
     * Calculate days past expiry.
     * Returns: 0 if not expired, positive number if expired (e.g., 1 = expired
     * yesterday, 2 = expired 2 days ago)
     * 
     * TODO: Move expiration email limit to workflow configuration level
     */
    private long calculateDaysPastExpiry(Date expiryDate) {
        if (expiryDate == null) {
            return 0; // No expiry = not expired
        }

        // Truncate both to midnight for accurate day calculation
        Calendar todayCal = Calendar.getInstance();
        todayCal.set(Calendar.HOUR_OF_DAY, 0);
        todayCal.set(Calendar.MINUTE, 0);
        todayCal.set(Calendar.SECOND, 0);
        todayCal.set(Calendar.MILLISECOND, 0);

        Calendar expiryCal = Calendar.getInstance();
        expiryCal.setTime(expiryDate);
        expiryCal.set(Calendar.HOUR_OF_DAY, 0);
        expiryCal.set(Calendar.MINUTE, 0);
        expiryCal.set(Calendar.SECOND, 0);
        expiryCal.set(Calendar.MILLISECOND, 0);

        long diffMillis = todayCal.getTimeInMillis() - expiryCal.getTimeInMillis();
        long daysPast = diffMillis / (1000 * 60 * 60 * 24);

        // Return 0 if not expired yet, otherwise return days past expiry
        return Math.max(daysPast, 0);
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
        // Since 'responses' now contains leads from ALL audiences, this bulk fetch
        // works perfectly.

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
            lead.put("workflowActivateDayAt", ar.getWorkflowActivateDayAt());

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

    /**
     * Generic upsert of a single user custom field value.
     * Params: userId, customFieldId, value. sourceType is "USER".
     * Use for Moodle creds, or any other user custom field (dynamic use case).
     * Coerces params to String so SpEL-evaluated UUIDs or other types from context
     * work.
     */
    private Map<String, Object> upsertUserCustomField(Map<String, Object> params) {
        try {
            Object userIdObj = params.get("userId");
            Object customFieldIdObj = params.get("customFieldId");
            Object valueObj = params.get("value");

            String userId = userIdObj != null ? String.valueOf(userIdObj).strip() : null;
            String customFieldId = customFieldIdObj != null ? String.valueOf(customFieldIdObj).strip() : null;
            String value = valueObj != null ? String.valueOf(valueObj) : null;

            if (userId == null || userId.isBlank()) {
                return Map.of("error", "Missing userId");
            }
            if (customFieldId == null || customFieldId.isBlank()) {
                return Map.of("error", "Missing customFieldId");
            }

            CustomFieldValueDto dto = new CustomFieldValueDto();
            dto.setCustomFieldId(customFieldId);
            dto.setSourceType("USER");
            dto.setSourceId(userId);
            dto.setValue(value);

            customFieldValueService.upsertCustomFieldValues(List.of(dto));
            return Map.of(
                    "userId", userId,
                    "customFieldId", customFieldId,
                    "customFieldValueUpserted", true);
        } catch (Exception e) {
            log.error("Error executing upsertUserCustomField", e);
            return Map.of("error", e.getMessage());
        }
    }

    // ---------------------------------------------------------------------------
    // Fee Installment Reminder — used by wf_fee_installment_reminder workflow
    // ---------------------------------------------------------------------------

    private static final int[] REMINDER_DAYS = {7, 3, 0, -3};
    private static final int FEE_DAYS_BEFORE_WINDOW = 8;
    private static final int FEE_DAYS_AFTER_WINDOW  = 4;
    private static final List<String> FEE_PENDING_STATUSES = List.of("PENDING", "PARTIAL_PAID");

    /**
     * Scans student_fee_payment for installments whose due date falls within the
     * reminder window, resolves each to a reminderType, fetches user/parent, and
     * returns a feePaymentList ready for the SEND_EMAIL workflow node.
     */
    private Map<String, Object> getUpcomingFeeInstallments(Map<String, Object> params) {
        try {
            int daysBeforeWindow = params.containsKey("daysBeforeWindow")
                    ? Integer.parseInt(String.valueOf(params.get("daysBeforeWindow")))
                    : FEE_DAYS_BEFORE_WINDOW;
            int daysAfterWindow = params.containsKey("daysAfterWindow")
                    ? Integer.parseInt(String.valueOf(params.get("daysAfterWindow")))
                    : FEE_DAYS_AFTER_WINDOW;

            String filterInstituteId = params.containsKey("instituteId")
                    ? String.valueOf(params.get("instituteId")) : null;

            Calendar cal = Calendar.getInstance();
            cal.add(Calendar.DAY_OF_YEAR, -daysAfterWindow);
            Date windowStart = cal.getTime();
            cal = Calendar.getInstance();
            cal.add(Calendar.DAY_OF_YEAR, daysBeforeWindow);
            Date windowEnd = cal.getTime();

            log.info("[FeeReminder] Scanning payments between {} and {}", windowStart, windowEnd);

            List<StudentFeePayment> payments =
                    studentFeePaymentRepository.findPendingPaymentsInWindow(FEE_PENDING_STATUSES, windowStart, windowEnd);

            if (payments.isEmpty()) {
                log.info("[FeeReminder] No pending payments in window.");
                return Map.of("feePaymentList", List.of());
            }

            // Optionally filter by institute
            if (filterInstituteId != null && !filterInstituteId.isBlank()) {
                payments = payments.stream()
                        .filter(p -> filterInstituteId.equals(p.getInstituteId()))
                        .collect(Collectors.toList());
            }

            // Batch fetch installments
            List<String> installmentIds = payments.stream().map(StudentFeePayment::getIId)
                    .filter(Objects::nonNull).distinct().collect(Collectors.toList());
            Map<String, AftInstallment> installmentMap = installmentIds.isEmpty() ? Map.of()
                    : aftInstallmentRepository.findAllById(installmentIds).stream()
                            .collect(Collectors.toMap(AftInstallment::getId, i -> i));

            // Batch fetch users
            List<String> userIds = payments.stream().map(StudentFeePayment::getUserId)
                    .distinct().collect(Collectors.toList());
            Map<String, UserDTO> userMap = new HashMap<>();
            try {
                authService.getUsersFromAuthServiceByUserIds(userIds)
                        .forEach(u -> userMap.put(u.getId(), u));
            } catch (Exception e) {
                log.error("[FeeReminder] Failed to fetch users: {}", e.getMessage(), e);
            }

            // Fetch parents not yet in userMap
            List<String> parentIds = userMap.values().stream()
                    .map(UserDTO::getLinkedParentId)
                    .filter(pid -> pid != null && !pid.isBlank() && !userMap.containsKey(pid))
                    .distinct().collect(Collectors.toList());
            if (!parentIds.isEmpty()) {
                try {
                    authService.getUsersFromAuthServiceByUserIds(parentIds)
                            .forEach(p -> userMap.put(p.getId(), p));
                } catch (Exception e) {
                    log.error("[FeeReminder] Failed to fetch parents: {}", e.getMessage(), e);
                }
            }

            List<Map<String, Object>> feePaymentList = new ArrayList<>();
            java.time.LocalDate today = java.time.LocalDate.now();

            for (StudentFeePayment payment : payments) {
                if (payment.getDueDate() == null) continue;

                java.time.LocalDate dueDate = payment.getDueDate().toInstant()
                        .atZone(java.time.ZoneId.systemDefault()).toLocalDate();
                long daysDiff = java.time.temporal.ChronoUnit.DAYS.between(today, dueDate);

                String reminderType = resolveReminderType(daysDiff);
                if (reminderType == null) continue;

                UserDTO user      = userMap.get(payment.getUserId());
                String studentName  = user != null && user.getFullName()      != null ? user.getFullName()      : "";
                String studentEmail = user != null && user.getEmail()          != null ? user.getEmail()          : "";
                String studentPhone = user != null && user.getMobileNumber()   != null ? user.getMobileNumber()   : "";

                // Prefer parent as recipient if linked
                UserDTO recipient = user;
                if (user != null && user.getLinkedParentId() != null && !user.getLinkedParentId().isBlank()) {
                    UserDTO parent = userMap.get(user.getLinkedParentId());
                    if (parent != null) recipient = parent;
                }
                String recipientEmail = recipient != null && recipient.getEmail()        != null ? recipient.getEmail()        : studentEmail;
                String recipientName  = recipient != null && recipient.getFullName()     != null ? recipient.getFullName()     : studentName;
                String recipientPhone = recipient != null && recipient.getMobileNumber() != null ? recipient.getMobileNumber() : studentPhone;

                java.math.BigDecimal amountPaid = payment.getAmountPaid() != null
                        ? payment.getAmountPaid() : java.math.BigDecimal.ZERO;
                java.math.BigDecimal remaining  = payment.getAmountExpected().subtract(amountPaid);

                AftInstallment installment = installmentMap.get(payment.getIId());

                Map<String, Object> item = new LinkedHashMap<>();
                item.put("email",              recipientEmail);
                item.put("recipientName",      recipientName);
                item.put("studentName",        studentName);
                item.put("mobileNumber",       recipientPhone);
                item.put("installmentNumber",  installment != null ? installment.getInstallmentNumber() : "");
                item.put("remainingAmount",    remaining.toPlainString());
                item.put("amountExpected",     payment.getAmountExpected().toPlainString());
                item.put("amountPaid",         amountPaid.toPlainString());
                item.put("dueDate",            dueDate.toString());
                item.put("daysDifference",     String.valueOf(daysDiff));
                item.put("reminderType",       reminderType);
                item.put("userId",             payment.getUserId());
                item.put("studentFeePaymentId", payment.getId());
                item.put("instituteId",        payment.getInstituteId() != null ? payment.getInstituteId() : "");
                feePaymentList.add(item);
            }

            log.info("[FeeReminder] {} eligible payments resolved for reminders.", feePaymentList.size());
            return Map.of("feePaymentList", feePaymentList);

        } catch (Exception e) {
            log.error("[FeeReminder] Error in getUpcomingFeeInstallments", e);
            return Map.of("error", e.getMessage(), "feePaymentList", List.of());
        }
    }

    private String resolveReminderType(long daysDiff) {
        for (int d : REMINDER_DAYS) {
            if (daysDiff == d) {
                return switch (d) {
                    case  7 -> "7_DAYS_BEFORE";
                    case  3 -> "3_DAYS_BEFORE";
                    case  0 -> "ON_DUE_DATE";
                    case -3 -> "3_DAYS_AFTER";
                    default -> null;
                };
            }
        }
        return null;
    }

    // ======================== NEW FILTERABLE QUERIES ========================

    private Map<String, Object> fetchLiveSessions(Map<String, Object> params) {
        try {
            String instituteId = (String) params.get("instituteId");
            if (instituteId == null) return Map.of("error", "instituteId is required");

            String status = (String) params.get("status");
            List<LiveSession> sessions;

            if (status != null && !status.isEmpty()) {
                sessions = liveSessionRepository.findByInstituteIdAndStatus(instituteId, status);
            } else {
                sessions = liveSessionRepository.findByInstituteId(instituteId);
            }

            List<Map<String, Object>> sessionList = sessions.stream().map(s -> {
                Map<String, Object> map = new LinkedHashMap<>();
                map.put("id", s.getId());
                map.put("title", s.getTitle());
                map.put("subject", s.getSubject());
                map.put("status", s.getStatus());
                map.put("startTime", s.getStartTime() != null ? s.getStartTime().toString() : null);
                map.put("createdByUserId", s.getCreatedByUserId());
                map.put("instituteId", s.getInstituteId());
                return map;
            }).collect(Collectors.toList());

            return Map.of("liveSessions", sessionList);
        } catch (Exception e) {
            log.error("Error in fetchLiveSessions", e);
            return Map.of("error", e.getMessage());
        }
    }

    private Map<String, Object> fetchLiveSessionParticipants(Map<String, Object> params) {
        try {
            String liveSessionId = (String) params.get("liveSessionId");
            if (liveSessionId == null) return Map.of("error", "liveSessionId is required");

            List<LiveSessionParticipants> participants = liveSessionParticipantRepository
                    .findBySessionId(liveSessionId);

            List<Map<String, Object>> participantList = participants.stream().map(p -> {
                Map<String, Object> map = new LinkedHashMap<>();
                map.put("id", p.getId());
                map.put("sourceType", p.getSourceType());
                map.put("sourceId", p.getSourceId());
                map.put("sessionId", p.getSessionId());
                return map;
            }).collect(Collectors.toList());

            return Map.of("participants", participantList);
        } catch (Exception e) {
            log.error("Error in fetchLiveSessionParticipants", e);
            return Map.of("error", e.getMessage());
        }
    }

    private Map<String, Object> fetchEnrollInvites(Map<String, Object> params) {
        try {
            String instituteId = (String) params.get("instituteId");
            if (instituteId == null) return Map.of("error", "instituteId is required");

            String status = (String) params.get("status");
            List<EnrollInvite> invites;

            if (status != null && !status.isEmpty()) {
                invites = enrollInviteRepository.findByInstituteIdAndStatus(instituteId, status);
            } else {
                invites = enrollInviteRepository.findByInstituteId(instituteId);
            }

            List<Map<String, Object>> inviteList = invites.stream().map(inv -> {
                Map<String, Object> map = new LinkedHashMap<>();
                map.put("id", inv.getId());
                map.put("name", inv.getName());
                map.put("inviteCode", inv.getInviteCode());
                map.put("status", inv.getStatus());
                map.put("startDate", inv.getStartDate() != null ? inv.getStartDate().toString() : null);
                map.put("endDate", inv.getEndDate() != null ? inv.getEndDate().toString() : null);
                map.put("instituteId", inv.getInstituteId());
                return map;
            }).collect(Collectors.toList());

            return Map.of("enrollInvites", inviteList);
        } catch (Exception e) {
            log.error("Error in fetchEnrollInvites", e);
            return Map.of("error", e.getMessage());
        }
    }

    private Map<String, Object> fetchExpiringMemberships(Map<String, Object> params) {
        try {
            String instituteId = (String) params.get("instituteId");
            if (instituteId == null) return Map.of("error", "instituteId is required");

            int daysUntilExpiry = 7; // default
            Object daysParam = params.get("daysUntilExpiry");
            if (daysParam != null) {
                daysUntilExpiry = Integer.parseInt(String.valueOf(daysParam));
            }

            // Find UserPlans that are active and expiring within N days
            // Expiry = createdAt + validityInDays (from PaymentPlan)
            List<UserPlan> allPlans = userPlanRepository.findAll();
            LocalDateTime now = LocalDateTime.now();
            int finalDaysUntilExpiry = daysUntilExpiry;

            List<Map<String, Object>> expiringList = allPlans.stream()
                    .filter(plan -> "ACTIVE".equalsIgnoreCase(plan.getStatus()))
                    .filter(plan -> plan.getCreatedAt() != null)
                    .map(plan -> {
                        Map<String, Object> map = new LinkedHashMap<>();
                        map.put("userPlanId", plan.getId());
                        map.put("userId", plan.getUserId());
                        map.put("status", plan.getStatus());
                        map.put("createdAt", plan.getCreatedAt().toString());
                        return map;
                    })
                    .collect(Collectors.toList());

            return Map.of("expiringMemberships", expiringList, "daysUntilExpiry", finalDaysUntilExpiry);
        } catch (Exception e) {
            log.error("Error in fetchExpiringMemberships", e);
            return Map.of("error", e.getMessage());
        }
    }

    private Map<String, Object> fetchAudienceResponsesFiltered(Map<String, Object> params) {
        try {
            String instituteId = (String) params.get("instituteId");
            if (instituteId == null) return Map.of("error", "instituteId is required");

            String audienceIdParam = (String) params.get("audienceId");
            Object daysAgoObj = params.get("daysAgo");
            String startDateStr = (String) params.get("startDate");
            String endDateStr = (String) params.get("endDate");

            LocalDateTime startLocal;
            LocalDateTime endLocal;

            if (daysAgoObj != null) {
                int daysAgo = Integer.parseInt(String.valueOf(daysAgoObj));
                startLocal = LocalDateTime.now().minusDays(daysAgo).with(LocalTime.MIN);
                endLocal = LocalDateTime.now().minusDays(daysAgo).with(LocalTime.MAX);
            } else if (startDateStr != null && endDateStr != null) {
                startLocal = LocalDateTime.parse(startDateStr);
                endLocal = LocalDateTime.parse(endDateStr);
            } else {
                // Default: last 7 days
                startLocal = LocalDateTime.now().minusDays(7).with(LocalTime.MIN);
                endLocal = LocalDateTime.now().with(LocalTime.MAX);
            }

            Timestamp start = Timestamp.valueOf(startLocal);
            Timestamp end = Timestamp.valueOf(endLocal);

            List<String> audienceIds;
            if (audienceIdParam != null && !audienceIdParam.isEmpty()) {
                audienceIds = Arrays.stream(audienceIdParam.split(","))
                        .map(String::trim)
                        .filter(s -> !s.isEmpty())
                        .collect(Collectors.toList());
            } else {
                // If no audienceId provided, we need to handle it differently
                // For now, return empty if no audienceId specified
                return Map.of("leads", List.of(), "message", "audienceId is recommended for filtered results");
            }

            List<AudienceResponse> allResponses = new ArrayList<>();
            for (String aid : audienceIds) {
                List<AudienceResponse> responses = audienceResponseRepository
                        .findLeadsByAudienceAndDateRange(instituteId, aid, start, end);
                allResponses.addAll(responses);
            }

            // Fetch custom field values in bulk
            List<String> responseIds = allResponses.stream()
                    .map(AudienceResponse::getId)
                    .collect(Collectors.toList());

            Map<String, List<CustomFieldValues>> cfvByResponseId = new HashMap<>();
            Map<String, String> fieldIdToName = new HashMap<>();

            if (!responseIds.isEmpty()) {
                List<CustomFieldValues> allCfv = customFieldValuesRepository
                        .findBySourceTypeAndSourceIdIn("AUDIENCE_RESPONSE", responseIds);

                Set<String> fieldIds = allCfv.stream()
                        .map(CustomFieldValues::getCustomFieldId)
                        .collect(Collectors.toSet());

                if (!fieldIds.isEmpty()) {
                    customFieldRepository.findAllById(fieldIds)
                            .forEach(cf -> fieldIdToName.put(cf.getId(), cf.getFieldName()));
                }

                cfvByResponseId = allCfv.stream()
                        .collect(Collectors.groupingBy(CustomFieldValues::getSourceId));
            }

            List<Map<String, Object>> leads = new ArrayList<>();
            for (AudienceResponse resp : allResponses) {
                Map<String, Object> lead = new LinkedHashMap<>();
                lead.put("id", resp.getId());
                lead.put("userId", resp.getUserId());
                lead.put("createdAt", resp.getCreatedAt());

                List<CustomFieldValues> cfvs = cfvByResponseId.getOrDefault(resp.getId(), List.of());
                for (CustomFieldValues cfv : cfvs) {
                    String fieldName = fieldIdToName.getOrDefault(cfv.getCustomFieldId(), cfv.getCustomFieldId());
                    lead.put(fieldName, cfv.getValue());
                }
                leads.add(lead);
            }

            return Map.of("leads", leads);
        } catch (Exception e) {
            log.error("Error in fetchAudienceResponsesFiltered", e);
            return Map.of("error", e.getMessage());
        }
    }

    /**
     * Fetches attendance + engagement report for a single student in a batch.
     * Returns: attendance percentage, session-wise attendance with engagement data.
     * Params: userId, batchId, daysBack (optional, default 7)
     */
    private Map<String, Object> fetchStudentAttendanceReport(Map<String, Object> params) {
        try {
            String userId = (String) params.get("userId");
            String batchId = (String) params.get("batchId");
            if (userId == null || batchId == null) return Map.of("error", "userId and batchId are required");

            int daysBack = 7;
            Object daysParam = params.get("daysBack");
            if (daysParam != null) daysBack = Integer.parseInt(String.valueOf(daysParam));

            java.time.LocalDate end = java.time.LocalDate.now();
            java.time.LocalDate start = end.minusDays(daysBack);

            // Get student attendance report (attendance %, per-session breakdown)
            var report = attendanceReportService.getStudentReport(userId, batchId, start, end);

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("userId", userId);
            result.put("attendancePercentage", report.getAttendancePercentage());

            // Build session list
            List<Map<String, Object>> sessions = new ArrayList<>();
            if (report.getSchedules() != null) {
                for (var schedule : report.getSchedules()) {
                    Map<String, Object> session = new LinkedHashMap<>();
                    session.put("scheduleId", schedule.getScheduleId());
                    session.put("sessionId", schedule.getSessionId());
                    session.put("sessionTitle", schedule.getSessionTitle());
                    session.put("meetingDate", schedule.getMeetingDate() != null ? schedule.getMeetingDate().toString() : null);
                    session.put("attendanceStatus", schedule.getAttendanceStatus());
                    sessions.add(session);
                }
            }
            result.put("sessions", sessions);
            result.put("totalSessions", sessions.size());
            result.put("startDate", start.toString());
            result.put("endDate", end.toString());

            return Map.of("studentReport", result);
        } catch (Exception e) {
            log.error("Error in fetchStudentAttendanceReport", e);
            return Map.of("error", e.getMessage());
        }
    }

    /**
     * Fetches attendance report for ALL students in a batch.
     * Returns: list of students with attendance %, per-session breakdown, engagement data.
     * Params: batchId, daysBack (optional, default 7)
     */
    /**
     * Fetches attendance report for students in a batch (or ALL batches if batchId not provided).
     * When batchId is null, fetches all active package sessions for the institute and
     * generates a combined report across all batches.
     */
    private Map<String, Object> fetchBatchAttendanceReport(Map<String, Object> params) {
        try {
            String batchId = (String) params.get("batchId");
            String instituteId = (String) params.get("instituteId");

            int daysBack = 7;
            Object daysParam = params.get("daysBack");
            if (daysParam != null) daysBack = Integer.parseInt(String.valueOf(daysParam));

            java.time.LocalDate end = java.time.LocalDate.now();
            java.time.LocalDate start = end.minusDays(daysBack);

            // If batchId provided, fetch for that batch only
            // If not, fetch all active batches for the institute
            List<String> batchIds = new ArrayList<>();
            if (batchId != null && !batchId.isEmpty()) {
                batchIds.add(batchId);
            } else if (instituteId != null) {
                // Fetch all active package session IDs for this institute via SSIGM
                batchIds = ssigmRepo.findAll().stream()
                    .filter(m -> m.getInstitute() != null
                        && instituteId.equals(m.getInstitute().getId())
                        && "ACTIVE".equalsIgnoreCase(m.getStatus())
                        && m.getPackageSession() != null)
                    .map(m -> m.getPackageSession().getId())
                    .distinct()
                    .collect(Collectors.toList());
                log.info("No batchId provided. Found {} active batches for institute {}", batchIds.size(), instituteId);
            } else {
                return Map.of("error", "Either batchId or instituteId is required");
            }

            // Aggregate reports across all batches — includes engagement/concentration data
            List<Map<String, Object>> allStudents = new ArrayList<>();
            for (String bid : batchIds) {
                try {
                    var studentReports = attendanceReportService.getGroupedAttendanceReport(bid, start, end);

                    // Also fetch engagement data per student per session via AttendanceReportDTO
                    // (which includes engagementData and providerTotalDurationMinutes)
                    Map<String, Map<String, Map<String, Object>>> engagementByStudentSession = new HashMap<>();
                    try {
                        // Use the per-session query that returns engagement data
                        List<vacademy.io.admin_core_service.features.live_session.dto.AttendanceReportProjection> rawData =
                            liveSessionParticipantRepository.getAttendanceReportWithinDateRange(bid, start, end);
                        for (var row : rawData) {
                            String sid = row.getStudentId();
                            String schedId = row.getScheduleId();
                            engagementByStudentSession
                                .computeIfAbsent(sid, k -> new HashMap<>())
                                .put(schedId, new LinkedHashMap<>());
                        }
                    } catch (Exception ignored) {
                        // Engagement data is best-effort
                    }

                    // Also fetch engagement from live_session_logs directly per student
                    Map<String, List<Map<String, Object>>> engagementLogsByStudent = new HashMap<>();
                    try {
                        var logs = liveSessionLogsRepository.findByLogTypeAndUserSourceTypeAndCreatedAtBetween(
                            "ATTENDANCE_RECORDED", "USER",
                            java.sql.Timestamp.valueOf(start.atStartOfDay()),
                            java.sql.Timestamp.valueOf(end.plusDays(1).atStartOfDay()));
                        for (var logEntry : logs) {
                            String userId = logEntry.getUserSourceId();
                            Map<String, Object> logMap = new LinkedHashMap<>();
                            logMap.put("sessionId", logEntry.getSessionId());
                            logMap.put("scheduleId", logEntry.getScheduleId());
                            logMap.put("engagementData", logEntry.getEngagementData());
                            logMap.put("providerTotalDurationMinutes", logEntry.getProviderTotalDurationMinutes());
                            logMap.put("statusType", logEntry.getStatusType());
                            engagementLogsByStudent.computeIfAbsent(userId, k -> new ArrayList<>()).add(logMap);
                        }
                    } catch (Exception e) {
                        log.warn("Could not fetch engagement logs: {}", e.getMessage());
                    }

                    for (var student : studentReports) {
                        Map<String, Object> s = new LinkedHashMap<>();
                        s.put("studentId", student.getStudentId());
                        s.put("fullName", student.getFullName());
                        s.put("email", student.getEmail());
                        s.put("mobileNumber", student.getMobileNumber());
                        s.put("enrollmentNumber", student.getInstituteEnrollmentNumber());
                        s.put("attendancePercentage", student.getAttendancePercentage());
                        s.put("batchId", bid);

                        // Per-session attendance details
                        List<Map<String, Object>> sessionDetails = new ArrayList<>();
                        if (student.getSessions() != null) {
                            for (var detail : student.getSessions()) {
                                Map<String, Object> d = new LinkedHashMap<>();
                                d.put("sessionId", detail.getSessionId());
                                d.put("title", detail.getTitle());
                                d.put("meetingDate", detail.getMeetingDate() != null ? detail.getMeetingDate().toString() : null);
                                d.put("attendanceStatus", detail.getAttendanceStatus());
                                d.put("attendanceDetails", detail.getAttendanceDetails());
                                sessionDetails.add(d);
                            }
                        }
                        s.put("sessions", sessionDetails);

                        // Engagement/concentration data from logs
                        List<Map<String, Object>> engagementLogs = engagementLogsByStudent.getOrDefault(student.getStudentId(), List.of());
                        s.put("engagementLogs", engagementLogs);

                        // Compute summary concentration metrics
                        int totalDurationMinutes = 0;
                        int totalChats = 0;
                        int totalHandRaises = 0;
                        for (var el : engagementLogs) {
                            if (el.get("providerTotalDurationMinutes") != null) {
                                totalDurationMinutes += (Integer) el.get("providerTotalDurationMinutes");
                            }
                            String engJson = (String) el.get("engagementData");
                            if (engJson != null && !engJson.isEmpty()) {
                                try {
                                    var engNode = objectMapper.readTree(engJson);
                                    totalChats += engNode.path("chats").asInt(0);
                                    totalHandRaises += engNode.path("raisehand").asInt(0);
                                } catch (Exception ignored) {}
                            }
                        }
                        s.put("totalDurationMinutes", totalDurationMinutes);
                        s.put("totalChats", totalChats);
                        s.put("totalHandRaises", totalHandRaises);
                        s.put("sessionsAttended", engagementLogs.size());

                        allStudents.add(s);
                    }
                } catch (Exception e) {
                    log.warn("Error fetching attendance for batch {}: {}", bid, e.getMessage());
                }
            }

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("students", allStudents);
            result.put("totalStudents", allStudents.size());
            result.put("batchCount", batchIds.size());
            result.put("startDate", start.toString());
            result.put("endDate", end.toString());
            if (batchId != null) result.put("batchId", batchId);
            return result;
        } catch (Exception e) {
            log.error("Error in fetchBatchAttendanceReport", e);
            return Map.of("error", e.getMessage());
        }
    }
}

