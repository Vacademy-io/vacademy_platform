package vacademy.io.community_service.feature.content_structure.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;


@Data
@AllArgsConstructor  // Generates a constructor with all fields
@NoArgsConstructor   // Generates a no-arg constructor (important for serialization)
public class LevelDto {
    private String levelId;
    private String levelName;
}
