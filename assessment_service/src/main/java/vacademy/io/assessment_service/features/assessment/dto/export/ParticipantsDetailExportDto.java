package vacademy.io.assessment_service.features.assessment.dto.export;

import lombok.Builder;

import java.util.Date;

@Builder
public class ParticipantsDetailExportDto {
    private String name;
    private String email;
    private Double marksObtained;
    private Double totalMarks;
    private String percentage;
    private Integer rank;
    private String duration;
    private Date attemptDate;
}
