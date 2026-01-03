package vacademy.io.admin_core_service.features.agent.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import jakarta.validation.constraints.NotBlank;

/**
 * Request to respond to an agent's confirmation/question
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AgentRespondRequest {

    @NotBlank(message = "Response is required")
    private String response;

    // Optional: If responding to a specific option
    private String optionId;
}
