package vacademy.io.assessment_service.features.assessment.manager;

import com.itextpdf.html2pdf.ConverterProperties;
import com.itextpdf.html2pdf.HtmlConverter;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.InputStreamResource;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import vacademy.io.assessment_service.features.assessment.dto.AssessmentUserFilter;
import vacademy.io.assessment_service.features.assessment.dto.LeaderBoardDto;
import vacademy.io.assessment_service.features.assessment.dto.ParticipantsDetailsDto;
import vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.request.RespondentFilter;
import vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.response.MarksRankDto;
import vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.response.RespondentListDto;
import vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.response.StudentReportOverallDetailDto;
import vacademy.io.assessment_service.features.assessment.dto.export.LeaderboardExportDto;
import vacademy.io.assessment_service.features.assessment.dto.export.MarkRankExportDto;
import vacademy.io.assessment_service.features.assessment.dto.export.ParticipantsDetailExportDto;
import vacademy.io.assessment_service.features.assessment.dto.export.RespondentExportDto;
import vacademy.io.assessment_service.features.assessment.entity.Assessment;
import vacademy.io.assessment_service.features.assessment.enums.AssessmentVisibility;
import vacademy.io.assessment_service.features.assessment.enums.UserRegistrationFilterEnum;
import vacademy.io.assessment_service.features.assessment.enums.UserRegistrationSources;
import vacademy.io.assessment_service.features.assessment.repository.AssessmentRepository;
import vacademy.io.assessment_service.features.assessment.repository.AssessmentUserRegistrationRepository;
import vacademy.io.assessment_service.features.assessment.repository.StudentAttemptRepository;
import vacademy.io.assessment_service.features.assessment.service.HtmlBuilderService;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.core.utils.DataToCsvConverter;
import vacademy.io.common.exceptions.VacademyException;

import java.io.ByteArrayOutputStream;
import java.util.*;

@Component
public class AdminExportManager {

    @Autowired
    StudentAttemptRepository studentAttemptRepository;

    @Autowired
    AssessmentUserRegistrationRepository assessmentUserRegistrationRepository;

    @Autowired
    HtmlBuilderService htmlBuilderService;

    @Autowired
    AssessmentParticipantsManager assessmentParticipantsManager;

    @Autowired
    AssessmentRepository assessmentRepository;

    public static String convertToReadableTime(Long timeInSeconds) {
        if (Objects.isNull(timeInSeconds) || timeInSeconds < 0) {
            return "Invalid Input";
        }

        long hours = timeInSeconds / 3600;
        long minutes = (timeInSeconds % 3600) / 60;
        long seconds = timeInSeconds % 60;

        StringBuilder result = new StringBuilder();
        if (hours > 0) {
            result.append(hours).append(" hr ");
        }
        if (minutes > 0) {
            result.append(minutes).append(" min ");
        }
        if (seconds > 0 || result.isEmpty()) { // Always show at least seconds if the input is 0
            result.append(seconds).append(" sec");
        }

        return result.toString().trim();
    }

    public ResponseEntity<byte[]> getLeaderBoardCsvExport(CustomUserDetails user, String assessmentId, String instituteId) {

        List<LeaderBoardDto> leaderBoardDtos = studentAttemptRepository.findLeaderBoardForAssessmentAndInstituteId(assessmentId, instituteId, List.of("ACTIVE"));
        List<LeaderboardExportDto> leaderboardCsvDtos = createCsvDtoFromLeaderboardDto(leaderBoardDtos);
        return DataToCsvConverter.convertListToCsv(leaderboardCsvDtos);

    }

    private List<LeaderboardExportDto> createCsvDtoFromLeaderboardDto(List<LeaderBoardDto> leaderBoardDtos) {
        List<LeaderboardExportDto> response = new ArrayList<>();
        leaderBoardDtos.forEach(leaderBoardDto -> {
            response.add(LeaderboardExportDto.builder()
                    .Marks(leaderBoardDto.getAchievedMarks())
                    .Rank(leaderBoardDto.getRank())
                    .ParticipantsName(leaderBoardDto.getStudentName())
                    .Percentile(leaderBoardDto.getPercentile())
                    .TimeTaken(convertToReadableTime(leaderBoardDto.getCompletionTimeInSeconds()))
                    .build());
        });

        return response;
    }

