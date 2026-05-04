package vacademy.io.assessment_service.features.assessment.dto.Questio_type_based_dtos.coding;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class CodingMarkingDto {
    private String type;
    private DataFields data;

    @Getter
    @Setter
    @AllArgsConstructor
    @NoArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class DataFields {
        private double totalMark;
        private double negativeMark;
        // partialMarking = true: score = passedCount/totalCount * totalMark
        // partialMarking = false: only ACCEPTED yields totalMark, anything else 0
        private boolean partialMarking;
    }
}
