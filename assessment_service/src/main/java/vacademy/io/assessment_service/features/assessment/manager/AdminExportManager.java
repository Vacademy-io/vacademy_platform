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
import vacademy.io.assessment_service.features.assessment.entity.Section;
import vacademy.io.assessment_service.features.assessment.enums.AssessmentVisibility;
import vacademy.io.assessment_service.features.assessment.enums.UserRegistrationFilterEnum;
import vacademy.io.assessment_service.features.assessment.enums.UserRegistrationSources;
import vacademy.io.assessment_service.features.assessment.repository.AssessmentRepository;
import vacademy.io.assessment_service.features.assessment.repository.AssessmentUserRegistrationRepository;
import vacademy.io.assessment_service.features.assessment.repository.SectionRepository;
import vacademy.io.assessment_service.features.assessment.repository.StudentAttemptRepository;
import vacademy.io.assessment_service.features.assessment.service.HtmlBuilderService;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.core.utils.DataToCsvConverter;
import vacademy.io.common.exceptions.VacademyException;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.TimeZone;

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

    @Autowired
    SectionRepository sectionRepository;

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

        // Empty registration_source means "all sources" — used by the result
        // export feature to get every participant regardless of how they enrolled.
        if (filter.getRegistrationSource() == null || filter.getRegistrationSource().isEmpty()) {
            return handleCaseForAllSourcesResultExport(instituteId, assessmentId);
        }

        // Determine whether to fetch participants for an open or closed assessment
        if (AssessmentVisibility.PUBLIC.name().equals(filter.getAssessmentType())) {
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
        if (UserRegistrationSources.BATCH_PREVIEW_REGISTRATION.name().equals(filter.getRegistrationSource())) {
            participantsDetailsDtos = handleCaseForBatchRegistration(assessmentId, instituteId, filter);
        }
        //Handle Case for ADMIN PRE REGISTRATION
        else if (UserRegistrationSources.ADMIN_PRE_REGISTRATION.name().equals(filter.getRegistrationSource())) {
            participantsDetailsDtos = handleCaseForAdminPreRegistration(assessmentId, instituteId, filter);
        } else throw new VacademyException("Invalid Source Request");

        return DataToCsvConverter.convertListToCsv(createExportDtoFromParticipantsDto(participantsDetailsDtos));
    }

    private List<ParticipantsDetailExportDto> createExportDtoFromParticipantsDto(List<ParticipantsDetailsDto> participantsDetailsDtos) {
        return createExportDtoFromParticipantsDtoWithTotalMarks(participantsDetailsDtos, null);
    }

    private List<ParticipantsDetailExportDto> createExportDtoFromParticipantsDtoWithTotalMarks(
            List<ParticipantsDetailsDto> participantsDetailsDtos, Double totalMarks) {
        List<ParticipantsDetailExportDto> response = new ArrayList<>();
        // Results arrive sorted by score DESC (ORDER BY in query), so index+1 = rank.
        for (int i = 0; i < participantsDetailsDtos.size(); i++) {
            ParticipantsDetailsDto dto = participantsDetailsDtos.get(i);
            Double obtained = dto.getScore();
            String pct = (totalMarks != null && totalMarks > 0 && obtained != null)
                    ? String.format("%.2f%%", (obtained / totalMarks) * 100)
                    : "";
            String durationFormatted = dto.getDuration() != null
                    ? convertToReadableTime(dto.getDuration())
                    : "";
            response.add(ParticipantsDetailExportDto.builder()
                    .name(dto.getStudentName())
                    .email(dto.getUserEmail() != null ? dto.getUserEmail() : "")
                    .marksObtained(obtained)
                    .totalMarks(totalMarks)
                    .percentage(pct)
                    .rank(i + 1)
                    .duration(durationFormatted)
                    .attemptDate(dto.getAttemptDate())
                    .build());
        }
        return response;
    }

    // Fetch ALL participants across every registration source and build an
    // enriched result CSV: Name, Email, Marks Obtained, Total Marks, Percentage,
    // Rank, Duration, Attempt Date (converted to IST).
    private ResponseEntity<byte[]> handleCaseForAllSourcesResultExport(String instituteId, String assessmentId) {
        List<ParticipantsDetailsDto> participants = assessmentUserRegistrationRepository
                .findAllEndedParticipantsForResultExport(assessmentId, instituteId);

        if (participants.isEmpty()) {
            String emptyCsv = "Name,Email,Marks Obtained,Total Marks,Percentage,Rank,Duration,Attempt Date\n";
            return ResponseEntity.ok()
                    .header("Content-Disposition", "attachment; filename=\"results.csv\"")
                    .header("Content-Type", "text/plain")
                    .body(emptyCsv.getBytes(StandardCharsets.UTF_8));
        }

        // Compute total marks from section configuration.
        List<Section> sections = sectionRepository.findByAssessmentIdAndStatusNotIn(
                assessmentId, List.of("DELETED"));
        double totalMarks = sections.stream()
                .mapToDouble(s -> s.getTotalMarks() != null ? s.getTotalMarks() : 0.0)
                .sum();

        // Date formatter — converts UTC Date to IST for display.
        SimpleDateFormat sdf = new SimpleDateFormat("dd MMM yyyy hh:mm a");
        sdf.setTimeZone(TimeZone.getTimeZone("Asia/Kolkata"));

        StringBuilder csv = new StringBuilder();
        csv.append("Name,Email,Marks Obtained,Total Marks,Percentage,Rank,Duration,Attempt Date\n");

        // Rows arrive sorted by score DESC (ORDER BY in query) → index+1 = rank.
        for (int i = 0; i < participants.size(); i++) {
            ParticipantsDetailsDto p = participants.get(i);
            Double obtained = p.getScore() != null ? p.getScore() : 0.0;
            String pct = totalMarks > 0
                    ? String.format("%.2f%%", (obtained / totalMarks) * 100)
                    : "";
            String duration = p.getDuration() != null ? convertToReadableTime(p.getDuration()) : "";
            String attemptDate = p.getAttemptDate() != null ? sdf.format(p.getAttemptDate()) : "";
            String email = p.getUserEmail() != null ? p.getUserEmail() : "";
            String name = p.getStudentName() != null ? p.getStudentName() : "";

            csv.append(escapeCsvField(name)).append(",")
                    .append(escapeCsvField(email)).append(",")
                    .append(obtained).append(",")
                    .append(totalMarks).append(",")
                    .append(pct).append(",")
                    .append(i + 1).append(",")
                    .append(escapeCsvField(duration)).append(",")
                    .append(escapeCsvField(attemptDate)).append("\n");
        }

        return ResponseEntity.ok()
                .header("Content-Disposition", "attachment; filename=\"results.csv\"")
                .header("Content-Type", "text/plain")
                .body(csv.toString().getBytes(StandardCharsets.UTF_8));
    }

    private String escapeCsvField(String value) {
        if (value == null) return "";
        // Wrap in quotes if the value contains comma, quote, or newline.
        if (value.contains(",") || value.contains("\"") || value.contains("\n")) {
            return "\"" + value.replace("\"", "\"\"") + "\"";
        }
        return value;
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
            // If no results found, search for users based on status, attempt type, and registration source
            ParticipantsDetailsDtos = assessmentUserRegistrationRepository
                    .findUserRegistrationWithFilterForSourceExport(
                            assessmentId, instituteId, filter.getStatus(),
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
        // Return false if the filter or its attempt types are missing
        if (Objects.isNull(filter) || Objects.isNull(filter.getAttemptType())) {
            return false;
        }

        // Check if the only attempt type in the filter is "PENDING"
        return filter.getAttemptType().size() == 1 &&
                UserRegistrationFilterEnum.PENDING.name().equals(filter.getAttemptType().get(0));
    }

    public ResponseEntity<InputStreamResource> getRegisteredPdfExport(CustomUserDetails user, String instituteId, String assessmentId, AssessmentUserFilter filter) {
        if (Objects.isNull(filter)) throw new VacademyException("Invalid Request");

        // Determine whether to fetch participants for an open or closed assessment
        if (AssessmentVisibility.PUBLIC.name().equals(filter.getAssessmentType())) {
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
        if (UserRegistrationSources.BATCH_PREVIEW_REGISTRATION.name().equals(filter.getRegistrationSource())) {
            participantsDetailsDtos = handleCaseForBatchRegistration(assessmentId, instituteId, filter);
        }
        //Handle Case for ADMIN PRE REGISTRATION
        else if (UserRegistrationSources.ADMIN_PRE_REGISTRATION.name().equals(filter.getRegistrationSource())) {
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
