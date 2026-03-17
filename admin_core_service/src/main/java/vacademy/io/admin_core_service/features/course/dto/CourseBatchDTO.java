package vacademy.io.admin_core_service.features.course.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.Date;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CourseBatchDTO {
    private String id;
    private MiniPackageDTO packageDto;
    private MiniLevelDTO level;
    private MiniSessionDTO session;
    private Integer readTimeInMinutes;
    private Boolean isParent;
    private String parentId;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class MiniPackageDTO {
        private String id;
        private String packageName;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class MiniLevelDTO {
        private String id;
        private String levelName;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class MiniSessionDTO {
        private String id;
        private String sessionName;
        private Date startDate;
    }
}
