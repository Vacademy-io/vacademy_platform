package vacademy.io.common.auth.utils;

import org.springframework.util.StringUtils;

public class CaseHandlerUserClient {

    public static String transformToUpperCase(String input) {
        if (!StringUtils.hasText(input)) {
            return null;
        }
        return input.toUpperCase();
    }

    public static String transformToLowerCase(String input) {
        if (!StringUtils.hasText(input)) {
            return null;
        }
        return input.toLowerCase();
    }
}
