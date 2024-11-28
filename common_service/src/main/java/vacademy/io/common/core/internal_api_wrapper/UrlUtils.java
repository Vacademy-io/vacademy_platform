package vacademy.io.common.core.internal_api_wrapper;

import org.springframework.stereotype.Component;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;


@Component
public class UrlUtils {
    public static String encodeDataAfterQuestionMark(String input) {
        int questionMarkIndex = input.indexOf("?");
        if (questionMarkIndex != -1) {
            // Split the input into path and query string
            String path = input.substring(0, questionMarkIndex);
            String queryString = input.substring(questionMarkIndex + 1);

            // URL encode each parameter in the query string
            StringBuilder encodedQueryString = new StringBuilder();
            String[] paramPairs = queryString.split("&");
            for (String paramPair : paramPairs) {
                String[] keyValue = paramPair.split("=");
                String key = keyValue[0];
                String value = keyValue.length > 1 ? keyValue[1] : "";

                value = URLEncoder.encode(value, StandardCharsets.UTF_8); // Encode value

                encodedQueryString.append(key).append("=").append(value).append("&");
            }

            // Remove the trailing "&" if any
            if (!encodedQueryString.isEmpty()) {
                encodedQueryString.deleteCharAt(encodedQueryString.length() - 1);
            }

            // Combine the encoded query string with the path
            return path + "?" + encodedQueryString;
        } else {
            // No query string, return the original input
            return input;
        }
    }
}
