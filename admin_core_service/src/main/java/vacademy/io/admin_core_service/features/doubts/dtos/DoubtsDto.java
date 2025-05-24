package vacademy.io.admin_core_service.features.doubts.dtos;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;

@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class DoubtsDto {
    private String id;
    private String userId;
    private String source;
    private String sourceId;
    private Date raisedTime;
    private Date resolvedTime;
    private String contentPosition;
    private String contentType;
    private String htmlText;
    private String status;
    private String parentId;
    private Integer parentLevel;
    private List<String> doubtAssigneeRequestUserIds = new ArrayList<>();
    private List<DoubtAssigneeDto> allDoubtAssignee = new ArrayList<>();
    private List<String> deleteAssigneeRequest = new ArrayList<>();
    private List<DoubtsDto> replies = new ArrayList<>();
}
