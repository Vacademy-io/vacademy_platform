package vacademy.io.admin_core_service.features.slide.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.common.ai.dto.RichTextDataDTO;

import java.sql.Date;

@Data
@AllArgsConstructor
@NoArgsConstructor
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class AssignmentSlideDTO {

    private String id;

    private RichTextDataDTO parentRichText;

    private RichTextDataDTO textData;

    private Date liveDate;

    private Date endDate;

    private Integer reAttemptCount;

    private String commaSeparatedMediaIds;
}
