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
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
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
import vacademy.io.assessment_service.features.assessment.dto.export.ResultExportColumnsDto;
import vacademy.io.assessment_service.features.assessment.dto.export.ResultExportRowDto;
import vacademy.io.assessment_service.features.assessment.dto.batch_pending.EnrolledLearnerDto;
import vacademy.io.assessment_service.features.assessment.dto.export.zip.*;
import vacademy.io.assessment_service.features.assessment.entity.Assessment;
import vacademy.io.assessment_service.features.assessment.entity.AssessmentCustomField;
import vacademy.io.assessment_service.features.assessment.entity.AssessmentReportExportItem;
import vacademy.io.assessment_service.features.assessment.entity.AssessmentReportExportJob;
import vacademy.io.assessment_service.features.assessment.entity.Section;
import vacademy.io.assessment_service.features.assessment.entity.StudentAttempt;
import vacademy.io.assessment_service.features.assessment.enums.AssessmentVisibility;
import vacademy.io.assessment_service.features.assessment.enums.ReportExportJobStatus;
import vacademy.io.assessment_service.features.assessment.enums.UserRegistrationFilterEnum;
import vacademy.io.assessment_service.features.assessment.enums.UserRegistrationSources;
import vacademy.io.assessment_service.features.assessment.repository.AssessmentCustomFieldRepository;
import vacademy.io.assessment_service.features.assessment.repository.AssessmentInstituteMappingRepository;
import vacademy.io.assessment_service.features.assessment.repository.AssessmentReportExportItemRepository;
import vacademy.io.assessment_service.features.assessment.repository.AssessmentReportExportJobRepository;
import vacademy.io.assessment_service.features.assessment.repository.AssessmentRepository;
import vacademy.io.assessment_service.features.assessment.repository.AssessmentUserRegistrationRepository;
import vacademy.io.assessment_service.features.assessment.repository.SectionRepository;
import vacademy.io.assessment_service.features.assessment.repository.StudentAttemptRepository;
import vacademy.io.assessment_service.features.assessment.service.HtmlBuilderService;
import vacademy.io.assessment_service.features.assessment.service.export.ReportExportJobFactory;
import vacademy.io.assessment_service.features.assessment.service.export.ReportExportProperties;
import vacademy.io.assessment_service.features.assessment.service.export.ReportZipAssemblyService;
import vacademy.io.assessment_service.features.assessment.service.export.ReportZipExportService;
import vacademy.io.assessment_service.features.client.AdminCoreServiceClient;
import vacademy.io.assessment_service.features.learner_assessment.dto.ReportClassContext;
import vacademy.io.assessment_service.features.learner_assessment.dto.StudentComparisonDto;
import vacademy.io.assessment_service.features.learner_assessment.service.LearnerReportService;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.core.utils.DataToCsvConverter;
import vacademy.io.common.core.utils.DateUtil;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.media.service.FileService;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.TimeZone;

@Component
@lombok.extern.slf4j.Slf4j
public class AdminExportManager {

    // Fixed columns of the result CSV, before any registration-form columns.
    // Identity and contact first, then the result columns. Phone Number / Username / Batch
    // were added so a mark sheet can be cross-referenced and learners contacted without a
    // second export; every one of them is optional in the Export CSV dialog, so anyone who
    // wants the older, narrower sheet just unticks them.
    private static final List<String> RESULT_EXPORT_BASE_HEADERS = List.of(
            "Name", "Email", "Phone Number", "Username", "Batch",
            "Marks Obtained", "Total Marks", "Percentage", "Rank", "Duration", "Attempt Date");

    // The "not attempted" sheet: contact details and nothing else. Marks, rank, percentage
    // and attempt date would every one of them be blank for a learner who never started,
    // so offering them would only invite the reader to believe they scored zero.
    private static final List<String> NOT_ATTEMPTED_EXPORT_HEADERS = List.of(
            "Name", "Email", "Phone Number", "Username", "Batch");

    // Several answer rows can exist for one field (e.g. a multi-select), so they
    // are joined into a single cell rather than silently dropping all but one.
    private static final String MULTI_ANSWER_SEPARATOR = "; ";

    @Autowired
    StudentAttemptRepository studentAttemptRepository;

    @Autowired
    AssessmentUserRegistrationRepository assessmentUserRegistrationRepository;

    @Autowired
    vacademy.io.assessment_service.features.assessment.service.batch_pending.NotAttemptedLearnerService notAttemptedLearnerService;

    @Autowired
    AssessmentCustomFieldRepository assessmentCustomFieldRepository;

    @Autowired
    AssessmentInstituteMappingRepository assessmentInstituteMappingRepository;

