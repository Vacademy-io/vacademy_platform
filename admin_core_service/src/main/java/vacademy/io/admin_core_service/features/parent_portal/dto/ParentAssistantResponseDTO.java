package vacademy.io.admin_core_service.features.parent_portal.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ParentAssistantResponseDTO {
    private String answer;
    /** false when the LLM is unavailable — the client then uses its preset answers. */
    private boolean available;
}
