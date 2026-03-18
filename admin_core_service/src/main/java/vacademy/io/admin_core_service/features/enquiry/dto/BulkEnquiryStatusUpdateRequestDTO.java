package vacademy.io.admin_core_service.features.enquiry.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@JsonIgnoreProperties(ignoreUnknown = true)
public class BulkEnquiryStatusUpdateRequestDTO {

        /** List of enquiry UUIDs to update (required, must not be empty). */
        private List<String> enquiryIds;

        /**
         * New enquiry status to apply (optional – e.g. "NEW", "FOLLOW_UP", "CLOSED").
         */
        private String enquiryStatus;

        /**
         * New conversion status to apply (optional – e.g. "CONVERTED",
         * "NOT_CONVERTED").
         */
        private String conversionStatus;
}
