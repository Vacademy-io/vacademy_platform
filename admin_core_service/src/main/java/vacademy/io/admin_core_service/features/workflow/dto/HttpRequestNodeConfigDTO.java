package vacademy.io.admin_core_service.features.workflow.dto;

import com.fasterxml.jackson.databind.JsonNode; // Keep JsonNode for flexible body/headers/queryParams
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@NoArgsConstructor
public class HttpRequestNodeConfigDTO {

    // Top-level fields in the node_template config_json
    private RequestConfig config;
    private String resultKey = "httpResult"; // Default result key
    private List<RoutingDTO> routing; // Use existing RoutingDTO if applicable
    private String compute;
    @Data
    @NoArgsConstructor
    public static class RequestConfig {
        private String condition; // Optional SpEL condition
        private String url;
        private String method = "GET"; // Default method
        private JsonNode headers; // Use JsonNode for flexibility with SpEL inside
        private AuthenticationConfig authentication;
        private JsonNode queryParams; // Use JsonNode for flexibility
        private JsonNode body; // Use JsonNode for flexibility (SpEL evaluation needed)
    }

    @Data
    @NoArgsConstructor
    public static class AuthenticationConfig {
        private String type; // e.g., "BASIC", "BEARER"
        private String username; // SpEL allowed
        private String password; // SpEL allowed
        private String token;    // SpEL allowed (for Bearer)
    }
}
