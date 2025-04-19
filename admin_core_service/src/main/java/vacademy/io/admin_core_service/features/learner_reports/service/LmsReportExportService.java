package vacademy.io.admin_core_service.features.learner_reports.service;

import com.itextpdf.html2pdf.ConverterProperties;
import com.itextpdf.html2pdf.HtmlConverter;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.institute_learner.entity.Student;
import vacademy.io.admin_core_service.features.institute_learner.repository.InstituteStudentRepository;
import vacademy.io.admin_core_service.features.learner_reports.dto.*;
import vacademy.io.admin_core_service.features.packages.repository.PackageSessionRepository;
import vacademy.io.admin_core_service.features.session.dto.BatchInstituteProjection;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

import java.io.ByteArrayOutputStream;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Date;
import java.util.List;

@Service
@RequiredArgsConstructor
public class LmsReportExportService {

    private final BatchReportService batchReportService;
    private final LearnerReportService learnerReportService;
    private final PackageSessionRepository packageSessionRepository;
    private final InstituteStudentRepository instituteStudentRepository;

    public byte[] generateLmsReport(ReportFilterDTO reportFilterDTO, CustomUserDetails userDetails) {
        ProgressReportDTO batchProgressReport = batchReportService.getBatchReport(reportFilterDTO, userDetails);
        List<LearnerActivityDataProjection> activityData = batchReportService.getBatchActivityDataLeaderBoard(reportFilterDTO, userDetails);

        BatchInstituteProjection projection = fetchBatchAndInstitute(reportFilterDTO);
        String academicYear = getFormattedDateRange(reportFilterDTO);

        String html = HtmlBuilderService.buildStyledHtmlReport(
                "Progress Report",
                projection.getBatchName(),
                projection.getInstituteName(),
                academicYear,
                batchProgressReport,
                activityData
        );

        return convertHtmlToPdf(html);
    }

    public byte[] generateLearnerReport(ReportFilterDTO reportFilterDTO, CustomUserDetails userDetails) {
        ProgressReportDTO learnerReport = learnerReportService.getLearnerProgressReport(reportFilterDTO, userDetails);
        ProgressReportDTO batchReport = batchReportService.getBatchReport(reportFilterDTO, userDetails);
        List<SlideProgressDateWiseDTO> progress = learnerReportService.getSlideProgressForLearner(reportFilterDTO, userDetails);
        Student student = fetchStudent(reportFilterDTO.getUserId());
        BatchInstituteProjection projection = fetchBatchAndInstitute(reportFilterDTO);
        String academicYear = getFormattedDateRange(reportFilterDTO);

        String html = HtmlBuilderService.generateHtmlForLearnerReport(
                learnerReport,
                batchReport,
                progress,
                projection.getInstituteName(),
                projection.getBatchName(),
                academicYear,
                student.getFullName()
        );

        return convertHtmlToPdf(html);
    }

    private Student fetchStudent(String userId) {
        return instituteStudentRepository.findTopByUserId(userId)
                .orElseThrow(() -> new VacademyException("Student not found"));
    }

    private BatchInstituteProjection fetchBatchAndInstitute(ReportFilterDTO filterDTO) {
        return packageSessionRepository
                .findBatchAndInstituteByPackageSessionId(filterDTO.getPackageSessionId())
                .orElseThrow(() -> new VacademyException("Batch or institute not found"));
    }

    private String getFormattedDateRange(ReportFilterDTO filterDTO) {
        if (filterDTO.getStartDate() == null || filterDTO.getEndDate() == null) {
            throw new VacademyException("Start date and end date are required to determine academic year");
        }

        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("dd MMMM yyyy");
        String start = filterDTO.getStartDate().toLocalDate().format(formatter);
        String end = filterDTO.getEndDate().toLocalDate().format(formatter);
        return start + " - " + end;
    }

    private byte[] convertHtmlToPdf(String html) {
        try (ByteArrayOutputStream outputStream = new ByteArrayOutputStream()) {
            HtmlConverter.convertToPdf(html, outputStream, new ConverterProperties());
            return outputStream.toByteArray();
        } catch (Exception e) {
            throw new VacademyException("PDF generation failed: " + e.getMessage());
        }
    }

    public byte[] generateSubjectWiseLearnerProgressReport(ReportFilterDTO reportFilterDTO, CustomUserDetails userDetails) {
        try {
            List<LearnerSubjectWiseProgressReportDTO>subjectProgressDTOS = learnerReportService.getSubjectProgressReport(reportFilterDTO.getPackageSessionId(), reportFilterDTO.getUserId(), userDetails);
            Student student = fetchStudent(reportFilterDTO.getUserId());
            BatchInstituteProjection projection = fetchBatchAndInstitute(reportFilterDTO);
            String html = HtmlBuilderService.getSubjectWiseProgressReportHtml(subjectProgressDTOS,student.getFullName(),projection.getBatchName(), projection.getInstituteName());
            return convertHtmlToPdf(html);
        }
        catch (Exception e) {
            e.printStackTrace();
            throw new VacademyException("PDF generation failed: " + e.getMessage());
        }
    }

    public byte[] generateModuleProgressReport(String moduleId,String userId,String packageSessionId, CustomUserDetails userDetails) {
        try {
            List<ChapterSlideProgressDTO>chapterSlideProgress = learnerReportService.getChapterSlideProgress(moduleId,userId,userDetails);
            Student student = fetchStudent(userId);
//            BatchInstituteProjection projection = fetchBatchAndInstitute(reportFilterDTO);
            String html = HtmlBuilderService.getModuleWiseReportHtml(chapterSlideProgress,student.getFullName(),new Date().toString(),"Premium Pro Group","M1" ,"Bhopal","202025","202025");
            return convertHtmlToPdf(html);
        }
        catch (Exception e) {
            e.printStackTrace();
            throw new VacademyException("PDF generation failed: " + e.getMessage());
        }
    }
}
