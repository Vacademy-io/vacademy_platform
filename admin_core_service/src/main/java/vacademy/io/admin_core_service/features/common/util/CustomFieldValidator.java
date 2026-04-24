package vacademy.io.admin_core_service.features.common.util;

import vacademy.io.admin_core_service.features.common.enums.FieldTypeEnum;

import java.net.URL;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.regex.Pattern;

public class CustomFieldValidator {

    private static final Pattern EMAIL_PATTERN = Pattern.compile(
            "^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$"
    );

    private static final Pattern PHONE_PATTERN = Pattern.compile(
            "^[+]?[0-9\\s\\-()]{6,20}$"
    );

    public static boolean validate(String fieldType, String value) {
        if (value == null || value.isBlank()) {
            return true;
        }

        FieldTypeEnum type;
        try {
            type = FieldTypeEnum.valueOf(fieldType.toUpperCase());
        } catch (IllegalArgumentException e) {
            return true;
        }

        return switch (type) {
            case EMAIL -> EMAIL_PATTERN.matcher(value).matches();
            case URL -> validateUrl(value);
            case PHONE -> PHONE_PATTERN.matcher(value).matches();
            case NUMBER -> validateNumber(value);
            case DATE -> validateDate(value);
            case CHECKBOX -> "true".equalsIgnoreCase(value) || "false".equalsIgnoreCase(value);
            case TEXT, TEXTAREA, DROPDOWN, RADIO, FILE, MULTI_SELECT -> true;
        };
    }

    private static boolean validateUrl(String value) {
        try {
            new URL(value);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private static boolean validateNumber(String value) {
        try {
            Double.parseDouble(value);
            return true;
        } catch (NumberFormatException e) {
            return false;
        }
    }

    private static boolean validateDate(String value) {
        try {
            LocalDate.parse(value);
            return true;
        } catch (DateTimeParseException e) {
            return false;
        }
    }
}
