package vacademy.io.admin_core_service.features.booking.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * One custom question shown on a booking page's public form, stored in
 * {@code booking_page.form_fields_json}. Independent of any audience list — the
 * host owns these directly. On the learner form they render exactly like audience
 * custom fields (converted to InstituteCustomFieldDTO on read); answers are keyed
 * by {@code id} and saved on {@code booking_instance.custom_field_values_json}.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class BookingFormFieldDTO {

    /** Stable key used as the field key and the answer key. */
    private String id;

    /** Question label shown to the invitee. */
    private String label;

    /** One of: text | textarea | dropdown | number | email | phone. */
    private String fieldType;

    /** Whether the invitee must answer. */
    private Boolean required;

    /** Choices for {@code dropdown} (ignored for other types). */
    private List<String> options;
}
