package vacademy.io.admin_core_service.features.fee_management.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Side-view request to apply/modify/remove the whole-CPO discount on a UserPlan.
 *
 * <ul>
 *   <li>{@code discount != null} → apply or modify.</li>
 *   <li>{@code discount == null && remove=true} → remove existing discount.</li>
 *   <li>{@code discount == null && remove=false} → 400.</li>
 * </ul>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class ApplyCpoDiscountRequestDTO {

    private DiscountSpecDTO discount;
    private boolean remove;
}
