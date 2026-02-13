package vacademy.io.admin_core_service.features.learner_reports.service;

import com.itextpdf.html2pdf.ConverterProperties;
import com.itextpdf.html2pdf.HtmlConverter;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.institute_learner.entity.Student;
import vacademy.io.admin_core_service.features.institute_learner.repository.InstituteStudentRepository;
import vacademy.io.admin_core_service.features.learner_reports.dto.*;
import vacademy.io.admin_core_service.features.module.entity.SubjectModuleMapping;
import vacademy.io.admin_core_service.features.module.repository.ModuleRepository;
import vacademy.io.admin_core_service.features.module.repository.SubjectModuleMappingRepository;
import vacademy.io.admin_core_service.features.packages.repository.PackageSessionRepository;
import vacademy.io.admin_core_service.features.session.dto.BatchInstituteProjection;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.module.Module;
import vacademy.io.common.institute.entity.session.PackageSession;
import vacademy.io.common.institute.entity.student.Subject;

import java.io.ByteArrayOutputStream;
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
    private final ModuleRepository moduleRepository;
    private final SubjectModuleMappingRepository subjectModuleMappingRepository;

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
            BatchInstituteProjection projection = fetchBatchAndInstitute(reportFilterDTO);
            List<SubjectProgressDTO> subjectProgressDTOS =
                    batchReportService.getSubjectProgressReport(reportFilterDTO.getPackageSessionId(), userDetails);

            String html = HtmlBuilderService.getBatchSubjectWiseProgressReportHtml(
                    subjectProgressDTOS,
                    projection.getBatchName(),
                    projection.getInstituteName()
            );
            return convertHtmlToPdf(html);
        } catch (Exception e) {
            e.printStackTrace();
            throw new VacademyException("PDF generation failed: " + e.getMessage());
        }
    }

    public byte[] generateChapterWiseBatchReport(ReportFilterDTO reportFilterDTO, CustomUserDetails userDetails) {
        try {
            // Fetch chapter-wise slide progress for the given module and batch
            List<ChapterSlideProgressDTO> chapterSlideProgress =
                    batchReportService.getChapterSlideProgress(
                            reportFilterDTO.getModuleId(),
                            reportFilterDTO.getPackageSessionId(),
                            userDetails
                    );

            // Header info (batch + institute)
            BatchInstituteProjection projection = fetchBatchAndInstitute(reportFilterDTO);

            // Optional: resolve module name for nicer header
            String moduleName = "";
            if (reportFilterDTO.getModuleId() != null) {
                Module module = moduleRepository.findById(reportFilterDTO.getModuleId()).orElse(null);
                if (module != null) {
                    moduleName = module.getModuleName();
                }
            }

            String html = HtmlBuilderService.getBatchChapterWiseReportHtml(
                    chapterSlideProgress,
                    projection.getBatchName(),
                    projection.getInstituteName(),
                    moduleName
            );

            return convertHtmlToPdf(html);
        } catch (Exception e) {
            e.printStackTrace();
            throw new VacademyException("PDF generation failed: " + e.getMessage());
        }
    }

    // ... existing code ...
    public byte[] generateModuleProgressReport(String moduleId, String userId, String packageSessionId, CustomUserDetails userDetails) {
        try {
            List<LearnerChapterSlideProgressDTO> chapterSlideProgress =
                    learnerReportService.getChapterSlideProgress(moduleId, userId, packageSessionId, userDetails);
            Student student = fetchStudent(userId);

            // get course / session / level from package session instead of hardcoding
            PackageSession packageSession = packageSessionRepository.findById(packageSessionId)
                    .orElseThrow(() -> new VacademyException("Package session not found"));

            String course = packageSession.getPackageEntity().getPackageName();
            String levelName = packageSession.getLevel() != null ? packageSession.getLevel().getLevelName() : "";
            String sessionName = packageSession.getSession() != null ? packageSession.getSession().getSessionName() : "";

            // Resolve module and subject names dynamically
            Module module = moduleRepository.findById(moduleId)
                    .orElseThrow(() -> new VacademyException("Module not found for id: " + moduleId));
            String moduleName = module.getModuleName();

            String subject = subjectModuleMappingRepository.findByModuleId(moduleId)
                    .map(SubjectModuleMapping::getSubject)
                    .map(Subject::getSubjectName)
                    .orElse("");

            String html = HtmlBuilderService.getModuleWiseReportHtml(
                    chapterSlideProgress,
                    student.getFullName(),
                    new Date().toString(),   // keep as-is unless you want formatted date
                    subject,
                    moduleName,
                    course,
                    sessionName,
                    levelName
            );
            return convertHtmlToPdf(html);
        } catch (Exception e) {
            e.printStackTrace();
            throw new VacademyException("PDF generation failed: " + e.getMessage());
        }
    }
    // ... existing code ...
}
