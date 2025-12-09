package vacademy.io.admin_core_service.features.notification.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class WatiConfig {
    
    @JsonProperty("apiKey")
    private String apiKey;
    
    @JsonProperty("apiUrl")
    private String apiUrl;
    
    @JsonProperty("whatsappNumber")
    private String whatsappNumber;
    
    @JsonProperty("enableContactAttributeUpdate")
    private Boolean enableContactAttributeUpdate;
    
    @JsonProperty("contactAttributeMappings")
    private List<AttributeMapping> contactAttributeMappings;
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class AttributeMapping {
        @JsonProperty("name")
        private String name;
        
        @JsonProperty("valueKey")
        private String valueKey;
    }
}
