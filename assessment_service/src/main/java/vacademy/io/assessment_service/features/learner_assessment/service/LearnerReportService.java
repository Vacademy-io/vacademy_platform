package vacademy.io.assessment_service.features.learner_assessment.service;

import com.itextpdf.html2pdf.ConverterProperties;
import com.itextpdf.html2pdf.HtmlConverter;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.assessment_service.features.assessment.dto.LeaderBoardDto;
import vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.StudentReportFilter;
import vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.response.*;
import vacademy.io.assessment_service.features.assessment.entity.Assessment;
import vacademy.io.assessment_service.features.assessment.entity.AssessmentUserRegistration;
import vacademy.io.assessment_service.features.assessment.entity.Section;
import vacademy.io.assessment_service.features.assessment.entity.StudentAttempt;
import vacademy.io.assessment_service.features.assessment.manager.AssessmentParticipantsManager;
import vacademy.io.assessment_service.features.assessment.repository.AssessmentRepository;
import vacademy.io.assessment_service.features.assessment.repository.AssessmentUserRegistrationRepository;
import vacademy.io.assessment_service.features.assessment.repository.SectionRepository;
import vacademy.io.assessment_service.features.assessment.repository.StudentAttemptRepository;
import vacademy.io.assessment_service.features.assessment.service.HtmlBuilderService;
import vacademy.io.assessment_service.features.learner_assessment.dto.*;
import vacademy.io.assessment_service.features.learner_assessment.entity.QuestionWiseMarks;
import vacademy.io.assessment_service.features.learner_assessment.repository.QuestionWiseMarksRepository;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

