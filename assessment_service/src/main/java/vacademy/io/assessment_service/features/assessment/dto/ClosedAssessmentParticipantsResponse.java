package vacademy.io.assessment_service.features.assessment.dto;


import java.util.Date;
import java.util.List;

public class ClosedAssessmentParticipantsResponse {
    private Date createdOn;
    private Date startDate;
    private Date endDate;
    private String subjectName;
    private Long duration;
    private Long totalParticipants;
    private double averageDuration;
    private double averageMarks;
//    private ParticipantsDetailResponse;



    public static class ParticipantsDetailResponse{
        private String type;
        private List<ParticipantsDetailsDto> participantDetails;
    }


}
