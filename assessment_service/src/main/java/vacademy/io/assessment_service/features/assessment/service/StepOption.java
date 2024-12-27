package vacademy.io.assessment_service.features.assessment.service;


import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.docx4j.org.apache.xpath.operations.Bool;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@AllArgsConstructor
@NoArgsConstructor
public class StepOption {
    String key;
    String value;
    String valueId;
    Boolean sendValueId;
}
