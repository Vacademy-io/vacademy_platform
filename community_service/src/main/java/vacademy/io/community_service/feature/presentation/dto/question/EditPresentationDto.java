package vacademy.io.community_service.feature.presentation.dto.question;


import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

@NoArgsConstructor
@AllArgsConstructor
@Getter
@Setter
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@JsonIgnoreProperties(ignoreUnknown = true)
public class EditPresentationDto {

    private String id;

    private String title;

    private String description;

    private String coverFileId;

    private String status;

    private List<PresentationSlideDto> updatedSlides;

    private List<PresentationSlideDto> deletedSlides;

    private List<PresentationSlideDto> addedSlides;
}