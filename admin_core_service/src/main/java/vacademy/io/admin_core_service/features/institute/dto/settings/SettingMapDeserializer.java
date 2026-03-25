package vacademy.io.admin_core_service.features.institute.dto.settings;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.JsonToken;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonDeserializer;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Custom deserializer for the settings map that handles cases where a setting value
 * is stored as a raw array or primitive instead of a proper SettingDto object.
 * This prevents deserialization failures when legacy or malformed data exists in the database.
 */
public class SettingMapDeserializer extends JsonDeserializer<Map<String, SettingDto>> {

    @Override
    public Map<String, SettingDto> deserialize(JsonParser p, DeserializationContext ctxt) throws IOException {
        Map<String, SettingDto> result = new LinkedHashMap<>();
        ObjectMapper mapper = (ObjectMapper) p.getCodec();

        if (p.currentToken() != JsonToken.START_OBJECT) {
            return result;
        }

        while (p.nextToken() != JsonToken.END_OBJECT) {
            String key = p.currentName();
            p.nextToken();

            try {
                JsonNode node = mapper.readTree(p);

                if (node.isObject() && (node.has("key") || node.has("name") || node.has("data"))) {
                    // Standard SettingDto structure — deserialize normally
                    SettingDto dto = mapper.treeToValue(node, SettingDto.class);
                    result.put(key, dto);
                } else {
                    // Non-standard value (array, primitive, or object without key/name/data)
                    // Wrap it in a SettingDto with the raw value as data
                    SettingDto dto = new SettingDto();
                    dto.setKey(key);
                    dto.setName(key);
                    dto.setData(mapper.treeToValue(node, Object.class));
                    result.put(key, dto);
                }
            } catch (Exception e) {
                // If anything goes wrong, skip this entry rather than failing the whole request
                SettingDto dto = new SettingDto();
                dto.setKey(key);
                dto.setName(key);
                result.put(key, dto);
            }
        }

        return result;
    }
}