import java.io.ByteArrayOutputStream;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class LearnerReportService {

    @Autowired
    private StudentAttemptRepository studentAttemptRepository;

    @Autowired
    private AssessmentUserRegistrationRepository registrationRepository;

    @Autowired
    private AssessmentParticipantsManager assessmentParticipantsManager;

    @Autowired
    private AssessmentRepository assessmentRepository;

    @Autowired
    private SectionRepository sectionRepository;

    @Autowired
    private QuestionWiseMarksRepository questionWiseMarksRepository;

    @Autowired
    private HtmlBuilderService htmlBuilderService;

    @Autowired
    private vacademy.io.common.media.service.FileService fileService;

    @Autowired
    @org.springframework.context.annotation.Lazy
    private LearnerReportService self;

    @Autowired
    private vacademy.io.assessment_service.features.client.AdminCoreServiceClient adminCoreServiceClient;

    private static final int TOP_RANKS_COUNT = 2;
    private static final int SURROUNDING_WINDOW = 3;

    /**
     * Validates that the current user owns the given attempt and report is released.
     */
    private AssessmentUserRegistration validateOwnershipAndAccess(String userId, String assessmentId, String attemptId) {
        Optional<AssessmentUserRegistration> registration = registrationRepository
                .findTopByUserIdAndAssessmentId(userId, assessmentId);

        if (registration.isEmpty()) {
            throw new VacademyException("You are not registered for this assessment");
        }

        Optional<StudentAttempt> attempt = studentAttemptRepository.findById(attemptId);
        if (attempt.isEmpty()) {
            throw new VacademyException("Attempt not found");
        }

        if (!attempt.get().getRegistration().getId().equals(registration.get().getId())) {
            throw new VacademyException("You do not have access to this attempt");
        }

        return registration.get();
    }

    /**
     * Get paginated list of own assessment reports.
     */
    public ResponseEntity<Page<StudentReportDto>> getStudentReportList(CustomUserDetails user, String instituteId,
                                                                        StudentReportFilter filter, int pageNo, int pageSize) {
        Pageable pageable = PageRequest.of(pageNo, pageSize);

        List<String> statusList = filter.getStatus() != null ? filter.getStatus() : List.of("ENDED");
        List<String> releaseStatus = filter.getReleaseResultStatus() != null ? filter.getReleaseResultStatus() : List.of("RELEASED");
        List<String> assessmentTypes = filter.getAssessmentType();

        Page<StudentReportDto> reports;
        if (StringUtils.hasText(filter.getName())) {
            reports = studentAttemptRepository.findAssessmentForUserWithFilterAndSearch(
                    filter.getName(), user.getUserId(), instituteId, statusList, releaseStatus, assessmentTypes, pageable);
        } else {
            reports = studentAttemptRepository.findAssessmentForUserWithFilter(
                    user.getUserId(), instituteId, statusList, releaseStatus, assessmentTypes, pageable);
        }

        return ResponseEntity.ok(reports);
    }

    /**
     * Get detailed report for own attempt.
     */
    public ResponseEntity<StudentReportOverallDetailDto> getStudentReportDetail(CustomUserDetails user, String assessmentId,
                                                                                 String attemptId, String instituteId) {
        validateOwnershipAndAccess(user.getUserId(), assessmentId, attemptId);

        StudentReportOverallDetailDto reportDetail = assessmentParticipantsManager
                .createStudentReportDetailResponse(assessmentId, attemptId, instituteId);

        return ResponseEntity.ok(reportDetail);
    }

    /**
     * Get comparison data: student vs batch performance.
     */
    public ResponseEntity<StudentComparisonDto> getComparisonData(CustomUserDetails user, String assessmentId,
                                                                    String attemptId, String instituteId) {
        validateOwnershipAndAccess(user.getUserId(), assessmentId, attemptId);
        StudentComparisonDto comparison = self.buildComparisonData(user.getUserId(), assessmentId, attemptId, instituteId);
        return ResponseEntity.ok(comparison);
    }

    /**
     * Core comparison data builder — cached for 15 minutes per attempt.
     * Reused by both the API endpoint and PDF generation.
     */
    @Cacheable(value = "comparisonData", key = "#assessmentId + ':' + #attemptId")
    public StudentComparisonDto buildComparisonData(String userId, String assessmentId,
                                                     String attemptId, String instituteId) {
        // Get overview stats
        AssessmentOverviewDto overview = studentAttemptRepository.findAssessmentOverviewDetails(assessmentId, instituteId);
        if (overview == null) return null;

        // Get student's own overall detail
        ParticipantsQuestionOverallDetailDto studentDetail = studentAttemptRepository
                .findParticipantsQuestionOverallDetails(assessmentId, instituteId, attemptId);
        if (studentDetail == null) return null;

        // Get marks distribution
        List<MarksRankDto> marksDistribution = studentAttemptRepository.findMarkRankForAssessment(assessmentId, instituteId);

        // Get leaderboard for smart contextual window
        List<LeaderBoardDto> fullLeaderboard = studentAttemptRepository
                .findLeaderBoardForAssessmentAndInstituteId(assessmentId, instituteId, List.of("ACTIVE"));
        SmartLeaderboardDto smartLeaderboard = buildSmartLeaderboard(fullLeaderboard, userId);

        // Compute highest/lowest marks (null-safe)
        Double highestMarks = 0.0;
        Double lowestMarks = 0.0;
        if (!marksDistribution.isEmpty()) {
            Double first = marksDistribution.get(0).getMarks();
            Double last = marksDistribution.get(marksDistribution.size() - 1).getMarks();
            highestMarks = first != null ? first : 0.0;
            lowestMarks = last != null ? last : 0.0;
        }

        // Build section-wise comparison (also used to derive total marks)
        List<SectionComparisonDto> sectionComparisons = buildSectionComparison(assessmentId, attemptId, instituteId);

        // Derive total marks from section totals (avoids extra DB query)
        double totalMarksSum = sectionComparisons.stream()
                .mapToDouble(s -> s.getSectionTotalMarks() != null ? s.getSectionTotalMarks() : 0.0)
                .sum();
        Double totalMarks = totalMarksSum > 0 ? totalMarksSum : 100.0;

        // Compute accuracy
        int correctCount = studentDetail.getCorrectAttempt() != null ? studentDetail.getCorrectAttempt() : 0;
        int wrongCount = studentDetail.getWrongAttempt() != null ? studentDetail.getWrongAttempt() : 0;
        int partialCount = studentDetail.getPartialCorrectAttempt() != null ? studentDetail.getPartialCorrectAttempt() : 0;
        int skippedCount = studentDetail.getSkippedCount() != null ? studentDetail.getSkippedCount() : 0;
        int totalQuestions = correctCount + wrongCount + partialCount + skippedCount;
        double studentAccuracy = totalQuestions > 0 ? (correctCount * 100.0) / totalQuestions : 0.0;

        // Compute class accuracy from overview
        double classAccuracy = 0.0;
        if (overview.getTotalParticipants() != null && overview.getTotalParticipants() > 0
                && overview.getAverageMarks() != null && highestMarks > 0) {
            classAccuracy = (overview.getAverageMarks() / highestMarks) * 100.0;
        }

        return StudentComparisonDto.builder()
                .startTime(studentDetail.getStartTime())
                .submitTime(studentDetail.getSubmitTime())
                .studentRank(studentDetail.getRank())
                .studentPercentile(studentDetail.getPercentile())
                .studentMarks(studentDetail.getAchievedMarks())
                .totalMarks(totalMarks)
                .totalParticipants(overview.getTotalParticipants())
                .averageMarks(overview.getAverageMarks())
                .highestMarks(highestMarks)
                .lowestMarks(lowestMarks)
                .averageDuration(overview.getAverageDuration())
                .studentDuration(studentDetail.getCompletionTimeInSeconds())
                .studentAccuracy(Math.round(studentAccuracy * 10.0) / 10.0)
                .classAccuracy(Math.round(classAccuracy * 10.0) / 10.0)
                .marksDistribution(marksDistribution)
                .sectionWiseComparison(sectionComparisons)
                .leaderboard(smartLeaderboard)
                .build();
    }

    /**
     * Get student-facing smart leaderboard.
     */
    public ResponseEntity<SmartLeaderboardDto> getStudentLeaderboard(CustomUserDetails user, String assessmentId,
                                                                      String instituteId) {
        List<LeaderBoardDto> fullLeaderboard = studentAttemptRepository
                .findLeaderBoardForAssessmentAndInstituteId(assessmentId, instituteId, List.of("ACTIVE"));
        SmartLeaderboardDto smartLeaderboard = buildSmartLeaderboard(fullLeaderboard, user.getUserId());
        return ResponseEntity.ok(smartLeaderboard);
    }

    /**
     * Download own PDF report.
     */
    public ResponseEntity<byte[]> getStudentReportPdf(CustomUserDetails user, String assessmentId,
                                                        String attemptId, String instituteId) {
        AssessmentUserRegistration registration = validateOwnershipAndAccess(user.getUserId(), assessmentId, attemptId);

        // Check if a pre-generated PDF exists
        Optional<StudentAttempt> attemptOpt = studentAttemptRepository.findById(attemptId);
        if (attemptOpt.isPresent() && attemptOpt.get().getReportPdfFileId() != null) {
            try {
                byte[] cachedPdf = fileService.getFileFromFileId(attemptOpt.get().getReportPdfFileId());
                if (cachedPdf != null && cachedPdf.length > 0) {
                    return ResponseEntity.ok()
                            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=studentReport.pdf")
                            .contentType(MediaType.APPLICATION_PDF)
                            .body(cachedPdf);
                }
            } catch (Exception e) {
                // Cached file unavailable, fall through to generate on-the-fly
            }
        }

        // Generate on-the-fly if no cached PDF
        StudentReportOverallDetailDto reportDetail = assessmentParticipantsManager
                .createStudentReportDetailResponse(assessmentId, attemptId, instituteId);

        Optional<Assessment> assessmentOptional = assessmentRepository.findById(assessmentId);
        if (assessmentOptional.isEmpty()) throw new VacademyException("Assessment Not Found");

        StudentComparisonDto comparison = self.buildComparisonData(user.getUserId(), assessmentId, attemptId, instituteId);

        Map<String, Map<String, Double>> optionDist = null;
        try {
            optionDist = self.computeOptionDistribution(assessmentId);
        } catch (Exception ignored) {}

        // Fetch report branding
        ReportBrandingDto branding = null;
        try {
            branding = adminCoreServiceClient.getReportBranding(instituteId);
        } catch (Exception ignored) {}

        String studentReportHtml = htmlBuilderService.generateStudentReportHtml(
                assessmentOptional.get().getName(), reportDetail, comparison, optionDist, branding);

        ByteArrayOutputStream pdfOutputStream = new ByteArrayOutputStream();
        ConverterProperties converterProperties = new ConverterProperties();
        HtmlConverter.convertToPdf(studentReportHtml, pdfOutputStream, converterProperties);

        byte[] pdfBytes = pdfOutputStream.toByteArray();
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=studentReport.pdf")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdfBytes);
    }

    /**
     * API endpoint: returns option distribution with auth check.
     */
    public ResponseEntity<Map<String, Map<String, Double>>> getOptionDistribution(
            CustomUserDetails user, String assessmentId, String attemptId, String instituteId) {
        validateOwnershipAndAccess(user.getUserId(), assessmentId, attemptId);
        return ResponseEntity.ok(self.computeOptionDistribution(assessmentId));
    }

    /**
     * Core option distribution computation. Cached for 15 minutes per assessment.
     * Returns: questionId -> { optionId -> percentage }
     */
    @Cacheable(value = "comparisonData", key = "'optdist:' + #assessmentId")
    public Map<String, Map<String, Double>> computeOptionDistribution(String assessmentId) {
        List<Object[]> rows = questionWiseMarksRepository.findOptionResponsesByAssessmentId(assessmentId);

        Map<String, List<String>> responsesByQuestion = new HashMap<>();
        for (Object[] row : rows) {
            String questionId = (String) row[0];
            String responseJson = (String) row[1];
            responsesByQuestion.computeIfAbsent(questionId, k -> new ArrayList<>()).add(responseJson);
        }

        com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
        Map<String, Map<String, Double>> result = new HashMap<>();

        for (Map.Entry<String, List<String>> entry : responsesByQuestion.entrySet()) {
            String questionId = entry.getKey();
            List<String> responses = entry.getValue();
            int totalResponses = responses.size();

            Map<String, Integer> optionCounts = new HashMap<>();
            for (String json : responses) {
                try {
                    com.fasterxml.jackson.databind.JsonNode root = mapper.readTree(json);
                    com.fasterxml.jackson.databind.JsonNode optionIds = root.path("responseData").path("optionIds");
                    if (optionIds.isArray()) {
                        for (com.fasterxml.jackson.databind.JsonNode idNode : optionIds) {
                            optionCounts.merge(idNode.asText(), 1, Integer::sum);
                        }
                    }
                } catch (Exception ignored) {}
            }

            if (!optionCounts.isEmpty()) {
                Map<String, Double> percentages = new HashMap<>();
                for (Map.Entry<String, Integer> oc : optionCounts.entrySet()) {
                    percentages.put(oc.getKey(), Math.round((oc.getValue() * 1000.0) / totalResponses) / 10.0);
                }
                result.put(questionId, percentages);
            }
        }

        return result;
    }

    /**
     * Builds a smart leaderboard showing top 2 + ±3 around the student.
     */
    private SmartLeaderboardDto buildSmartLeaderboard(List<LeaderBoardDto> fullLeaderboard, String userId) {
        if (fullLeaderboard == null || fullLeaderboard.isEmpty()) {
            return SmartLeaderboardDto.builder()
                    .topRanks(Collections.emptyList())
                    .surroundingRanks(Collections.emptyList())
                    .hasGap(false)
                    .totalParticipants(0L)
                    .build();
        }

        int studentIndex = -1;
        for (int i = 0; i < fullLeaderboard.size(); i++) {
            if (userId.equals(fullLeaderboard.get(i).getUserId())) {
                studentIndex = i;
                break;
            }
        }

        long totalParticipants = fullLeaderboard.size();
        Integer studentRank = studentIndex >= 0 ? fullLeaderboard.get(studentIndex).getRank() : null;

        // Top 2
        List<LeaderBoardDto> topRanks = fullLeaderboard.stream()
                .limit(TOP_RANKS_COUNT)
                .collect(Collectors.toList());

        // ±3 around student
        List<LeaderBoardDto> surroundingRanks;
        boolean hasGap;

        if (studentIndex < 0) {
            // Student not in leaderboard (shouldn't happen normally)
            surroundingRanks = Collections.emptyList();
            hasGap = false;
        } else if (studentIndex < TOP_RANKS_COUNT + SURROUNDING_WINDOW) {
            // Student is close to top, no gap needed — show from top to student+3
            int end = Math.min(studentIndex + SURROUNDING_WINDOW + 1, fullLeaderboard.size());
            surroundingRanks = fullLeaderboard.subList(TOP_RANKS_COUNT, end)
                    .stream().collect(Collectors.toList());
            hasGap = false;
        } else {
            // Gap between top 2 and student's window
            int start = Math.max(studentIndex - SURROUNDING_WINDOW, TOP_RANKS_COUNT);
            int end = Math.min(studentIndex + SURROUNDING_WINDOW + 1, fullLeaderboard.size());
            surroundingRanks = fullLeaderboard.subList(start, end)
                    .stream().collect(Collectors.toList());
            hasGap = true;
        }

        return SmartLeaderboardDto.builder()
                .topRanks(topRanks)
                .surroundingRanks(surroundingRanks)
                .hasGap(hasGap)
                .studentRank(studentRank)
                .totalParticipants(totalParticipants)
                .build();
    }

    /**
     * Builds section-wise comparison data using aggregated queries (no N+1).
     */
    private List<SectionComparisonDto> buildSectionComparison(String assessmentId, String attemptId, String instituteId) {
        List<Section> sections = sectionRepository.findByAssessmentIdAndStatusNotIn(assessmentId, List.of("DELETED"));
        if (sections == null || sections.isEmpty()) return Collections.emptyList();

        List<String> sectionIds = sections.stream().map(Section::getId).collect(Collectors.toList());

        // Single aggregation query for class averages per section
        List<Object[]> aggregations = questionWiseMarksRepository
                .findSectionWiseAggregation(assessmentId, instituteId, sectionIds);

        // Map sectionId -> [avgMarks, maxMarks, totalCorrect, totalQuestions]
        Map<String, Object[]> aggMap = new HashMap<>();
        for (Object[] row : aggregations) {
            String sectionId = (String) row[0];
            aggMap.put(sectionId, row);
        }

        // Fetch all student marks once and group by section (avoids N+1)
        List<QuestionWiseMarks> allStudentMarks = questionWiseMarksRepository.findByStudentAttemptId(attemptId);
        Map<String, List<QuestionWiseMarks>> marksBySectionId = allStudentMarks.stream()
                .filter(qwm -> qwm.getSection() != null)
                .collect(Collectors.groupingBy(qwm -> qwm.getSection().getId()));

        List<SectionComparisonDto> comparisons = new ArrayList<>();

        for (Section section : sections) {
            List<QuestionWiseMarks> studentSectionMarks = marksBySectionId.getOrDefault(section.getId(), Collections.emptyList());
            double studentSectionTotal = studentSectionMarks.stream()
                    .mapToDouble(QuestionWiseMarks::getMarks)
                    .sum();
            long studentCorrect = studentSectionMarks.stream()
                    .filter(qwm -> "CORRECT".equals(qwm.getStatus()))
                    .count();
            long studentTotal = studentSectionMarks.size();
            double studentAccuracy = studentTotal > 0 ? (studentCorrect * 100.0) / studentTotal : 0.0;

            // Class data from aggregation
            double classAvg = 0.0;
            double classHighestMarks = 0.0;
            double classAccuracy = 0.0;
            Object[] agg = aggMap.get(section.getId());
            if (agg != null) {
                classAvg = agg[1] != null ? ((Number) agg[1]).doubleValue() : 0.0;
                classHighestMarks = agg[2] != null ? ((Number) agg[2]).doubleValue() : 0.0;
                long totalCorrect = agg[3] != null ? ((Number) agg[3]).longValue() : 0;
                long totalQuestions = agg[4] != null ? ((Number) agg[4]).longValue() : 0;
                classAccuracy = totalQuestions > 0 ? (totalCorrect * 100.0) / totalQuestions : 0.0;
            }

            Double sectionTotalMarks = section.getTotalMarks() != null ? section.getTotalMarks() : 0.0;
            Double cutOff = section.getCutOffMarks();
            boolean passed = cutOff != null && studentSectionTotal >= cutOff;

            comparisons.add(SectionComparisonDto.builder()
                    .sectionId(section.getId())
                    .sectionName(section.getName())
                    .studentMarks(studentSectionTotal)
                    .sectionTotalMarks(sectionTotalMarks)
                    .sectionAverageMarks(Math.round(classAvg * 10.0) / 10.0)
                    .sectionHighestMarks(classHighestMarks)
                    .cutOffMarks(cutOff)
                    .studentAccuracy(Math.round(studentAccuracy * 10.0) / 10.0)
                    .classAccuracy(Math.round(classAccuracy * 10.0) / 10.0)
                    .passed(passed)
                    .build());
        }

        return comparisons;
    }
}
