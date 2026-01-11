package vacademy.io.admin_core_service.features.audience.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BatchPhoneNumberRequest {
    private List<String> phoneNumbers;
}