    @Autowired
    HtmlBuilderService htmlBuilderService;

    @Autowired
    AssessmentParticipantsManager assessmentParticipantsManager;

    @Autowired
    AssessmentRepository assessmentRepository;

    @Autowired
    SectionRepository sectionRepository;

    @Autowired
    AdminCoreServiceClient adminCoreServiceClient;

    @Autowired
    LearnerReportService learnerReportService;

    @Autowired
    vacademy.io.assessment_service.features.assessment.service.ReportPdfRenderService reportPdfRenderService;

    @Autowired
    AssessmentReportExportJobRepository reportExportJobRepository;

    @Autowired
    AssessmentReportExportItemRepository reportExportItemRepository;

    @Autowired
    ReportExportJobFactory reportExportJobFactory;

    @Autowired
    ReportZipExportService reportZipExportService;

    @Autowired
    ReportZipAssemblyService reportZipAssemblyService;

    @Autowired
    ReportExportProperties reportExportProperties;

    @Autowired
    FileService fileService;

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

        // "Not attempted" is not a slice of the attempt tables at all — a batch-enrolled
        // learner has no registration row until they start — so it gets its own sheet
        // rather than being squeezed through the result export below.
        if (isPendingAttempt(filter) && UserRegistrationSources.BATCH_PREVIEW_REGISTRATION.name()
                .equals(filter.getRegistrationSource())) {
            return handleNotAttemptedCsvExport(instituteId, assessmentId, filter);
        }