    public ResponseEntity<InputStreamResource> getLeaderboardPdfExport(CustomUserDetails user, String assessmentId, String instituteId) {
        Optional<Assessment> assessmentOptional = assessmentRepository.findById(assessmentId);
        if (assessmentOptional.isEmpty()) throw new VacademyException("Assessment Not Found");

        List<LeaderBoardDto> leaderBoardDtos = studentAttemptRepository.findLeaderBoardForAssessmentAndInstituteId(assessmentId, instituteId, List.of("ACTIVE"));
        List<LeaderboardExportDto> leaderboardCsvDtos = createCsvDtoFromLeaderboardDto(leaderBoardDtos);
        return DataToCsvConverter.buildPdfResponse(assessmentOptional.get().getName().toUpperCase(), "LEADERBOARD", leaderboardCsvDtos, "leaderboard");
    }

    public ResponseEntity<byte[]> getMarksRankCsvExport(CustomUserDetails user, String assessmentId, String instituteId) {
        List<MarksRankDto> marksRankDtos = studentAttemptRepository.findMarkRankForAssessment(assessmentId, instituteId);
        List<MarkRankExportDto> markRankExportDtos = createMarkRankExportDto(marksRankDtos);
        return DataToCsvConverter.convertListToCsv(markRankExportDtos);
    }

    private List<MarkRankExportDto> createMarkRankExportDto(List<MarksRankDto> marksRankDtos) {
        List<MarkRankExportDto> response = new ArrayList<>();
        marksRankDtos.forEach(marksRankDto -> {
            response.add(MarkRankExportDto.builder()
                    .marks(marksRankDto.getMarks())
                    .rank(marksRankDto.getRank())
                    .noOfParticipants(marksRankDto.getNoOfParticipants())
                    .percentile(marksRankDto.getPercentile()).build());
        });

        return response;
    }

    public ResponseEntity<InputStreamResource> getMarksRankPdfExport(CustomUserDetails user, String assessmentId, String instituteId) {
        Optional<Assessment> assessmentOptional = assessmentRepository.findById(assessmentId);
        if (assessmentOptional.isEmpty()) throw new VacademyException("Assessment Not Found");

        List<MarksRankDto> marksRankDtos = studentAttemptRepository.findMarkRankForAssessment(assessmentId, instituteId);
        List<MarkRankExportDto> markRankExportDtos = createMarkRankExportDto(marksRankDtos);
        return DataToCsvConverter.buildPdfResponse(assessmentOptional.get().getName().toUpperCase(), "MARK-RANK LEADERBOARD", markRankExportDtos, "mark_rank");
    }

    public ResponseEntity<byte[]> getRegisteredCsvExport(CustomUserDetails user, String instituteId, String assessmentId, AssessmentUserFilter filter) {
        if (Objects.isNull(filter)) throw new VacademyException("Invalid Request");

        // Determine whether to fetch participants for an open or closed assessment
        if (filter.getAssessmentType().equals(AssessmentVisibility.PUBLIC.name())) {
            return handleCaseForPublicAssessment(instituteId, assessmentId, filter);
        } else {
            return handleCaseForPrivateAssessment(instituteId, assessmentId, filter);
        }
    }

    private ResponseEntity<byte[]> handleCaseForPrivateAssessment(String instituteId, String assessmentId, AssessmentUserFilter filter) {
        // Validate the filter
        if (Objects.isNull(filter)) {
            throw new VacademyException("Invalid Filter Request");
        }

        List<ParticipantsDetailsDto> participantsDetailsDtos = new ArrayList<>();

        // Check if the assessment attempt is pending
        if (isPendingAttempt(filter)) {
            participantsDetailsDtos = assessmentUserRegistrationRepository
                    .findUserRegistrationWithFilterAdminPreRegistrationAndPendingExport(
                            assessmentId, instituteId, filter.getStatus(),
                            filter.getRegistrationSource());

        } else {
            // If no results are found, perform a broader search
            participantsDetailsDtos = assessmentUserRegistrationRepository
                    .findUserRegistrationWithFilterForSourceExport(
                            assessmentId, instituteId, filter.getStatus(),
                            filter.getAttemptType(), filter.getRegistrationSource());
        }

        // Convert the retrieved data into the required response format
        return DataToCsvConverter.convertListToCsv(createExportDtoFromParticipantsDto(participantsDetailsDtos));
    }

