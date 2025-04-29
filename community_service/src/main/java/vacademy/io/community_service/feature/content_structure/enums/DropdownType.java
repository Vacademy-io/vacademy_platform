package vacademy.io.community_service.feature.content_structure.enums;

import java.util.Arrays;

public enum DropdownType {
    LEVEL,
    STREAM,
    SUBJECT,
    DIFFICULTY,
    TOPIC,
    TYPE;

    public static boolean isValid(String source) {
        return Arrays.stream(values()).anyMatch(s -> s.name().equalsIgnoreCase(source));
    }
}
