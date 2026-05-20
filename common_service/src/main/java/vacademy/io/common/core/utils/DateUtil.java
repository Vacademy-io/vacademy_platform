package vacademy.io.common.core.utils;

import org.springframework.util.StringUtils;
import vacademy.io.common.exceptions.VacademyException;

import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.Date;
import java.util.Locale;

public class DateUtil {

    public static Date covertDateToString(String dateString, String inputFormat) {
        if (!StringUtils.hasText(dateString)) return new Date();
        SimpleDateFormat formatter = new SimpleDateFormat(inputFormat, Locale.ENGLISH);

        try {
            return formatter.parse(dateString);
        } catch (ParseException e) {
            throw new RuntimeException(e);
        }
    }

    public static String covertDateToString(Date date, String inputFormat) {
        if (date == null) return null;
        SimpleDateFormat formatter = new SimpleDateFormat(inputFormat, Locale.ENGLISH);
        return formatter.format(date);
    }

    public static Date convertStringToDate(String dateString) {
        if (!StringUtils.hasText(dateString)) return new Date();
        SimpleDateFormat formatter = new SimpleDateFormat("dd-MM-yyyy", Locale.ENGLISH);
        try {
            return formatter.parse(dateString);
        } catch (ParseException e) {
            throw new RuntimeException(e);
        }
    }

    public static String convertDateToString(Date date) {
        if (date == null) return null;
        SimpleDateFormat formatter = new SimpleDateFormat("dd-MM-yyyy", Locale.ENGLISH);
        return formatter.format(date);
    }

    public static Date convertStringToUTCDate(String dateString) {
        if (!StringUtils.hasText(dateString)) return new Date();
        try {
            ZonedDateTime zonedDateTime = ZonedDateTime.parse(dateString, DateTimeFormatter.ISO_ZONED_DATE_TIME);
            ZonedDateTime utcDateTime = zonedDateTime.withZoneSameInstant(ZoneId.of("UTC"));
            return Date.from(utcDateTime.toInstant());
        } catch (DateTimeParseException e) {
            throw new VacademyException("Invalid date format: '" + dateString + "'. Expected ISO zoned datetime (e.g. 2026-05-15T07:30:00.000Z).");
        }
    }

    public static Date getCurrentUtcTime() {
        return Date.from(ZonedDateTime.now().withZoneSameInstant(ZoneId.of("UTC")).toInstant());
    }

    public static Date addMinutes(Date startTime, Integer maxTime) {
        return Date.from(startTime.toInstant().plusSeconds(maxTime * 60));
    }
}
