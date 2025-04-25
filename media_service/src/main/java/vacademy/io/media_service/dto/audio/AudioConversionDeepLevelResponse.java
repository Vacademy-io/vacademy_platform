package vacademy.io.media_service.dto.audio;


import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.*;

import java.util.List;

@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@ToString
@JsonIgnoreProperties(ignoreUnknown = true)
public class AudioConversionDeepLevelResponse {
    String text;
    String status;
    Double languageConfidenceThreshold;
    Double languageConfidence;
//    List<WordsDto> words;
    Double confidence;
    Long audioDuration;
    Boolean disfluencies;
    Boolean multichannel;
    Integer multiChannels;
    SentimentAnalysisDto sentimentAnalysisResults;
}
