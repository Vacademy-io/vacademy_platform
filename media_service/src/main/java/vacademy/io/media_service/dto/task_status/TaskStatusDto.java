package vacademy.io.media_service.dto.task_status;


import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.*;

import java.util.Date;

@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@ToString
@Builder
public class TaskStatusDto {
    private String id;
    private String taskName;
    private String instituteId;
    private String status;
    private String resultJson;
    private String inputId;
    private String inputType;
    private Date createdAt;
    private Date updatedAt;
}
