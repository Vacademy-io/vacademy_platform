package vacademy.io.community_service.feature.presentation.dto.question;


import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import vacademy.io.community_service.feature.presentation.entity.Presentation;

import java.util.Date;
import java.util.List;

@NoArgsConstructor
@AllArgsConstructor
@Getter
@Setter
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@JsonIgnoreProperties(ignoreUnknown = true)
public class AddPresentationDto {

    private String id;

    private String title;

    private String description;

    private String coverFileId;

    private String status;

    private Date createdAt;
    private Date updatedAt;

    private Integer addedSlidesCount;

    private List<PresentationSlideDto> addedSlides;

    public AddPresentationDto(Presentation presentation) {
        this.id = presentation.getId();
        this.addedSlidesCount = (presentation.getPresentationSlides() == null)? 0 : presentation.getPresentationSlides().size();
        this.title = presentation.getTitle();
        this.description = presentation.getDescription();
        this.coverFileId = presentation.getCoverFileId();
        this.status = presentation.getStatus();
        this.createdAt = presentation.getUpdatedAt();
    }
}