package vacademy.io.media_service.dto.ll_ai;

import com.fasterxml.jackson.annotation.JsonAlias;
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
@Builder
public class IncidentAIStructureResponse {
    private String eventCode;
    private String category;
    private String subcategory;
    private String description;
    private String title;
    private Boolean isSuspectKnown;
    private Boolean wasReportedToPolice;

    private List<PersonInjuredAI> peopleInjured;
    @JsonAlias("property_damages")
    private List<PropertyLossAI> propertyLoss;
    private List<SuspectAI> suspects;

    @Getter
    @Setter
    @AllArgsConstructor
    @NoArgsConstructor
    @ToString
    @Builder
    @JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
    public static class SuspectAI {
        private String name;
        private String description;
    }

    @Getter
    @Setter
    @AllArgsConstructor
    @NoArgsConstructor
    @ToString
    @Builder
    @JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
    public static class PersonInjuredAI {
        private String name;
        private String nature;
        private Boolean isEmployee;
        private String idNumber;
    }

    @Getter
    @Setter
    @AllArgsConstructor
    @NoArgsConstructor
    @ToString
    @Builder
    @JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
    public static class PropertyLossAI {
        private String name;
        private String description;
        private Double lossValue;
        private String type;
    }
}
