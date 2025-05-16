package vacademy.io.community_service.feature.question_bank.dto;


import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
@Builder
public class FilteredEntityResponseDto {
    private List<Map<String, Object>> content;
    private int pageNo;
    private int pageSize;
    private int totalPages;
    private long totalElements;
    private boolean last;
}

