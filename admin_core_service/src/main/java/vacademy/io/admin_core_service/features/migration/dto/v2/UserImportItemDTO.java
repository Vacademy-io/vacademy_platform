package vacademy.io.admin_core_service.features.migration.dto.v2;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Individual user item for import
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserImportItemDTO {

    // ===== Primary Identification =====

    @JsonProperty("email")
    private String email;

    @JsonProperty("phone")
    private String phone;

    // ===== User Details =====

    @JsonProperty("first_name")
    private String firstName;

    @JsonProperty("last_name")
    private String lastName;

    @JsonProperty("full_name")
    private String fullName;

    @JsonProperty("username")
    private String username;

    @JsonProperty("password")
    private String password;

    @JsonProperty("roles")
    private List<String> roles;

    // ===== Student Profile =====

    @JsonProperty("address_line")
    private String addressLine;

    @JsonProperty("city")
    private String city;

    @JsonProperty("region")
    private String region;

    @JsonProperty("pin_code")
    private String pinCode;

    @JsonProperty("country")
    private String country;

    // ===== Custom Fields =====

    @JsonProperty("custom_fields")
    private List<CustomFieldImportDTO> customFields;

    // ===== External Reference =====

    @JsonProperty("external_id")
    private String externalId;

    @JsonProperty("external_source")
    private String externalSource;

    // ===== Payment Gateway =====

    @JsonProperty("payment_gateway")
    private PaymentGatewayImportDTO paymentGateway;

    // ===== Tags =====

    /**
     * Tags to assign to this user
     */
    @JsonProperty("tags")
    private List<TagImportDTO> tags;

    // Helper methods
    public String getEffectiveFullName() {
        if (fullName != null && !fullName.isBlank()) {
            return fullName;
        }
        StringBuilder sb = new StringBuilder();
        if (firstName != null) {
            sb.append(firstName);
        }
        if (lastName != null) {
            if (sb.length() > 0)
                sb.append(" ");
            sb.append(lastName);
        }
        return sb.length() > 0 ? sb.toString() : null;
    }

    public String getEffectiveUsername() {
        if (username != null && !username.isBlank()) {
            return username;
        }
        return email;
    }

    public List<String> getEffectiveRoles() {
        if (roles != null && !roles.isEmpty()) {
            return roles;
        }
        return List.of("STUDENT");
    }
}
