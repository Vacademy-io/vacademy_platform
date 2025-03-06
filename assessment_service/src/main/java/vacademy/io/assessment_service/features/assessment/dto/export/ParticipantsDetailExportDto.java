package vacademy.io.assessment_service.features.assessment.dto.export;

import lombok.Builder;

import java.security.PrivateKey;
import java.util.Date;

@Builder
public class ParticipantsDetailExportDto {
    private String studentName;
    private Date attemptDate;
    private Date endTime;
    private Long duration;
    private Double score;
}
