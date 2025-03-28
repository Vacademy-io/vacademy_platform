package vacademy.io.assessment_service.features.assessment.dto.manual_evaluation;

import lombok.Builder;
import lombok.Data;
import vacademy.io.assessment_service.features.assessment.dto.LeaderBoardDto;

import java.util.ArrayList;
import java.util.List;


@Builder
@Data
public class ManualAttemptResponse {
    private List<ManualAttemptResponseDto> content = new ArrayList<>();
    private int pageNo;
    private int pageSize;
    private long totalElements;
    private int totalPages;
    private boolean last;
}
