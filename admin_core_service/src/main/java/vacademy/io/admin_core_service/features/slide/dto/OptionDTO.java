package vacademy.io.admin_core_service.features.slide.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import vacademy.io.common.ai.dto.RichTextDataDTO;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class OptionDTO {

    private String id;

    private String questionSlideId;  // questionSlide reference

    private RichTextDataDTO text;

    private RichTextDataDTO explanationTextData;

    private String mediaId;
}
