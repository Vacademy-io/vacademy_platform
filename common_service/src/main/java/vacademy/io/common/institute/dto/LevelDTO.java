package vacademy.io.common.institute.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import jakarta.persistence.Column;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.common.institute.entity.Level;
import vacademy.io.common.institute.entity.LevelProjection;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@JsonIgnoreProperties(ignoreUnknown = true)
public class LevelDTO {
    private String id;
    private String levelName;
    private Integer durationInDays;
    private String thumbnailId;

    public LevelDTO(Level level) {
        this.id = level.getId();
        this.levelName = level.getLevelName();
        this.durationInDays = level.getDurationInDays();
    }

    public LevelDTO(LevelProjection level) {
        this.id = level.getId();
        this.levelName = level.getLevelName();
        this.durationInDays = level.getDurationInDays();
    }
}