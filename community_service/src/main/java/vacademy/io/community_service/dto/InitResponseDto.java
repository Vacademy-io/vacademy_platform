package vacademy.io.community_service.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;
import java.util.Map;

@Data
@NoArgsConstructor  // Required for Spring
public class InitResponseDto {
    private Map<String, List<String>> options;

    // Explicitly define constructor (sometimes Lombok may not generate it properly)
    public InitResponseDto(Map<String, List<String>> options) {
        this.options = options;
    }
}
