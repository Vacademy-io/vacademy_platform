package vacademy.io.admin_core_service.features.doubts.dtos;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Date;
import java.util.List;
import java.util.Map;


@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class DoubtsRequestFilter {
    private String name;
    private Date startDate;
    private Date endDate;
    private List<String> userIds;
    private List<String> contentPositions;
    private List<String> contentTypes;
    private List<String> sources;
    private List<String> sourceIds;
    private List<String> status;
    private List<String> batchIds;
    Map<String, String> sortColumns;
}