    private ResponseEntity<byte[]> handleCaseForPublicAssessment(String instituteId, String assessmentId, AssessmentUserFilter filter) {
        if (Objects.isNull(filter)) throw new VacademyException("Invalid Filter Request");

        List<ParticipantsDetailsDto> participantsDetailsDtos = new ArrayList<>();
        Pageable pageable = null;

        //Handle Case for BATCH REGISTRATION
        if (filter.getRegistrationSource().equals(UserRegistrationSources.BATCH_PREVIEW_REGISTRATION.name())) {
            participantsDetailsDtos = handleCaseForBatchRegistration(assessmentId, instituteId, filter);
        }
        //Handle Case for ADMIN PRE REGISTRATION
        else if (filter.getRegistrationSource().equals(UserRegistrationSources.ADMIN_PRE_REGISTRATION.name())) {
            participantsDetailsDtos = handleCaseForAdminPreRegistration(assessmentId, instituteId, filter);
        } else throw new VacademyException("Invalid Source Request");

        return DataToCsvConverter.convertListToCsv(createExportDtoFromParticipantsDto(participantsDetailsDtos));
    }

    private List<ParticipantsDetailExportDto> createExportDtoFromParticipantsDto(List<ParticipantsDetailsDto> participantsDetailsDtos) {
        List<ParticipantsDetailExportDto> response = new ArrayList<>();
        participantsDetailsDtos.forEach(participantsDetailsDto -> {
            response.add(ParticipantsDetailExportDto.builder()
                    .attemptDate(participantsDetailsDto.getAttemptDate())
                    .duration(participantsDetailsDto.getDuration())
                    .endTime(participantsDetailsDto.getEndTime())
                    .score(participantsDetailsDto.getScore())
                    .studentName(participantsDetailsDto.getStudentName()).build());
        });
        return response;
    }

    private List<ParticipantsDetailsDto> handleCaseForAdminPreRegistration(String assessmentId, String instituteId, AssessmentUserFilter filter) {
        List<ParticipantsDetailsDto> ParticipantsDetailsDtos = new ArrayList<>();


        // Check if the attempt type is "PENDING"
        if (isPendingAttempt(filter)) {
            // If no results found, search for admin pre-registered and pending users
            ParticipantsDetailsDtos = assessmentUserRegistrationRepository
                    .findUserRegistrationWithFilterAdminPreRegistrationAndPendingExport(
                            assessmentId, instituteId, filter.getStatus(),
                            filter.getRegistrationSource());

        } else {
            // If no results found, search for users based on batch, attempt type, and registration source
            ParticipantsDetailsDtos = assessmentUserRegistrationRepository
                    .findUserRegistrationWithFilterForSourceExport(
                            assessmentId, instituteId, filter.getBatches(),
                            filter.getAttemptType(), filter.getRegistrationSource());
        }

        // Return the filtered list of registered users
        return ParticipantsDetailsDtos;
    }

    private List<ParticipantsDetailsDto> handleCaseForBatchRegistration(String assessmentId, String instituteId, AssessmentUserFilter filter) {
        List<ParticipantsDetailsDto> ParticipantsDetailsDto = new ArrayList<>();
        if (isPendingAttempt(filter)) {
            //TODO: Send request to admin core to get pending list for batch
        } else {
            //Handle Case for Attempted case i.e LIVE,PREVIEW,ENDED
            ParticipantsDetailsDto = assessmentUserRegistrationRepository.findUserRegistrationWithFilterForBatchForExport(assessmentId, instituteId, filter.getBatches(), filter.getStatus(), filter.getAttemptType());
        }

        return ParticipantsDetailsDto;
    }

