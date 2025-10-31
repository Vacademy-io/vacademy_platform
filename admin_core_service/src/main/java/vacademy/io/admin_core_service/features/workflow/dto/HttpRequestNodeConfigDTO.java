package vacademy.io.admin_core_service.features.workflow.dto;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@NoArgsConstructor
public class HttpRequestNodeConfigDTO {

    private RequestConfig config;
    private String resultKey = "httpResult";
    private List<RoutingDTO> routing;
    private String compute;

    @Data
    @NoArgsConstructor
    public static class RequestConfig {
        private String requestType = "EXTERNAL"; // New field: "EXTERNAL" or "INTERNAL"
        private String condition;
        private String url;
        private String method = "GET";
        private JsonNode headers;
        private AuthenticationConfig authentication; // Will be used differently based on requestType
        private JsonNode queryParams;
        private JsonNode body;
    }

    @Data
    @NoArgsConstructor
    public static class AuthenticationConfig {
        private String type; // e.g., "BASIC", "BEARER", or "INTERNAL"

        // For "BASIC"
        private String username;
        private String password;

        // For "BEARER"
        private String token;

        // For "INTERNAL" (New)
        private String clientName;
    }
}