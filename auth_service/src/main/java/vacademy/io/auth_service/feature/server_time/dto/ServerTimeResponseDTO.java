package vacademy.io.auth_service.feature.server_time.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;

/**
 * Response DTO for server time API
 * Provides comprehensive time information with timezone support
 */
public class ServerTimeResponseDTO {

    @JsonProperty("timestamp")
    @JsonFormat(shape = JsonFormat.Shape.NUMBER)
    private long timestamp;

    @JsonProperty("iso_string")
    private String isoString;

    @JsonProperty("timezone")
    private String timezone;

    @JsonProperty("timezone_offset")
    private String timezoneOffset;

    @JsonProperty("utc_timestamp")
    @JsonFormat(shape = JsonFormat.Shape.NUMBER)
    private long utcTimestamp;

    @JsonProperty("utc_iso_string")
    private String utcIsoString;

    @JsonProperty("formatted_time")
    private String formattedTime;

    @JsonProperty("day_of_week")
    private String dayOfWeek;

    @JsonProperty("day_of_year")
    private int dayOfYear;

    @JsonProperty("week_of_year")
    private int weekOfYear;

    public ServerTimeResponseDTO() {}

    public ServerTimeResponseDTO(ZonedDateTime zonedDateTime) {
        this.timestamp = zonedDateTime.toInstant().toEpochMilli();
        this.isoString = zonedDateTime.toString();
        this.timezone = zonedDateTime.getZone().getId();
        this.timezoneOffset = zonedDateTime.getOffset().toString();
        
        // UTC equivalents
        Instant utcInstant = zonedDateTime.toInstant();
        ZonedDateTime utcDateTime = utcInstant.atZone(ZoneId.of("UTC"));
        this.utcTimestamp = utcInstant.toEpochMilli();
        this.utcIsoString = utcDateTime.toString();
        
        // Additional formatted information
        this.formattedTime = zonedDateTime.toLocalDateTime().toString();
        this.dayOfWeek = zonedDateTime.getDayOfWeek().toString();
        this.dayOfYear = zonedDateTime.getDayOfYear();
        this.weekOfYear = zonedDateTime.get(java.time.temporal.WeekFields.ISO.weekOfYear());
    }

    // Getters and Setters
    public long getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(long timestamp) {
        this.timestamp = timestamp;
    }

    public String getIsoString() {
        return isoString;
    }

    public void setIsoString(String isoString) {
        this.isoString = isoString;
    }

    public String getTimezone() {
        return timezone;
    }

    public void setTimezone(String timezone) {
        this.timezone = timezone;
    }

    public String getTimezoneOffset() {
        return timezoneOffset;
    }

    public void setTimezoneOffset(String timezoneOffset) {
        this.timezoneOffset = timezoneOffset;
    }

    public long getUtcTimestamp() {
        return utcTimestamp;
    }

    public void setUtcTimestamp(long utcTimestamp) {
        this.utcTimestamp = utcTimestamp;
    }

    public String getUtcIsoString() {
        return utcIsoString;
    }

    public void setUtcIsoString(String utcIsoString) {
        this.utcIsoString = utcIsoString;
    }

    public String getFormattedTime() {
        return formattedTime;
    }

    public void setFormattedTime(String formattedTime) {
        this.formattedTime = formattedTime;
    }

    public String getDayOfWeek() {
        return dayOfWeek;
    }

    public void setDayOfWeek(String dayOfWeek) {
        this.dayOfWeek = dayOfWeek;
    }

    public int getDayOfYear() {
        return dayOfYear;
    }

    public void setDayOfYear(int dayOfYear) {
        this.dayOfYear = dayOfYear;
    }

    public int getWeekOfYear() {
        return weekOfYear;
    }

    public void setWeekOfYear(int weekOfYear) {
        this.weekOfYear = weekOfYear;
    }
}
