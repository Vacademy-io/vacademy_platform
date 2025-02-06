package vacademy.io.admin_core_service.features.learner.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Data;
import vacademy.io.admin_core_service.features.slide.dto.SlideDetailProjection;

import java.util.List;

@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
@Data
@AllArgsConstructor
public class LeanerDashBoardDetailDTO {
    private Integer courses;
    private Integer testsAssigned;
    private List<SlideDetailProjection> slides;
    public LeanerDashBoardDetailDTO() {}
}
