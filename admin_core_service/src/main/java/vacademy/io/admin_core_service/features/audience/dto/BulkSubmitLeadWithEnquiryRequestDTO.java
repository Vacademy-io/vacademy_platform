package vacademy.io.admin_core_service.features.audience.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Bulk request for submitting leads with enquiry.
 *
 * Intended shape:
 * {
 *   "audience_id": "...",
 *   "rows": [ SubmitLeadWithEnquiryRequestDTO, ... ]
 * }
 *
 * Note: each row may omit `audience_id` (it will be taken from the root `audience_id`).
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class BulkSubmitLeadWithEnquiryRequestDTO {

    /**
     * Audience campaign ID. Used as default for rows where `audience_id` is omitted.
     */
    private String audienceId;

    /**
     * One row per CSV record.
     */
    private List<SubmitLeadWithEnquiryRequestDTO> rows;
}

