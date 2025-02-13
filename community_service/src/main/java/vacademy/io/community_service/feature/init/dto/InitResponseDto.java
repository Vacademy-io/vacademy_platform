package vacademy.io.community_service.feature.init.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;
import java.util.Map;

@Data
@NoArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class InitResponseDto {
    private List<LevelDto> levels;
    private Map<String, List<StreamDto>> streams;
    private Map<String, List<SubjectDto>> subjects;
    private List<String> difficulties;
    private List<String> topics;
    private List<String> types;

    public InitResponseDto(List<LevelDto> levels,
                           Map<String, List<StreamDto>> streams,
                           Map<String, List<SubjectDto>> subjects,
                           List<String> difficulties,
                           List<String> topics,
                           List<String> types) {
        this.levels = levels;
        this.streams = streams;
        this.subjects = subjects;
        this.difficulties = difficulties;
        this.topics = topics;
        this.types = types;
    }
}
