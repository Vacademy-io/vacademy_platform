package vacademy.io.auth_service.feature.server_time.service;

import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import vacademy.io.auth_service.feature.server_time.dto.ServerTimeResponseDTO;

import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Optimized service for server time operations
 * Includes caching and timezone validation for performance
 */
@Service
public class ServerTimeService {

    // Cache for validated timezone IDs to avoid repeated validation
    private static final ConcurrentHashMap<String, ZoneId> TIMEZONE_CACHE = new ConcurrentHashMap<>();
    
    // Default timezone
    private static final String DEFAULT_TIMEZONE = "UTC";

    /**
     * Get current server time in specified timezone
     * Uses caching for performance optimization
     * 
     * @param timezone Target timezone (defaults to UTC if null/invalid)
     * @return ServerTimeResponseDTO with comprehensive time information
     */
    @Cacheable(value = "serverTime", key = "#timezone", unless = "#result == null")
    public ServerTimeResponseDTO getCurrentTime(String timezone) {
        ZoneId zoneId = getValidatedZoneId(timezone);
        ZonedDateTime currentTime = ZonedDateTime.now(zoneId);
        return new ServerTimeResponseDTO(currentTime);
    }

    /**
     * Get current server time in UTC (highly optimized)
     * 
     * @return ServerTimeResponseDTO with UTC time information
     */
    @Cacheable(value = "serverTimeUTC", unless = "#result == null")
    public ServerTimeResponseDTO getCurrentTimeUTC() {
        ZonedDateTime currentTime = ZonedDateTime.now(ZoneId.of("UTC"));
        return new ServerTimeResponseDTO(currentTime);
    }

    /**
     * Get current server time in system default timezone
     * 
     * @return ServerTimeResponseDTO with system timezone information
     */
    public ServerTimeResponseDTO getCurrentTimeSystemDefault() {
        ZonedDateTime currentTime = ZonedDateTime.now();
        return new ServerTimeResponseDTO(currentTime);
    }

    /**
     * Validate and cache timezone IDs for performance
     * 
     * @param timezone Timezone string to validate
     * @return Valid ZoneId (defaults to UTC if invalid)
     */
    private ZoneId getValidatedZoneId(String timezone) {
        if (timezone == null || timezone.trim().isEmpty()) {
            return ZoneId.of(DEFAULT_TIMEZONE);
        }

        // Check cache first
        ZoneId cachedZoneId = TIMEZONE_CACHE.get(timezone);
        if (cachedZoneId != null) {
            return cachedZoneId;
        }

        try {
            ZoneId zoneId = ZoneId.of(timezone);
            // Cache the validated timezone
            TIMEZONE_CACHE.put(timezone, zoneId);
            return zoneId;
        } catch (Exception e) {
            // Log the error and return default timezone
            System.err.println("Invalid timezone provided: " + timezone + ". Using default: " + DEFAULT_TIMEZONE);
            ZoneId defaultZone = ZoneId.of(DEFAULT_TIMEZONE);
            TIMEZONE_CACHE.put(timezone, defaultZone); // Cache the default for this invalid input
            return defaultZone;
        }
    }

    /**
     * Check if a timezone is valid
     * 
     * @param timezone Timezone string to check
     * @return true if valid, false otherwise
     */
    public boolean isValidTimezone(String timezone) {
        if (timezone == null || timezone.trim().isEmpty()) {
            return false;
        }

        try {
            ZoneId.of(timezone);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Get all available timezone IDs
     * 
     * @return Set of available timezone IDs
     */
    public java.util.Set<String> getAvailableTimezones() {
        return ZoneId.getAvailableZoneIds();
    }
}
