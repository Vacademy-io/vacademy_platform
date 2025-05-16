package vacademy.io.community_service.feature.presentation.dto.question;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.Date;

@NoArgsConstructor
@AllArgsConstructor
@Getter
@Setter
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@JsonIgnoreProperties(ignoreUnknown = true)
public class PresentationSlideDto {

    private String id;

    private String presentationId;

    private String title;

    private String sourceId;

    private String source;

    private String status;

    private String interactionStatus;

    private Integer slideOrder;

    private Integer defaultTime;

    private String content;

    private Date createdAt;

    private Date updatedAt;

    private QuestionDTO addedQuestion;

    private QuestionDTO updatedQuestion;

}