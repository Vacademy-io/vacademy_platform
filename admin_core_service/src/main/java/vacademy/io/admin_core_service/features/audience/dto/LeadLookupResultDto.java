package vacademy.io.admin_core_service.features.audience.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Answer to "is this phone / email already in the system?".
 *
 * Every field is nullable and {@code NON_NULL} is deliberate: a field the
 * institute did not share is absent from the JSON entirely, not sent as null.
 * Hiding a column in the UI while still shipping its value would make the
 * network tab a way around the setting.
 *
 * There is no lead id, response id or user id here, and that is also deliberate
 * — with one the caller could pivot to the lead-profile endpoints, which apply
 * no such masking.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class LeadLookupResultDto {

    /** False means no match; every other field is then absent. */
    private boolean found;

    private String leadName;
    private String leadEmail;
    private String leadMobile;
    private String counsellorName;
    /** The institute's "Source" — audience.campaign_type. */
    private String campaignType;
    /** The institute's "Campaign" / "Label" — audience.campaign_name. */
    private String campaignName;
    private String status;
    private String course;

    /**
     * True when the lead opted out. Always sent on a match, regardless of which
     * fields the institute shares — "do not call this person" is a warning, not
     * lead data, and withholding it would cause the exact call it prevents.
     */
    private Boolean optedOut;
}
