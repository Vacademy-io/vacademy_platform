package vacademy.io.community_service.feature.addFilterToEntity.utils;

import java.util.Arrays;

public class EnumUtils {
    public static <E extends Enum<E>> boolean isValidEnum(Class<E> enumClass, String value) {
        return Arrays.stream(enumClass.getEnumConstants())
                .anyMatch(e -> e.name().equalsIgnoreCase(value));
    }
}

