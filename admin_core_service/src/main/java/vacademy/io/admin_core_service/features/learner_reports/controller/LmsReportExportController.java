package vacademy.io.admin_core_service.features.learner_reports.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.learner_reports.dto.ReportFilterDTO;
import vacademy.io.admin_core_service.features.learner_reports.service.LmsReportExportService;
import vacademy.io.common.auth.model.CustomUserDetails;

@RestController
@RequestMapping("/admin-core-service/learner-management/export")
public class LmsReportExportController {

    @Autowired
    private LmsReportExportService lmsReportExportService;

    @PostMapping("/batch-report")
    public ResponseEntity<byte[]> getLearnerProgressReport(@RequestBody ReportFilterDTO filterDTO,
                                                           @RequestAttribute("user") CustomUserDetails userDetails) {
        byte[] pdfBytes = lmsReportExportService.generateLmsReport(filterDTO, userDetails);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        headers.setContentDisposition(ContentDisposition.builder("attachment")
                .filename("Progress_Report.pdf")
                .build());
        headers.setContentLength(pdfBytes.length);

        return new ResponseEntity<>(pdfBytes, headers, HttpStatus.OK);
    }


    @PostMapping(value = "/learner-report", produces = MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<byte[]> downloadLearnerReport(@RequestBody ReportFilterDTO reportFilterDTO,
                                                        @RequestAttribute("user") CustomUserDetails userDetails) {
        byte[] pdfBytes = lmsReportExportService.generateLearnerReport(reportFilterDTO, userDetails);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        headers.setContentDisposition(ContentDisposition
                .builder("attachment")
                .filename("Learner_Report.pdf")
                .build());

        return new ResponseEntity<>(pdfBytes, headers, HttpStatus.OK);
    }

    @PostMapping(value = "/learner-subject-wise-report", produces = MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<byte[]> downloadSubjectWiseProgress(@RequestBody ReportFilterDTO reportFilterDTO,
                                                              @RequestAttribute("user") CustomUserDetails userDetails) {
        byte[] pdfBytes = lmsReportExportService.generateSubjectWiseLearnerProgressReport(reportFilterDTO, userDetails);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        headers.setContentDisposition(ContentDisposition
                .builder("attachment")
                .filename("Learner_Report.pdf")
                .build());

        return new ResponseEntity<>(pdfBytes, headers, HttpStatus.OK);
    }

    @PostMapping(value = "/learner-module-progress-report", produces = MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<byte[]> downloadSubjectWiseProgress(@RequestParam String userId,
                                                              @RequestParam String moduleId,
                                                              @RequestParam String packageSessionId,
                                                              @RequestAttribute("user") CustomUserDetails userDetails) {
        byte[] pdfBytes = lmsReportExportService.generateModuleProgressReport(moduleId, userId, packageSessionId, userDetails);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        headers.setContentDisposition(ContentDisposition
                .builder("attachment")
                .filename("Learner_Report.pdf")
                .build());

        return new ResponseEntity<>(pdfBytes, headers, HttpStatus.OK);
    }

    @PostMapping(value = "/chapter-wise-batch-report", produces = MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<byte[]> downloadChapterWiseBatchReport(@RequestBody ReportFilterDTO reportFilterDTO,
                                                                 @RequestAttribute("user") CustomUserDetails userDetails) {
        byte[] pdfBytes = lmsReportExportService.generateChapterWiseBatchReport(reportFilterDTO, userDetails);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        headers.setContentDisposition(ContentDisposition
                .builder("attachment")
                .filename("Chapter_Wise_Batch_Report.pdf")
                .build());

        return new ResponseEntity<>(pdfBytes, headers, HttpStatus.OK);
    }

}
