package vacademy.io.common.core.utils;

import org.springframework.util.StringUtils;

import java.text.ParseException;
import java.text.SimpleDateFormat;
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

}
