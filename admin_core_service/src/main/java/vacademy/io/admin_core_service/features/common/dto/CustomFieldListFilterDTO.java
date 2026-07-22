package vacademy.io.admin_core_service.features.common.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * One custom-field filter entry for the admin list surfaces (Recent Leads,
 * Audience lists, All Contacts, Students). Values within an entry OR together
 * (city = Pune OR Mumbai); entries AND across fields. Same wire shape as
 * LeadFilterDTO.CustomFieldFilter so every surface accepts the identical
 * `custom_field_filters: [{field_id, operator, values}]` payload.
 *
 * Operators (null/blank = IN, the original values-in-list behavior):
 * <ul>
 *   <li>IN — value matches any of `values`.</li>
 *   <li>CONTAINS — case-insensitive substring match on any of `values`.</li>
 *   <li>IS_EMPTY — the entity has no stored value (no row, or blank).</li>
 *   <li>NOT_EMPTY — the entity has a non-blank stored value.</li>
 *   <li>BETWEEN — values = [from, to]; date compare when both look like
 *       yyyy-MM-dd, else numeric. Rows whose stored text can't be cast are
 *       treated as non-matching.</li>
 *   <li>GTE / LTE — values = [bound]; same date/numeric detection.</li>
 * </ul>
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CustomFieldListFilterDTO {
    private String fieldId;
    private String operator;
    private List<String> values;

    public CustomFieldListFilterDTO(String fieldId, List<String> values) {
        this.fieldId = fieldId;
        this.values = values;
    }
}
