package vacademy.io.admin_core_service.features.live_session.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.institute.service.InstituteService;
import vacademy.io.common.institute.entity.Institute;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
@RequiredArgsConstructor
public class TimezoneSettingService {

    private final InstituteService instituteService;
    private final ObjectMapper objectMapper;

    /**
     * Gets timezone settings from institute's setting_json
     * @param instituteId Institute ID
     * @return Map of timezone labels to timezone IDs (e.g., "India" -> "Asia/Kolkata")
     */
    public Map<String, String> getTimezoneSettings(String instituteId) {
        try {
            // Step 1: Find institute by ID
            Institute institute = instituteService.findById(instituteId);
            if (institute == null) {
                System.out.println("Institute not found for ID: " + instituteId);
                return getDefaultTimezoneSettings();
            }

            // Step 2: Get the raw setting_json string
            String settingJson = institute.getSetting();
            if (settingJson == null || settingJson.trim().isEmpty()) {
                System.out.println("No settings found for institute: " + instituteId);
                return getDefaultTimezoneSettings();
            }

            // Step 3: Parse JSON and extract TIME_ZONE_SETTING
            JsonNode rootNode = objectMapper.readTree(settingJson);
            JsonNode settingNode = rootNode.path("setting");
            JsonNode timezoneNode = settingNode.path("TIME_ZONE_SETTING");

            if (timezoneNode.isMissingNode() || timezoneNode.isNull()) {
                System.out.println("TIME_ZONE_SETTING not found in institute settings for: " + instituteId);
                return getDefaultTimezoneSettings();
            }

            // Step 4: Convert to Map<String, String>
            Map<String, String> timezoneMap = new HashMap<>();
            if (timezoneNode.isObject()) {
                timezoneNode.fields().forEachRemaining(entry -> {
                    String key = entry.getKey();
                    JsonNode valueNode = entry.getValue();
                    if (valueNode.isTextual()) {
                        timezoneMap.put(key, valueNode.asText());
                    }
                });
            }

            if (timezoneMap.isEmpty()) {
                System.out.println("Empty timezone settings found for institute: " + instituteId);
                return getDefaultTimezoneSettings();
            }

            System.out.println("Successfully loaded timezone settings for institute " + instituteId + ": " + timezoneMap);
            return timezoneMap;

        } catch (Exception e) {
            System.out.println("Error parsing timezone settings for institute " + instituteId + ": " + e.getMessage());
            e.printStackTrace();
            return getDefaultTimezoneSettings();
        }
    }

    /**
     * Default timezone settings if none configured
     * Note: Europe/London automatically handles both GMT (winter) and BST (summer)
     */
    private Map<String, String> getDefaultTimezoneSettings() {
        Map<String, String> defaultSettings = new HashMap<>();
        defaultSettings.put("India", "Asia/Kolkata");
        defaultSettings.put("UK", "Europe/London");  // Handles both GMT and BST automatically
        return defaultSettings;
    }

    /**
     * Formats date and time for all configured timezones
     * @param meetingDate Meeting date
     * @param startTime Meeting start time
     * @param instituteId Institute ID to get timezone settings
     * @param sessionTimezone The timezone in which the session was created and time is stored
     * @return Map of timezone labels to formatted date-time strings
     */
    public Map<String, String> formatDateTimeForAllTimezones(Date meetingDate, Date startTime, String instituteId, String sessionTimezone) {
        Map<String, String> result = new HashMap<>();
        
        if (meetingDate == null || startTime == null) {
            return result;
        }

        Map<String, String> timezoneSettings = getTimezoneSettings(instituteId);
        
        for (Map.Entry<String, String> entry : timezoneSettings.entrySet()) {
            String label = entry.getKey();
            String timezoneId = entry.getValue();
            
            try {
                String formattedDateTime = formatDateTimeForTimezone(meetingDate, startTime, timezoneId, sessionTimezone);
                result.put(label, formattedDateTime);
            } catch (Exception e) {
                System.out.println("Error formatting date/time for timezone " + timezoneId + ": " + e.getMessage());
                // Skip this timezone if formatting fails
            }
        }
        
        return result;
    }