        // Empty registration_source means "all sources" — used by the result
        // export feature to get every participant regardless of how they enrolled.
        if (filter.getRegistrationSource() == null || filter.getRegistrationSource().isEmpty()) {
            return handleCaseForAllSourcesResultExport(instituteId, assessmentId, filter.getCustomFieldIds());
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
    // Rank, Duration, Attempt Date (converted to IST), followed by one column per
    // requested registration-form custom field — the details external participants
    // filled in when they registered for a public assessment.
    private ResponseEntity<byte[]> handleCaseForAllSourcesResultExport(String instituteId, String assessmentId,
                                                                       List<String> requestedCustomFieldIds) {
        List<ResultExportRowDto> participants = assessmentUserRegistrationRepository
                .findAllEndedParticipantsForResultExport(assessmentId, instituteId);

        List<ExportCustomFieldColumn> customColumns =
                resolveExportCustomFieldColumns(assessmentId, requestedCustomFieldIds);

        StringBuilder csv = new StringBuilder();
        csv.append(String.join(",", RESULT_EXPORT_BASE_HEADERS));
        customColumns.forEach(column -> csv.append(",").append(escapeCsvField(column.header())));
        csv.append("\n");

        if (participants.isEmpty()) {
            return ResponseEntity.ok()
                    .header("Content-Disposition", "attachment; filename=\"results.csv\"")
                    .header("Content-Type", "text/plain")
                    .body(csv.toString().getBytes(StandardCharsets.UTF_8));
        }

        // registrationId -> (customFieldId -> answer). One query for the whole
        // assessment instead of one per participant.
        Map<String, Map<String, String>> answersByRegistration = customColumns.isEmpty()
                ? Map.of()
                : loadCustomFieldAnswers(assessmentId, instituteId);

        // Compute total marks from section configuration.
        List<Section> sections = sectionRepository.findByAssessmentIdAndStatusNotIn(
                assessmentId, List.of("DELETED"));
        double totalMarks = sections.stream()
                .mapToDouble(s -> s.getTotalMarks() != null ? s.getTotalMarks() : 0.0)
                .sum();

        // Date formatter — converts UTC Date to IST for display.
        SimpleDateFormat sdf = new SimpleDateFormat("dd MMM yyyy hh:mm a");
        sdf.setTimeZone(TimeZone.getTimeZone("Asia/Kolkata"));

        // One lookup for every batch in the sheet rather than one per row.
        Map<String, String> batchNames = adminCoreServiceClient.getBatchNames(
                participants.stream().map(ResultExportRowDto::getBatchId)
                        .filter(Objects::nonNull).distinct().sorted().toList());

        // Rows arrive sorted by score DESC (ORDER BY in query) → index+1 = rank.
        for (int i = 0; i < participants.size(); i++) {
            ResultExportRowDto p = participants.get(i);
            Double obtained = p.getScore() != null ? p.getScore() : 0.0;
            String pct = totalMarks > 0
                    ? String.format("%.2f%%", (obtained / totalMarks) * 100)
                    : "";
            String duration = p.getDuration() != null ? convertToReadableTime(p.getDuration()) : "";
            String attemptDate = p.getAttemptDate() != null ? sdf.format(p.getAttemptDate()) : "";
            String email = p.getUserEmail() != null ? p.getUserEmail() : "";
            String name = p.getStudentName() != null ? p.getStudentName() : "";
            String phone = p.getPhoneNumber() != null ? p.getPhoneNumber() : "";
            String username = p.getUsername() != null ? p.getUsername() : "";
            String batch = resolveBatchName(batchNames, p.getBatchId());

            csv.append(escapeCsvField(name)).append(",")
                    .append(escapeCsvField(email)).append(",")
                    .append(escapeCsvField(phone)).append(",")
                    .append(escapeCsvField(username)).append(",")
                    .append(escapeCsvField(batch)).append(",")
                    .append(obtained).append(",")
                    .append(totalMarks).append(",")
                    .append(pct).append(",")
                    .append(i + 1).append(",")
                    .append(escapeCsvField(duration)).append(",")
                    .append(escapeCsvField(attemptDate));

            Map<String, String> answers = answersByRegistration
                    .getOrDefault(p.getRegistrationId(), Map.of());
            for (ExportCustomFieldColumn column : customColumns) {
                csv.append(",").append(escapeCsvField(answers.get(column.fieldId())));
            }
            csv.append("\n");
        }

        return ResponseEntity.ok()
                .header("Content-Disposition", "attachment; filename=\"results.csv\"")
                .header("Content-Type", "text/plain")
                .body(csv.toString().getBytes(StandardCharsets.UTF_8));
    }

    /**
     * CSV of the batch-enrolled learners who never attempted — the Pending tab's export.
     *
     * <p>Shares {@link NotAttemptedLearnerService} with the tab itself, so the file and the
     * screen always name the same learners. It honours the batch chips and name search on
     * the filter, so the sheet matches what the admin was looking at when they clicked.
     *
     * <p>Emits the header row even when nobody is pending: a file with just headers says
     * "everyone attempted", whereas an empty file looks like the export failed.
     */
    private ResponseEntity<byte[]> handleNotAttemptedCsvExport(String instituteId, String assessmentId,
                                                               AssessmentUserFilter filter) {
        List<EnrolledLearnerDto> learners = notAttemptedLearnerService
                .findNotAttempted(assessmentId, instituteId, filter);

        Map<String, String> batchNames = adminCoreServiceClient.getBatchNames(
                learners.stream().map(EnrolledLearnerDto::getPackageSessionId)
                        .filter(Objects::nonNull).distinct().sorted().toList());

        StringBuilder csv = new StringBuilder(String.join(",", NOT_ATTEMPTED_EXPORT_HEADERS));
        csv.append("\n");

        for (EnrolledLearnerDto learner : learners) {
            String batch = resolveBatchName(batchNames, learner.getPackageSessionId());
            csv.append(escapeCsvField(learner.getFullName())).append(",")
                    .append(escapeCsvField(learner.getEmail())).append(",")
                    .append(escapeCsvField(learner.getMobileNumber())).append(",")
                    .append(escapeCsvField(learner.getUsername())).append(",")
                    .append(escapeCsvField(batch))
                    .append("\n");
        }

        return ResponseEntity.ok()
                .header("Content-Disposition", "attachment; filename=\"not-attempted.csv\"")
                .header("Content-Type", "text/plain")
                .body(csv.toString().getBytes(StandardCharsets.UTF_8));
    }

    /**
     * Batch display name for a row, or a blank cell when the row has no batch.
     *
     * <p>The null check is not defensive padding: the all-sources result sheet includes
     * open-registration participants, whose {@code source_id} is not a batch at all, so
     * this is called with null on real data. {@code Map.of()} — what the name lookup
     * returns when admin_core is unreachable — throws NullPointerException on a null key
     * rather than missing, so probing the map first would crash the whole export.
     *
     * <p>Falls back to the raw id when the name cannot be resolved: an unresolved batch id
     * is still more use to an admin than an empty cell.
     */
    private static String resolveBatchName(Map<String, String> batchNames, String batchId) {
        if (batchId == null || batchId.isBlank()) {
            return "";
        }
        return batchNames.getOrDefault(batchId, batchId);
    }

    /**
     * Columns the result CSV can carry for this assessment — the fixed result
     * columns plus every active registration-form field. Feeds the Export CSV
     * dialog's tick-list, which starts with everything ticked.
     */
    public ResponseEntity<ResultExportColumnsDto> getResultExportColumns(CustomUserDetails user, String instituteId,
                                                                         String assessmentId,
                                                                         boolean notAttempted) {
        // Reject an assessment that demonstrably belongs to another institute.
        // A handful of live assessments pre-date the mapping table and have no
        // mapping row at all — those stay exportable, scoped like the CSV itself
        // by the institute on their registration rows.
        if (assessmentInstituteMappingRepository.findByAssessmentIdAndInstituteId(assessmentId, instituteId).isEmpty()
                && assessmentInstituteMappingRepository.findTopByAssessmentId(assessmentId).isPresent()) {
            throw new VacademyException("Assessment Not Found");
        }

        // The "not attempted" sheet describes learners with no registration row, so the
        // registration-form fields below would every one of them be blank. Offering them
        // would be a tick-list of empty columns.
        if (notAttempted) {
            return ResponseEntity.ok(ResultExportColumnsDto.builder()
                    .baseColumns(NOT_ATTEMPTED_EXPORT_HEADERS)
                    .customFields(List.of())
                    .build());
        }

        List<AssessmentCustomField> customFields = assessmentCustomFieldRepository
                .findActiveFieldsByAssessmentId(assessmentId);
        List<String> columnLabels = buildCustomFieldHeaders(customFields);

        List<ResultExportColumnsDto.CustomFieldColumn> columns = new ArrayList<>();
        for (int i = 0; i < customFields.size(); i++) {
            AssessmentCustomField field = customFields.get(i);
            columns.add(ResultExportColumnsDto.CustomFieldColumn.builder()
                    .id(field.getId())
                    .fieldName(field.getFieldName())
                    .fieldKey(field.getFieldKey())
                    .fieldType(field.getFieldType())
                    .fieldOrder(field.getFieldOrder())
                    .isMandatory(field.getIsMandatory())
                    .columnLabel(columnLabels.get(i))
                    .build());
        }

        return ResponseEntity.ok(ResultExportColumnsDto.builder()
                .baseColumns(RESULT_EXPORT_BASE_HEADERS)
                .customFields(columns)
                .build());
    }

    /** One registration-form column of the CSV: which field fills it, and its header. */
    private record ExportCustomFieldColumn(String fieldId, String header) {
    }

    /**
     * Registration-form columns to append. A null id list means "every active
     * field" (so an older client that doesn't send a selection still gets the
     * full data), an empty list means the admin unticked all of them.
     * <p>
     * Headers are always computed over the assessment's full field list, then
     * filtered — otherwise unticking one field could rename another's column
     * (drop the first "Email" field and the second stops needing its "(Form 2)"
     * suffix), and the header would no longer match what the dialog promised.
     */
    private List<ExportCustomFieldColumn> resolveExportCustomFieldColumns(String assessmentId,
                                                                          List<String> requestedCustomFieldIds) {
        if (requestedCustomFieldIds != null && requestedCustomFieldIds.isEmpty()) {
            return List.of();
        }
        List<AssessmentCustomField> activeFields = assessmentCustomFieldRepository
                .findActiveFieldsByAssessmentId(assessmentId);
        List<String> headers = buildCustomFieldHeaders(activeFields);
        Set<String> requested = requestedCustomFieldIds == null
                ? null
                : new HashSet<>(requestedCustomFieldIds);

        List<ExportCustomFieldColumn> columns = new ArrayList<>();
        for (int i = 0; i < activeFields.size(); i++) {
            AssessmentCustomField field = activeFields.get(i);
            if (requested == null || requested.contains(field.getId())) {
                columns.add(new ExportCustomFieldColumn(field.getId(), headers.get(i)));
            }
        }
        return columns;
    }

    /**
     * Column titles for the custom fields, kept unique and distinct from the
     * fixed result columns — a form asking for "Email" would otherwise produce
     * two identically named columns and confuse the spreadsheet reader.
     */
    private List<String> buildCustomFieldHeaders(List<AssessmentCustomField> customFields) {
        Set<String> used = new HashSet<>();
        RESULT_EXPORT_BASE_HEADERS.forEach(header -> used.add(header.toLowerCase()));

        List<String> headers = new ArrayList<>();
        for (AssessmentCustomField field : customFields) {
            String base = (field.getFieldName() != null && !field.getFieldName().isBlank())
                    ? field.getFieldName().trim()
                    : (field.getFieldKey() != null ? field.getFieldKey() : "Field");
            String candidate = base;
            if (used.contains(candidate.toLowerCase())) {
                candidate = base + " (Form)";
            }
            int suffix = 2;
            while (used.contains(candidate.toLowerCase())) {
                candidate = base + " (Form " + suffix + ")";
                suffix++;
            }
            used.add(candidate.toLowerCase());
            headers.add(candidate);
        }
        return headers;
    }

    private Map<String, Map<String, String>> loadCustomFieldAnswers(String assessmentId, String instituteId) {
        Map<String, Map<String, String>> answersByRegistration = new HashMap<>();
        assessmentUserRegistrationRepository.findCustomFieldAnswersForAssessment(assessmentId, instituteId)
                .forEach(row -> {
                    if (row.getRegistrationId() == null || row.getFieldId() == null) return;
                    String answer = row.getAnswer() != null ? row.getAnswer().trim() : "";
                    if (answer.isEmpty()) return;
                    answersByRegistration
                            .computeIfAbsent(row.getRegistrationId(), key -> new HashMap<>())
                            .merge(row.getFieldId(), answer,
                                    (existing, incoming) -> existing + MULTI_ANSWER_SEPARATOR + incoming);
                });
        return answersByRegistration;
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
            // Unreachable: getRegisteredCsvExport intercepts pending + batch and serves it
            // from handleNotAttemptedCsvExport, which is the only path that can answer it
            // (the set lives in admin_core, not in this database). Kept as a guard so a
            // future caller reaching here gets an empty list rather than the attempted rows.
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

        // Comparison used to be passed as null here, so the admin's copy
        // silently dropped rank, percentile, class average, marks distribution
        // and section-wise comparison — i.e. everything that makes it a
        // comparison report. Built the same way the learner download does it
        // (LearnerReportService#getStudentReportPdf) so admin and learner get
        // a byte-identical document.
        StudentComparisonDto comparison = null;
        try {
            String studentUserId = studentAttemptRepository.findById(attemptId)
                    .map(attempt -> attempt.getRegistration() != null
                            ? attempt.getRegistration().getUserId()
                            : null)
                    .orElse(null);
            comparison = learnerReportService.buildComparisonData(studentUserId, assessmentId, attemptId, instituteId);
        } catch (Exception ignored) {
        }

        // Shared release-flow renderer (v2 report). The class context carries
        // branding, option distribution and the full leaderboard — the source
        // of the student name in the letterhead — so the admin download is the
        // same professional document the learner gets, not the legacy layout.
        ReportClassContext ctx = learnerReportService.loadClassContext(assessmentId, instituteId);
        byte[] pdfBytes = reportPdfRenderService.render(studentReportOverallDetailDto, comparison, ctx);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=studentReport.pdf")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdfBytes);
    }

    // ==================================================================
    // Bulk Assessment Report Export (ZIP) — 6 orchestration methods (PR4)
    // ==================================================================

    private static final List<String> IN_FLIGHT_STATUSES =
            List.of(ReportExportJobStatus.PENDING.name(), ReportExportJobStatus.IN_PROGRESS.name());

    public ReportZipInitiateResponse initiateReportZipExport(CustomUserDetails user, ReportZipInitiateRequest req) {
        if (req == null || req.getAssessmentId() == null || req.getInstituteId() == null) {
            throw new VacademyException("Invalid Request");
        }

        // Double-click Initiate dedup: return the existing job rather than starting a second one.
        Optional<AssessmentReportExportJob> existing = reportExportJobRepository
                .findFirstByInstituteIdAndAssessmentIdAndCreatedByUserIdAndStatusInOrderByCreatedAtDesc(
                        req.getInstituteId(), req.getAssessmentId(), user.getUserId(), IN_FLIGHT_STATUSES);
        if (existing.isPresent()) {
            AssessmentReportExportJob job = existing.get();
            return ReportZipInitiateResponse.builder()
                    .jobId(job.getId())
                    .totalCount(job.getTotalCount())
                    .alreadyRunning(true)
                    .status(job.getStatus())
                    .build();
        }

        String requestJson;
        try {
            requestJson = new ObjectMapper().writeValueAsString(req);
        } catch (Exception e) {
            requestJson = null;
        }

        AssessmentReportExportJob job = reportExportJobFactory.createJob(user, req, user.getUserId(), requestJson);
        final String jobId = job.getId();

        // Dispatch deferred to afterCommit (precedent: AiEvaluationService) — the
        // worker's claimForRun races the INSERT on a different connection
        // otherwise, and always loses.
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    reportZipExportService.run(jobId, false);
                }
            });
        } else {
            reportZipExportService.run(jobId, false);
        }

        return ReportZipInitiateResponse.builder()
                .jobId(jobId)
                .totalCount(job.getTotalCount())
                .alreadyRunning(false)
                .status(job.getStatus())
                .build();
    }

    public ReportZipStatusResponse getReportZipExportStatus(CustomUserDetails user, String jobId, String instituteId) {
        AssessmentReportExportJob job = loadJobForInstitute(jobId, instituteId);

        List<AssessmentReportExportItem> items = reportExportItemRepository.findByJobIdOrderByCreatedAt(jobId);
        int remainingCount = (int) items.stream()
                .filter(i -> "PENDING".equals(i.getStatus())
                        || ("FAILED".equals(i.getStatus()) && (i.getRetryCount() == null || i.getRetryCount() < reportExportProperties.getMaxRetry())))
                .count();

        // LIVE progress, derived from item rows — NOT the job-row counters.
        // Each item result commits in its own REQUIRES_NEW transaction as it
        // happens, but the job counters are only checkpointed per BATCH: a
        // 3-student export is a single batch, so the counters jump 0 → 3 in
        // one write and the progress bar never moves. The items are already
        // loaded here, so deriving costs nothing extra.
        int liveCompleted = (int) items.stream().filter(i -> "DONE".equals(i.getStatus())).count();
        int liveFailed = (int) items.stream().filter(i -> "FAILED".equals(i.getStatus())).count();
        int liveSkipped = (int) items.stream().filter(i -> "SKIPPED".equals(i.getStatus())).count();

        // Stale IN_PROGRESS job (pod crash / dev restart) — write back so it
        // becomes claimable again; claimForRun does not accept IN_PROGRESS.
        // Two tiers, because "how long is suspicious" depends on where the
        // worker died:
        //  - Items still processable → generous window (worker may be mid-batch).
        //  - Nothing left to process → the worker was only assembling/finalizing,
        //    which is bounded by assembly-timeout. A restart between the last
        //    checkpoint and finalizeJob otherwise leaves the job frozen at
        //    "IN_PROGRESS, N of N completed" for the full stale window.
        if (ReportExportJobStatus.IN_PROGRESS.name().equals(job.getStatus()) && job.getUpdatedAt() != null) {
            long secondsSinceUpdate = (DateUtil.getCurrentUtcTime().getTime() - job.getUpdatedAt().getTime()) / 1000;
            boolean phaseADone = remainingCount == 0;
            long staleAfterSeconds = phaseADone
                    ? reportExportProperties.getAssemblyTimeoutSeconds()
                    : reportExportProperties.getStaleJobMinutes() * 60L;
            if (secondsSinceUpdate > staleAfterSeconds) {
                ReportExportJobStatus recovered;
                if (phaseADone && job.getOutputFileId() != null && liveFailed == 0) {
                    // Everything rendered and a ZIP exists — the worker died
                    // after doing all the work. This IS a completed export.
                    recovered = ReportExportJobStatus.COMPLETED;
                } else if (liveCompleted > 0) {
                    recovered = ReportExportJobStatus.PARTIAL;
                } else {
                    recovered = ReportExportJobStatus.FAILED;
                }
                job.setStatus(recovered.name());
                if (recovered != ReportExportJobStatus.COMPLETED) {
                    job.setErrorMessage("Worker appears to have terminated mid-run (no progress for "
                            + (secondsSinceUpdate / 60) + " min)");
                }
                job.setUpdatedAt(DateUtil.getCurrentUtcTime());
                job = reportExportJobRepository.save(job);
            }
        }
        boolean assemblable = items.stream().anyMatch(i -> "DONE".equals(i.getStatus()) && i.getFileId() != null);
        boolean resumable = Set.of(ReportExportJobStatus.PARTIAL.name(), ReportExportJobStatus.FAILED.name(),
                ReportExportJobStatus.CANCELLED.name()).contains(job.getStatus()) && remainingCount > 0;

        // Batched: this runs on every 2s poll, so a per-item findById would be
        // N queries per poll — one findAllById keeps it at a single query.
        List<AssessmentReportExportItem> doneItems = items.stream()
                .filter(i -> "DONE".equals(i.getStatus()) && i.getProcessedAt() != null)
                .toList();
        Map<String, Date> attemptUpdatedAt = new HashMap<>();
        if (!doneItems.isEmpty()) {
            studentAttemptRepository.findAllById(doneItems.stream()
                            .map(AssessmentReportExportItem::getAttemptId).toList())
                    .forEach(a -> {
                        if (a.getUpdatedAt() != null) attemptUpdatedAt.put(a.getId(), a.getUpdatedAt());
                    });
        }
        int staleItemCount = (int) doneItems.stream()
                .filter(i -> {
                    Date updated = attemptUpdatedAt.get(i.getAttemptId());
                    return updated != null && updated.after(i.getProcessedAt());
                })
                .count();

        List<ReportZipFailureDto> failures = items.stream()
                .filter(i -> "FAILED".equals(i.getStatus()))
                .limit(50)
                .map(i -> ReportZipFailureDto.builder()
                        .attemptId(i.getAttemptId())
                        .studentName(i.getStudentName())
                        .reason(i.getErrorMessage())
                        .retryCount(i.getRetryCount() != null ? i.getRetryCount() : 0)
                        .build())
                .toList();

        String downloadUrl = resolveDownloadUrl(job.getOutputFileId());

        return ReportZipStatusResponse.builder()
                .jobId(job.getId())
                .status(job.getStatus())
                .totalCount(job.getTotalCount())
                .completedCount(liveCompleted)
                .failedCount(liveFailed)
                .skippedCount(liveSkipped)
                .downloadUrl(downloadUrl)
                .outputFileName(job.getOutputFileName())
                .outputSizeBytes(job.getOutputSizeBytes())
                .errorMessage(job.getErrorMessage())
                .resumeCount(job.getResumeCount())
                .resumable(resumable)
                .remainingCount(remainingCount)
                .assemblable(assemblable)
                .staleItemCount(staleItemCount)
                .contextDrift(Boolean.TRUE.equals(job.getContextDrift()))
                .startedAt(job.getStartedAt())
                .completedAt(job.getCompletedAt())
                .updatedAt(job.getUpdatedAt())
                .failures(failures)
                .build();
    }

    public ReportZipContinueResponse continueReportZipExport(CustomUserDetails user, String jobId, String instituteId) {
        AssessmentReportExportJob job = loadJobForInstitute(jobId, instituteId);
        if (ReportExportJobStatus.IN_PROGRESS.name().equals(job.getStatus())
                || ReportExportJobStatus.COMPLETED.name().equals(job.getStatus())) {
            throw new VacademyException("Job " + jobId + " is " + job.getStatus() + " and cannot be continued");
        }

        int claimed = reportExportJobRepository.claimForRun(jobId,
                List.of(ReportExportJobStatus.PARTIAL.name(), ReportExportJobStatus.FAILED.name(),
                        ReportExportJobStatus.CANCELLED.name()));
        if (claimed == 0) {
            // Another thread/click already claimed it — return current state, not an error.
            AssessmentReportExportJob current = reportExportJobRepository.findById(jobId)
                    .orElseThrow(() -> new VacademyException("Export job not found: " + jobId));
            return ReportZipContinueResponse.builder()
                    .jobId(jobId)
                    .status(current.getStatus())
                    .remainingCount(reportExportItemRepository.findProcessable(jobId, reportExportProperties.getMaxRetry()).size())
                    .alreadyRunning(true)
                    .build();
        }

        // Re-fetch: claimForRun's native UPDATE just changed `status` in the DB
        // underneath the `job` entity loaded above (by loadJobForInstitute, in
        // its own earlier transaction). Saving the stale in-memory `job` here
        // would silently overwrite status back to its pre-claim value.
        AssessmentReportExportJob claimedJob = reportExportJobRepository.findById(jobId)
                .orElseThrow(() -> new VacademyException("Export job not found: " + jobId));
        claimedJob.setResumeCount((claimedJob.getResumeCount() == null ? 0 : claimedJob.getResumeCount()) + 1);
        reportExportJobRepository.save(claimedJob);

        // The endpoint already claimed the job above — the worker must NOT
        // re-claim (ARCHITECTURE.md §10 scenario (b): it would always lose that
        // race against itself).
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    reportZipExportService.run(jobId, true);
                }
            });
        } else {
            reportZipExportService.run(jobId, true);
        }

        int remaining = reportExportItemRepository.findProcessable(jobId, reportExportProperties.getMaxRetry()).size();
        return ReportZipContinueResponse.builder()
                .jobId(jobId)
                .status(ReportExportJobStatus.IN_PROGRESS.name())
                .remainingCount(remaining)
                .alreadyRunning(false)
                .build();
    }

    public ReportZipAssembleResponse assembleReportZipExport(CustomUserDetails user, String jobId, String instituteId) {
        loadJobForInstitute(jobId, instituteId); // ownership check
        ReportZipAssembleResponse response = reportZipAssemblyService.assemble(jobId);
        AssessmentReportExportJob job = reportExportJobRepository.findById(jobId).orElse(null);

        // If this assembly just covered EVERY item of a job stuck IN_PROGRESS
        // (worker killed between the last checkpoint and finalizeJob — e.g. a
        // restart), settle the status here instead of leaving the admin's
        // dialog polling a job that will never finalize itself. A live worker
        // can't be racing us: it only assembles after its items are done, and
        // it would then write the same terminal status.
        if (job != null && ReportExportJobStatus.IN_PROGRESS.name().equals(job.getStatus())) {
            long processable = reportExportItemRepository.findProcessable(jobId, reportExportProperties.getMaxRetry()).size();
            if (processable == 0) {
                boolean allDone = !response.isPartial()
                        && (job.getFailedCount() == null || job.getFailedCount() == 0);
                job.setStatus((allDone ? ReportExportJobStatus.COMPLETED : ReportExportJobStatus.PARTIAL).name());
                job.setCompletedAt(DateUtil.getCurrentUtcTime());
                job.setUpdatedAt(DateUtil.getCurrentUtcTime());
                job = reportExportJobRepository.save(job);
            }
        }

        String downloadUrl = job != null ? resolveDownloadUrl(job.getOutputFileId()) : null;
        response.setDownloadUrl(downloadUrl);
        return response;
    }

    public ReportZipRecentResponse getRecentReportZipExports(CustomUserDetails user, String assessmentId, String instituteId, int limit) {
        int pageSize = limit > 0 ? limit : 5;
        List<AssessmentReportExportJob> jobs = reportExportJobRepository
                .findByAssessmentIdAndInstituteIdOrderByCreatedAtDesc(assessmentId, instituteId,
                        org.springframework.data.domain.PageRequest.of(0, pageSize))
                .getContent();

        List<ReportZipJobSummaryDto> summaries = jobs.stream().map(job -> {
            int remaining = (int) reportExportItemRepository.findByJobIdOrderByCreatedAt(job.getId()).stream()
                    .filter(i -> "PENDING".equals(i.getStatus())
                            || ("FAILED".equals(i.getStatus()) && (i.getRetryCount() == null || i.getRetryCount() < reportExportProperties.getMaxRetry())))
                    .count();
            boolean resumable = Set.of(ReportExportJobStatus.PARTIAL.name(), ReportExportJobStatus.FAILED.name(),
                    ReportExportJobStatus.CANCELLED.name()).contains(job.getStatus()) && remaining > 0;
            boolean assemblable = job.getCompletedCount() != null && job.getCompletedCount() > 0;
            return ReportZipJobSummaryDto.builder()
                    .jobId(job.getId())
                    .status(job.getStatus())
                    .totalCount(job.getTotalCount())
                    .completedCount(job.getCompletedCount())
                    .failedCount(job.getFailedCount())
                    .outputFileName(job.getOutputFileName())
                    .downloadUrl(resolveDownloadUrl(job.getOutputFileId()))
                    .resumable(resumable)
                    .assemblable(assemblable)
                    .createdAt(job.getCreatedAt())
                    .completedAt(job.getCompletedAt())
                    .createdByUserId(job.getCreatedByUserId())
                    .build();
        }).toList();

        return ReportZipRecentResponse.builder().jobs(summaries).build();
    }

    public ReportZipCancelResponse cancelReportZipExport(CustomUserDetails user, String jobId, String instituteId) {
        AssessmentReportExportJob job = loadJobForInstitute(jobId, instituteId);
        if (Set.of(ReportExportJobStatus.COMPLETED.name(), ReportExportJobStatus.FAILED.name(),
                ReportExportJobStatus.CANCELLED.name()).contains(job.getStatus())) {
            throw new VacademyException("Job " + jobId + " is already terminal (" + job.getStatus() + ")");
        }
        job.setStatus(ReportExportJobStatus.CANCELLED.name());
        job.setUpdatedAt(DateUtil.getCurrentUtcTime());
        reportExportJobRepository.save(job);
        return ReportZipCancelResponse.builder()
                .jobId(jobId)
                .status(ReportExportJobStatus.CANCELLED.name())
                .cancelled(true)
                .build();
    }

    private AssessmentReportExportJob loadJobForInstitute(String jobId, String instituteId) {
        AssessmentReportExportJob job = reportExportJobRepository.findById(jobId)
                .orElseThrow(() -> new VacademyException("Export job not found: " + jobId));
        if (!job.getInstituteId().equals(instituteId)) {
            throw new VacademyException("Export job does not belong to this institute");
        }
        return job;
    }

    // Resolved fresh on every call — the media service hardcodes a 1-day
    // presign expiry (plan C10), so a stored URL would silently expire.
    private String resolveDownloadUrl(String outputFileId) {
        if (outputFileId == null) return null;
        try {
            return fileService.getPublicUrlForFileId(outputFileId);
        } catch (Exception e) {
            log.warn("[report-export] Failed to resolve download URL for file {}: {}", outputFileId, e.getMessage());
            return null;
        }
    }
}
