package vacademy.io.assessment_service.features.assessment.controller;

import com.itextpdf.html2pdf.ConverterProperties;
import com.itextpdf.html2pdf.HtmlConverter;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.assessment_service.features.assessment.dto.AssessmentUserFilter;
import vacademy.io.assessment_service.features.assessment.dto.ClosedAssessmentParticipantsResponse;
import vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.StudentReportFilter;
import vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.request.RespondentFilter;
import vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.response.QuestionInsightsResponse;
import vacademy.io.assessment_service.features.assessment.manager.AdminExportManager;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.io.ByteArrayOutputStream;
import java.util.List;
import java.util.Map;

import static vacademy.io.common.core.constants.PageConstants.DEFAULT_PAGE_NUMBER;
import static vacademy.io.common.core.constants.PageConstants.DEFAULT_PAGE_SIZE;

@RestController
@RequestMapping("/assessment-service/assessment/export")
public class AdminExportController {

    @Autowired
    AdminExportManager adminExportManager;

    @GetMapping("/csv/leaderboard")
    public ResponseEntity<byte[]> getLeaderboardCsv(@RequestAttribute(name = "user") CustomUserDetails user,
                                                    @RequestParam("assessmentId") String assessmentId,
                                                    @RequestParam("instituteId") String instituteId) {
        return adminExportManager.getLeaderBoardCsvExport(user, assessmentId, instituteId);
    }

    @GetMapping("/pdf/leaderboard")
    public ResponseEntity<InputStreamResource> getLeaderboardPdf(@RequestAttribute(name = "user") CustomUserDetails user,
                                                                 @RequestParam("assessmentId") String assessmentId,
                                                                 @RequestParam("instituteId") String instituteId) {
        return adminExportManager.getLeaderboardPdfExport(user, assessmentId, instituteId);
    }

    @GetMapping("/csv/marks-rank")
    public ResponseEntity<byte[]> getMarksRankCsv(@RequestAttribute(name = "user") CustomUserDetails user,
                                                    @RequestParam("assessmentId") String assessmentId,
                                                    @RequestParam("instituteId") String instituteId) {
        return adminExportManager.getMarksRankCsvExport(user, assessmentId, instituteId);
    }

    @GetMapping("/pdf/marks-rank")
    public ResponseEntity<InputStreamResource> getMarksRankPdf(@RequestAttribute(name = "user") CustomUserDetails user,
                                                                 @RequestParam("assessmentId") String assessmentId,
                                                                 @RequestParam("instituteId") String instituteId) {
        return adminExportManager.getMarksRankPdfExport(user, assessmentId, instituteId);
    }

    @PostMapping("/csv/registered-participants")
    public ResponseEntity<byte[]> getRegisteredCsv(@RequestAttribute("user") CustomUserDetails user,
                                                                                             @RequestParam(name = "instituteId") String instituteId,
                                                                                             @RequestParam(name = "assessmentId") String assessmentId,
                                                                                             @RequestBody AssessmentUserFilter filter){
        return adminExportManager.getRegisteredCsvExport(user, instituteId, assessmentId, filter);
    }

    @PostMapping("/pdf/registered-participants")
    public ResponseEntity<InputStreamResource> getRegisteredPdf(@RequestAttribute("user") CustomUserDetails user,
                                                   @RequestParam(name = "instituteId") String instituteId,
                                                   @RequestParam(name = "assessmentId") String assessmentId,
                                                   @RequestBody AssessmentUserFilter filter){
        return adminExportManager.getRegisteredPdfExport(user, instituteId, assessmentId, filter);
    }

    @PostMapping("/csv/respondent-list")
    public ResponseEntity<byte[]> getRespondentListCsv(@RequestAttribute("user") CustomUserDetails user,
                                                       @RequestParam(name = "instituteId") String instituteId,
                                                       @RequestParam(name = "sectionId") String sectionId,
                                                       @RequestParam(name = "questionId") String questionId,
                                                       @RequestParam(name = "assessmentId") String assessmentId,
                                                       @RequestBody RespondentFilter filter){
        return adminExportManager.getRespondentListCsvExport(user, instituteId, sectionId, questionId,assessmentId, filter);
    }

    @PostMapping("/pdf/respondent-list")
    public ResponseEntity<InputStreamResource> getRespondentListPdf(@RequestAttribute("user") CustomUserDetails user,
                                                       @RequestParam(name = "instituteId") String instituteId,
                                                       @RequestParam(name = "sectionId") String sectionId,
                                                       @RequestParam(name = "questionId") String questionId,
                                                       @RequestParam(name = "assessmentId") String assessmentId,
                                                       @RequestBody RespondentFilter filter){
        return adminExportManager.getRespondentListPdfExport(user, instituteId, sectionId, questionId,assessmentId, filter);
    }

    @GetMapping("pdf/question-insights")
    public ResponseEntity<byte[]> questionInsightsPdf(@RequestAttribute("user") CustomUserDetails user,
                                                                     @RequestParam("assessmentId") String assessmentId,
                                                                     @RequestParam("instituteId") String instituteId,
                                                                     @RequestParam("sectionIds") String sectionIds){
        return adminExportManager.getQuestionInsightsExport(user, assessmentId, instituteId, sectionIds);
    }

    @GetMapping("pdf/student-report")
    public ResponseEntity<byte[]> studentReportPdf(@RequestAttribute("user") CustomUserDetails user,
                                                   @RequestParam("assessmentId") String assessmentId,
                                                   @RequestParam("attemptId") String attemptId,
                                                   @RequestParam("instituteId") String instituteId){
        return adminExportManager.getStudentReportPdf(user, assessmentId, attemptId, instituteId);
    }
}
