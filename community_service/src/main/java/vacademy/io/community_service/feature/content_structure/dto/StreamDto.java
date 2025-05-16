package vacademy.io.community_service.feature.content_structure.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor  // Generates constructor with all fields
@NoArgsConstructor   // Generates no-arg constructor (important for JSON serialization)
public class StreamDto {
    private String streamId;
    private String streamName;
}
