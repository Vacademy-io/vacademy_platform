package vacademy.io.community_service.feature.onboarding.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.Map;

/** Null-safe (de)serialization between jsonb String columns and Java collections. */
@Component
@Slf4j
public class OnboardingJson {

    private final ObjectMapper mapper = new ObjectMapper();

    public String write(Object value) {
        if (value == null) {
            return null;
        }
        try {
            return mapper.writeValueAsString(value);
        } catch (Exception e) {
            log.warn("Failed to serialize onboarding json: {}", e.getMessage());
            return null;
        }
    }

    public Map<String, Object> readMap(String json) {
        if (!StringUtils.hasText(json)) {
            return null;
        }
        try {
            return mapper.readValue(json, new TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            log.warn("Failed to parse onboarding json map: {}", e.getMessage());
            return null;
        }
    }

    public List<String> readList(String json) {
        if (!StringUtils.hasText(json)) {
            return null;
        }
        try {
            return mapper.readValue(json, new TypeReference<List<String>>() {});
        } catch (Exception e) {
            log.warn("Failed to parse onboarding json list: {}", e.getMessage());
            return null;
        }
    }
}