    /**
     * Formats date and time for a specific timezone
     * @param meetingDate Meeting date
     * @param startTime Meeting start time  
     * @param targetTimezoneId Target timezone ID (e.g., "Asia/Kolkata", "Europe/London")
     * @param sessionTimezone Session's timezone - the timezone in which the time is stored
     * @return Formatted date-time string
     */
    private String formatDateTimeForTimezone(Date meetingDate, Date startTime, String targetTimezoneId, String sessionTimezone) {
        try {
            // Combine date and time
            Calendar dateCal = Calendar.getInstance();
            dateCal.setTime(meetingDate);
            
            Calendar timeCal = Calendar.getInstance();
            timeCal.setTime(startTime);
            
            // Set the time components to the date
            dateCal.set(Calendar.HOUR_OF_DAY, timeCal.get(Calendar.HOUR_OF_DAY));
            dateCal.set(Calendar.MINUTE, timeCal.get(Calendar.MINUTE));
            dateCal.set(Calendar.SECOND, timeCal.get(Calendar.SECOND));
            
            // Use session's timezone as the source timezone (where the time is stored)
            // If sessionTimezone is null or empty, fallback to Asia/Kolkata
            ZoneId sourceZone = (sessionTimezone != null && !sessionTimezone.trim().isEmpty()) 
                ? ZoneId.of(sessionTimezone) 
                : ZoneId.of("Asia/Kolkata");
            
            ZoneId targetZone = ZoneId.of(targetTimezoneId);
            
            // Interpret the stored time as being in the session's timezone
            LocalDateTime localDateTime = dateCal.toInstant().atZone(sourceZone).toLocalDateTime();
            
            // Convert from session's timezone to target timezone
            ZonedDateTime zonedDateTime = localDateTime.atZone(sourceZone).withZoneSameInstant(targetZone);
            
            // Format the result
            DateTimeFormatter timeFormatter = DateTimeFormatter.ofPattern("h:mm a");
            String formattedTime = zonedDateTime.format(timeFormatter);
            
            // Get UTC offset for display
            ZoneOffset offset = zonedDateTime.getOffset();
            String offsetString = formatUtcOffset(offset);
            
            return String.format("%s (%s %s)", formattedTime, targetTimezoneId, offsetString);
            
        } catch (Exception e) {
            System.out.println("Error formatting date/time for timezone " + targetTimezoneId + ": " + e.getMessage());
            throw e;
        }
    }

    /**
     * Formats UTC offset in a readable format
     * @param offset ZoneOffset to format
     * @return Formatted offset string (e.g., "+5:30", "-8:00", "+0:00")
     */
    private String formatUtcOffset(ZoneOffset offset) {
        int totalSeconds = offset.getTotalSeconds();
        int hours = totalSeconds / 3600;
        int minutes = Math.abs((totalSeconds % 3600) / 60);
        
        if (hours == 0 && minutes == 0) {
            return "+0:00";
        } else {
            return String.format("%+d:%02d", hours, minutes);
        }
    }

    /**
     * Creates a formatted string with all timezone times for email templates
     * @param meetingDate Meeting date
     * @param startTime Meeting start time
     * @param instituteId Institute ID
     * @param sessionTimezone The timezone in which the session was created and time is stored
     * @return Formatted string with all timezone times
     */
    public String createTimezoneDisplayString(Date meetingDate, Date startTime, String instituteId, String sessionTimezone) {
        Map<String, String> timezoneFormats = formatDateTimeForAllTimezones(meetingDate, startTime, instituteId, sessionTimezone);
        
        if (timezoneFormats.isEmpty()) {
            return "TBD";
        }
        
        StringBuilder sb = new StringBuilder();
        int count = 0;
        for (Map.Entry<String, String> entry : timezoneFormats.entrySet()) {
            if (count > 0) {
                sb.append("<br>");
            }
            sb.append(String.format("<strong>%s:</strong> %s", entry.getKey(), entry.getValue()));
            count++;
        }
        
        return sb.toString();
    }

    /**
     * Debug method to test timezone settings parsing
     * This can be called from a controller or test to verify the settings are being read correctly
     */
    public String debugTimezoneSettings(String instituteId) {
        try {
            Map<String, String> settings = getTimezoneSettings(instituteId);
            return "Timezone settings for institute " + instituteId + ": " + settings.toString();
        } catch (Exception e) {
            return "Error reading timezone settings: " + e.getMessage();
        }
    }
}
