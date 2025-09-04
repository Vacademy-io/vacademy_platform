package vacademy.io.admin_core_service.features.common.util;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import vacademy.io.common.exceptions.VacademyException;

public class JsonUtil {

    private static final ObjectMapper objectMapper = new ObjectMapper();

    public static <T> String toJson(T object) {
        if (object == null) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(object);
        } catch (JsonProcessingException e) {
            e.printStackTrace();
            return null;
        }
    }

    public static <T> T fromJson(String json, Class<T> clazz) {
        if (json == null) {
            return null;
        }
        try {
            return objectMapper.readValue(json, clazz);
        } catch (JsonProcessingException e) {
            e.printStackTrace();
            return null;
        }
    }

    public static <T> T convertValue(Object fromValue, Class<T> toValueType) {
        if (fromValue == null) {
            return null;
        }
        try {
            // This method is a powerful feature of Jackson for converting between compatible Java types.
            return objectMapper.convertValue(fromValue, toValueType);
        } catch (IllegalArgumentException e) {
            // This exception is thrown if the conversion is not possible.
            // In a real application, you should use a proper logger instead of printStackTrace
            e.printStackTrace();
            return null;
        }
    }
}