    private boolean isPendingAttempt(AssessmentUserFilter filter) {
        // Return false if the filter is null
        if (Objects.isNull(filter)) {
            return false;
        }

        // Check if the only attempt type in the filter is "PENDING"
        return filter.getAttemptType().size() == 1 &&
                filter.getAttemptType().get(0).equals(UserRegistrationFilterEnum.PENDING.name());
    }

    public ResponseEntity<InputStreamResource> getRegisteredPdfExport(CustomUserDetails user, String instituteId, String assessmentId, AssessmentUserFilter filter) {
        if (Objects.isNull(filter)) throw new VacademyException("Invalid Request");

        // Determine whether to fetch participants for an open or closed assessment
        if (filter.getAssessmentType().equals(AssessmentVisibility.PUBLIC.name())) {
            return handleCaseForPublicAssessmentPdfExport(instituteId, assessmentId, filter);
        } else {
            return handleCaseForPrivateAssessmentPdfExport(instituteId, assessmentId, filter);
        }
    }

    private ResponseEntity<InputStreamResource> handleCaseForPrivateAssessmentPdfExport(String instituteId, String assessmentId, AssessmentUserFilter filter) {
        // Validate the filter
        if (Objects.isNull(filter)) {
            throw new VacademyException("Invalid Filter Request");
        }
        Optional<Assessment> assessmentOptional = assessmentRepository.findById(assessmentId);
        if (assessmentOptional.isEmpty()) throw new VacademyException("Assessment Not Found");

        List<ParticipantsDetailsDto> participantsDetailsDtos = new ArrayList<>();

        // Check if the assessment attempt is pending
        if (isPendingAttempt(filter)) {
            participantsDetailsDtos = assessmentUserRegistrationRepository
                    .findUserRegistrationWithFilterAdminPreRegistrationAndPendingExport(
                            assessmentId, instituteId, filter.getStatus(),
                            filter.getRegistrationSource());

        } else {
            // If no results are found, perform a broader search
            participantsDetailsDtos = assessmentUserRegistrationRepository
                    .findUserRegistrationWithFilterForSourceExport(
                            assessmentId, instituteId, filter.getStatus(),
                            filter.getAttemptType(), filter.getRegistrationSource());
        }


        // Convert the retrieved data into the required response format
        return DataToCsvConverter.buildPdfResponse(assessmentOptional.get().getName().toUpperCase(), "PARTICIPANTS LIST", createExportDtoFromParticipantsDto(participantsDetailsDtos), "participants");
    }

    private ResponseEntity<InputStreamResource> handleCaseForPublicAssessmentPdfExport(String instituteId, String assessmentId, AssessmentUserFilter filter) {
        if (Objects.isNull(filter)) throw new VacademyException("Invalid Filter Request");

        Optional<Assessment> assessmentOptional = assessmentRepository.findById(assessmentId);
        if (assessmentOptional.isEmpty()) throw new VacademyException("Assessment Not Found");

        List<ParticipantsDetailsDto> participantsDetailsDtos = new ArrayList<>();

        //Handle Case for BATCH REGISTRATION
        if (filter.getRegistrationSource().equals(UserRegistrationSources.BATCH_PREVIEW_REGISTRATION.name())) {
            participantsDetailsDtos = handleCaseForBatchRegistration(assessmentId, instituteId, filter);
        }
        //Handle Case for ADMIN PRE REGISTRATION
        else if (filter.getRegistrationSource().equals(UserRegistrationSources.ADMIN_PRE_REGISTRATION.name())) {
            participantsDetailsDtos = handleCaseForAdminPreRegistration(assessmentId, instituteId, filter);
        } else throw new VacademyException("Invalid Source Request");

        return DataToCsvConverter.buildPdfResponse(assessmentOptional.get().getName().toUpperCase(), "PARTICIPANTS LIST", createExportDtoFromParticipantsDto(participantsDetailsDtos), "participants");
    }

