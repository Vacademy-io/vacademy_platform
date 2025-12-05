package vacademy.io.admin_core_service.features.user_resolution.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class CentralizedRecipientResolutionRequest {

    @NotBlank(message = "Institute ID is required")
    private String instituteId;

    @NotEmpty(message = "At least one recipient is required")
    @Valid
    private List<RecipientWithExclusions> recipients;

    private int pageNumber = 0;
    private int pageSize = 1000;

    @Getter
    @Setter
    @AllArgsConstructor
    @NoArgsConstructor
    public static class RecipientWithExclusions {

        @NotBlank(message = "Recipient type is required")
        private String recipientType;

        @NotBlank(message = "Recipient ID is required")
        private String recipientId;

        // Custom field filters applied to this recipient (before exclusions)
        @Valid
        private List<CustomFieldFilter> customFieldFilters;

        // Exclusions for this recipient (applied after custom field filters)
        @Valid
        private List<Exclusion> exclusions;

        @Getter
        @Setter
        @AllArgsConstructor
        @NoArgsConstructor
        public static class Exclusion {

            @NotBlank(message = "Exclusion type is required")
            private String exclusionType;

            private String exclusionId; // For USER, ROLE, PACKAGE_SESSION, etc.

            // Custom field filters for this exclusion (optional)
            @Valid
            private List<CustomFieldFilter> customFieldFilters;
        }

        @Getter
        @Setter
        @AllArgsConstructor
        @NoArgsConstructor
        public static class CustomFieldFilter {

            private String fieldName;
            private String fieldValue;
            private String operator = "equals"; // equals, contains, not_equals, etc.
        }
    }
}
