package vacademy.io.community_service.feature.roadmap.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Date;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RoadmapDto {
    private String htmlContent;
    private Date updatedAt;
}
