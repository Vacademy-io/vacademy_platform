package vacademy.io.common.core.utils;

import java.util.regex.Pattern;

public class NumberUtil {
    public static boolean isNumeric(String str) {
        Pattern p = Pattern.compile("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$");
        return p.matcher(str).matches();
    }

    public static boolean containsNumber(String input) {
        for (char c : input.toCharArray()) {
            if (Character.isDigit(c)) {  // Check if the character is a digit
                return true;
            }
        }
        return false;
    }
}
