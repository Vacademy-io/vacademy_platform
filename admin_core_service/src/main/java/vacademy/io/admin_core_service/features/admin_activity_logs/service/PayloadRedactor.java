package vacademy.io.admin_core_service.features.admin_activity_logs.service;

import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Masks sensitive keys in a JSON-shaped object tree before serialization.
 * Operates on Maps, Lists, and primitives — the same shapes Jackson produces
 * from a {@code @RequestBody} DTO via {@code convertValue}.
 *
 * <p>Match is case-insensitive on key names. The set covers credentials,
 * tokens, and payment-instrument fields; extend via the constructor if a
 * deployment needs more.
 */
@Component
public class PayloadRedactor {

    private static final String MASK = "***";

    private static final Set<String> DEFAULT_SENSITIVE_KEYS = new HashSet<>(Arrays.asList(
            "password",
            "pwd",
            "secret",
            "token",
            "accesstoken",
            "refreshtoken",
            "apikey",
            "api_key",
            "otp",
            "pin",
            "cvv",
            "cardnumber",
            "card_number",
            "cardno",
            "ssn",
            "aadhaar",
            "aadhar",
            "authorization"));

    private final Set<String> sensitiveKeys;

    public PayloadRedactor() {
        this.sensitiveKeys = DEFAULT_SENSITIVE_KEYS;
    }

    public Object redact(Object input) {
        return redactInternal(input);
    }

    @SuppressWarnings("unchecked")
    private Object redactInternal(Object node) {
        if (node == null) {
            return null;
        }
        if (node instanceof Map<?, ?> map) {
            Map<String, Object> copy = new LinkedHashMap<>(map.size());
            for (Map.Entry<?, ?> entry : map.entrySet()) {
                String key = String.valueOf(entry.getKey());
                if (isSensitive(key)) {
                    copy.put(key, MASK);
                } else {
                    copy.put(key, redactInternal(entry.getValue()));
                }
            }
            return copy;
        }
        if (node instanceof Collection<?> col) {
            List<Object> copy = new ArrayList<>(col.size());
            for (Object item : col) {
                copy.add(redactInternal(item));
            }
            return copy;
        }
        return node;
    }

    private boolean isSensitive(String key) {
        if (key == null) {
            return false;
        }
        return sensitiveKeys.contains(key.toLowerCase().replace("-", "").replace("_", ""));
    }
}