    public ResponseEntity<byte[]> getRespondentListCsvExport(CustomUserDetails user, String instituteId, String sectionId, String questionId, String assessmentId, RespondentFilter filter) {
        if (Objects.isNull(filter)) throw new VacademyException("Invalid Request");

        List<RespondentListDto> responses = null;
        responses = assessmentUserRegistrationRepository
                .findRespondentListForAssessmentWithFilterExport(assessmentId, questionId, filter.getAssessmentVisibility(), filter.getStatus(), filter.getRegistrationSource(), filter.getRegistrationSourceId());

        List<RespondentExportDto> exportDtos = createRespondentExportDto(responses);

        return DataToCsvConverter.convertListToCsv(exportDtos);

    }

    public ResponseEntity<InputStreamResource> getRespondentListPdfExport(CustomUserDetails user, String instituteId, String sectionId, String questionId, String assessmentId, RespondentFilter filter) {
        if (Objects.isNull(filter)) throw new VacademyException("Invalid Request");

        Optional<Assessment> assessmentOptional = assessmentRepository.findById(assessmentId);
        if (assessmentOptional.isEmpty()) throw new VacademyException("Assessment Not Found");

        List<RespondentListDto> responses = null;
        responses = assessmentUserRegistrationRepository
                .findRespondentListForAssessmentWithFilterExport(assessmentId, questionId, filter.getAssessmentVisibility(), filter.getStatus(), filter.getRegistrationSource(), filter.getRegistrationSourceId());

        List<RespondentExportDto> exportDtos = createRespondentExportDto(responses);

        return DataToCsvConverter.buildPdfResponse(assessmentOptional.get().getName().toUpperCase(), "RESPONDENT LIST", exportDtos, "respondent");

    }

    private List<RespondentExportDto> createRespondentExportDto(List<RespondentListDto> responses) {
        List<RespondentExportDto> respondentExportDtos = new ArrayList<>();
        responses.forEach(response -> {
            respondentExportDtos.add(RespondentExportDto.builder()
                    .responseTime(convertToReadableTime(response.getResponseTimeInSeconds()))
                    .participantName(response.getParticipantName())
                    .status(response.getStatus()).build());
        });

        return respondentExportDtos;
    }

    public ResponseEntity<byte[]> getQuestionInsightsExport(CustomUserDetails user, String assessmentId, String instituteId, String sectionIds) {
        List<String> allSectionIds = Arrays.asList(sectionIds.split(","));
        return createPdfForQuestionInsights(user, allSectionIds, assessmentId, instituteId);
    }

    private ResponseEntity<byte[]> createPdfForQuestionInsights(CustomUserDetails user, List<String> allSectionIds, String assessmentId, String instituteId) {
        String questionInsightsHtml = htmlBuilderService.getQuestionInsightsHtml(user, allSectionIds, assessmentId, instituteId);

        ByteArrayOutputStream pdfOutputStream = new ByteArrayOutputStream();
        ConverterProperties converterProperties = new ConverterProperties();
        HtmlConverter.convertToPdf(questionInsightsHtml, pdfOutputStream, converterProperties);

        // Return as downloadable PDF
        byte[] pdfBytes = pdfOutputStream.toByteArray();
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=questionInsights.pdf")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdfBytes);
    }

    public ResponseEntity<byte[]> getStudentReportPdf(CustomUserDetails user, String assessmentId, String attemptId, String instituteId) {
        StudentReportOverallDetailDto studentReportOverallDetailDto = assessmentParticipantsManager.createStudentReportDetailResponse(assessmentId, attemptId, instituteId);
        Optional<Assessment> assessmentOptional = assessmentRepository.findById(assessmentId);
        if (assessmentOptional.isEmpty()) throw new VacademyException("Assessment Not Found");

        String studentReportHtml = htmlBuilderService.generateStudentReportHtml(assessmentOptional.get().getName(), studentReportOverallDetailDto);

        ByteArrayOutputStream pdfOutputStream = new ByteArrayOutputStream();
        ConverterProperties converterProperties = new ConverterProperties();
        HtmlConverter.convertToPdf(studentReportHtml, pdfOutputStream, converterProperties);

        // Return as downloadable PDF
        byte[] pdfBytes = pdfOutputStream.toByteArray();
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=studentReport.pdf")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdfBytes);
    }
}
