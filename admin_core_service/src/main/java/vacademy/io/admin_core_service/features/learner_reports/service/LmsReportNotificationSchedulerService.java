package vacademy.io.admin_core_service.features.learner_reports.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.itextpdf.html2pdf.ConverterProperties;
import com.itextpdf.html2pdf.HtmlConverter;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.institute_learner.enums.LearnerStatusEnum;
import vacademy.io.admin_core_service.features.learner_reports.dto.ProgressReportDTO;
import vacademy.io.admin_core_service.features.learner_reports.dto.ReportFilterDTO;
import vacademy.io.admin_core_service.features.learner_reports.dto.SlideProgressDateWiseDTO;
import vacademy.io.admin_core_service.features.learner_reports.dto.report_notification.LmsReportNotificationDetailsDTO;
import vacademy.io.admin_core_service.features.learner_reports.notification.LmsReportNotificationEmailBody;
import vacademy.io.admin_core_service.features.notification_service.enums.CommunicationType;
import vacademy.io.admin_core_service.features.notification_service.enums.NotificationSettingStatusEnum;
import vacademy.io.admin_core_service.features.notification_service.enums.NotificationSourceEnum;
import vacademy.io.admin_core_service.features.notification_service.enums.NotificationType;
import vacademy.io.admin_core_service.features.notification.repository.NotificationSettingRepository;
import vacademy.io.admin_core_service.features.notification_service.service.EmailNotificationService;
import vacademy.io.admin_core_service.features.packages.enums.PackageSessionStatusEnum;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.notification.dto.AttachmentNotificationDTO;
import vacademy.io.common.notification.dto.AttachmentUsersDTO;

import java.io.ByteArrayOutputStream;
import java.sql.Date;
import java.text.SimpleDateFormat;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class LmsReportNotificationSchedulerService {

    @Autowired
    private NotificationSettingRepository notificationSettingRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private BatchReportService batchReportService;

    @Autowired
    private LearnerReportService learnerReportService;

    @Autowired
    private EmailNotificationService notificationService;


    public Boolean sendDailyReport() {
        return sendReports("DAILY");
    }

    public Boolean sendWeeklyReport() {
        return sendReports("WEEKLY");
    }

    public Boolean sendMonthly() {
        return sendReports("MONTHLY");
    }

    public Boolean sendReports(String frequency) {
        try {
            List<Object[]> result = notificationSettingRepository.fetchDynamicInstitutesWithSettings(
                    frequency,
                    List.of(
                            PackageSessionStatusEnum.ACTIVE.name(),
                            PackageSessionStatusEnum.HIDDEN.name()
                    ),
                    List.of(
                            NotificationType.LEARNER_PROGRESS_REPORT.name(),
                            NotificationType.BATCH_PROGRESS_REPORT.name(),
                            NotificationType.BATCH_PROGRESS_REPORT_FOR_PARENT.name(),
                            NotificationType.LEARNER_PROGRESS_REPORT_FOR_PARENT.name()
                    ),
                    List.of(LearnerStatusEnum.ACTIVE.name()),
                    List.of(NotificationSettingStatusEnum.ACTIVE.name())
            );

            List<LmsReportNotificationDetailsDTO> dtoList = new ArrayList<>();
            for (Object[] row : result) {
                dtoList.add(buildReportDTO(row));
            }

            LocalDate now = LocalDate.now();
            LocalDate startLocalDate;
            LocalDate endLocalDate;
            String reportType = "Daily";
            switch (frequency) {
                case "DAILY":
                    startLocalDate = now.minusDays(1);
                    endLocalDate = now.minusDays(1);
                    break;
                case "WEEKLY":
                    startLocalDate = now.minusWeeks(1).with(DayOfWeek.MONDAY);
                    endLocalDate = startLocalDate.plusDays(6);
                    reportType = "Weekly";
                    break;
                case "MONTHLY":
                    startLocalDate = now.minusMonths(1).withDayOfMonth(1);
                    endLocalDate = startLocalDate.withDayOfMonth(startLocalDate.lengthOfMonth());
                    reportType = "Monthly";
                    break;
                default:
                    throw new IllegalArgumentException("Invalid frequency: " + frequency);
            }

            ZoneId zone = ZoneId.systemDefault();
            Instant startInstant = startLocalDate.atStartOfDay(zone).toInstant();
            Instant endInstant = endLocalDate.atTime(LocalTime.MAX).atZone(zone).toInstant();

            Date startDate = new Date(Date.from(startInstant).getTime());
            Date endDate = new Date(Date.from(endInstant).getTime());

            for (LmsReportNotificationDetailsDTO dto : dtoList) {
                return sendProgressReport(dto, startDate, endDate, null, reportType);
            }
        } catch (Exception e) {
            e.printStackTrace();
            throw new RuntimeException("Failed to send reports", e);
        }

        return true;
    }


    private LmsReportNotificationDetailsDTO buildReportDTO(Object[] row) {
        try {
            LmsReportNotificationDetailsDTO dto = new LmsReportNotificationDetailsDTO();
            dto.setInstituteId((String) row[0]);
            dto.setInstituteName((String) row[1]);

            if (row[2] != null) {
                dto.setInstituteData(
                        objectMapper.readValue(row[2].toString(), LmsReportNotificationDetailsDTO.InstituteData.class)
                );
            }

            return dto;
        } catch (Exception e) {
            throw new RuntimeException("Failed to parse institute data row", e);
        }
    }


    private byte[] generatePdf(String html) {
        ByteArrayOutputStream pdfOutputStream = new ByteArrayOutputStream();
        ConverterProperties converterProperties = new ConverterProperties();
        HtmlConverter.convertToPdf(html, pdfOutputStream, converterProperties);

        // Return as downloadable PDF
        byte[] pdfBytes = pdfOutputStream.toByteArray();
        return pdfBytes;
    }

    public ProgressReportDTO getBatchProgressReportInRange(String packageSessionId, Date startDate, Date endDate, CustomUserDetails userDetails) {
        ReportFilterDTO reportFilterDTO = new ReportFilterDTO();
        reportFilterDTO.setPackageSessionId(packageSessionId);
        reportFilterDTO.setStartDate(startDate);
        reportFilterDTO.setEndDate(endDate);
        return batchReportService.getBatchReport(reportFilterDTO, userDetails);
    }

    public ProgressReportDTO getLearnerProgressReportInRange(ReportFilterDTO filterDTO, CustomUserDetails userDetails) {

        return learnerReportService.getLearnerProgressReport(filterDTO, userDetails);
    }

    public ReportFilterDTO getFilterDTO(String userId, String packageSessionId, Date startDate, Date endDate, CustomUserDetails userDetails) {
        ReportFilterDTO reportFilterDTO = new ReportFilterDTO();
        reportFilterDTO.setPackageSessionId(packageSessionId);
        reportFilterDTO.setStartDate(startDate);
        reportFilterDTO.setEndDate(endDate);
        reportFilterDTO.setUserId(userId);
        return reportFilterDTO;
    }

    public Boolean sendProgressReport(LmsReportNotificationDetailsDTO details, Date startDate, Date endDate, CustomUserDetails userDetails, String reportType) {
        if (!isValidDetails(details)) return false;

        String dateRange = formatDateRange(startDate, endDate);
        Set<String> instituteSettingNotificationTypes = extractInstituteNotificationTypes(details);

        for (LmsReportNotificationDetailsDTO.InstituteData.PackageSessionData packageSessionData : details.getInstituteData().getPackageSessions()) {
            if (packageSessionData == null) continue;

            ProgressReportDTO batchReport = getBatchProgressReportInRange(packageSessionData.getPackageSessionId(), startDate, endDate, userDetails);
            String pdfBatchBase64 = generateBatchReportPdf(details, dateRange, packageSessionData, batchReport);

            Map<String, AttachmentNotificationDTO> notificationMap = buildNotificationTemplates(details.getInstituteId(), reportType);
            Map<String, List<AttachmentUsersDTO>> userGroups = initializeUserGroups();

            for (LmsReportNotificationDetailsDTO.InstituteData.PackageSessionData.StudentData studentData :
                    Optional.ofNullable(packageSessionData.getStudents()).orElse(Collections.emptyList())) {

                ReportFilterDTO filterDTO = getFilterDTO(studentData.getUserId(), packageSessionData.getPackageSessionId(), startDate, endDate, userDetails);
                ProgressReportDTO learnerReport = getLearnerProgressReportInRange(filterDTO, userDetails);
                List<SlideProgressDateWiseDTO> slideProgressDTOS = getSlideProgressDTOsOfLearner(filterDTO, userDetails);
                String pdfLearnerBase64 = generateLearnerReportPdf(details, packageSessionData, studentData, batchReport, learnerReport, slideProgressDTOS);

                Set<String> types = extractStudentNotificationTypes(studentData, instituteSettingNotificationTypes);
                categorizeAndAddUser(types, userGroups, studentData, pdfBatchBase64, pdfLearnerBase64);
            }

            attachUsersToNotifications(notificationMap, userGroups);
            return notificationService.sendAttachmentEmail(new ArrayList<>(notificationMap.values()));
        }
        return true;
    }

    private boolean isValidDetails(LmsReportNotificationDetailsDTO details) {
        return details != null && details.getInstituteData() != null && details.getInstituteData().getPackageSessions() != null;
    }

    private String formatDateRange(Date startDate, Date endDate) {
        SimpleDateFormat dateFormat = new SimpleDateFormat("dd MMM yyyy");
        String formattedStartDate = dateFormat.format(startDate);
        String formattedEndDate = dateFormat.format(endDate);
        return isSameDay(startDate, endDate) ? formattedStartDate : formattedStartDate + " - " + formattedEndDate;
    }

    private Set<String> extractInstituteNotificationTypes(LmsReportNotificationDetailsDTO details) {
        return Optional.ofNullable(details.getInstituteData().getNotificationSettings())
                .orElse(Collections.emptyList())
                .stream()
                .map(LmsReportNotificationDetailsDTO.InstituteData.NotificationSetting::getType)
                .collect(Collectors.toSet());
    }

    private String generateBatchReportPdf(LmsReportNotificationDetailsDTO details, String dateRange,
                                          LmsReportNotificationDetailsDTO.InstituteData.PackageSessionData session,
                                          ProgressReportDTO batchReport) {
        String html = HtmlBuilderService.buildStyledHtmlReport("Batch Report", session.getBatch(), details.getInstituteName(), dateRange,
                batchReport.getPercentageCourseCompleted() != null ? String.valueOf(batchReport.getPercentageCourseCompleted()) : "0.00",
                batchReport.getAvgTimeSpentInMinutes(),
                batchReport.getPercentageConcentrationScore() != null ? String.valueOf(batchReport.getPercentageConcentrationScore()) : "0.00",
                batchReport.getDailyTimeSpent());
        return Base64.getEncoder().encodeToString(generatePdf(html));
    }

    private String generateLearnerReportPdf(LmsReportNotificationDetailsDTO details,
                                            LmsReportNotificationDetailsDTO.InstituteData.PackageSessionData session,
                                            LmsReportNotificationDetailsDTO.InstituteData.PackageSessionData.StudentData student,
                                            ProgressReportDTO batchReport, ProgressReportDTO learnerReport,
                                            List<SlideProgressDateWiseDTO> slides) {
        String html = HtmlBuilderService.buildEmailBodyForLearnerProgressReport("Learner Report", student.getFullName(),
                details.getInstituteName(), session.getBatch(),
                LocalDate.now().format(DateTimeFormatter.ofPattern("dd MMM yyyy")),
                batchReport, learnerReport, slides);
        return Base64.getEncoder().encodeToString(generatePdf(html));
    }

    private Map<String, AttachmentNotificationDTO> buildNotificationTemplates(String instituteId, String reportType) {
        String reportDate = LocalDate.now().format(DateTimeFormatter.ofPattern("dd MMM yyyy"));
        Map<String, AttachmentNotificationDTO> map = new HashMap<>();

        map.put("BatchAndLearnerToLearner", baseNotify(
                LmsReportNotificationEmailBody.buildEmailBody("Your " + reportType + " Report", "Your " + reportType + " Batch & Self Report",
                        "Dear Learner, Your batch and individual performance reports are attached.", reportType, reportDate),
                NotificationSourceEnum.LMS_REPORT.name(), instituteId, CommunicationType.EMAIL.name()));

        map.put("BatchToLearner", baseNotify(
                LmsReportNotificationEmailBody.buildEmailBody("Your " + reportType + " Report", "Your Batch Progress Report",
                        "Dear Learner, Attached is your batch-level performance report.", reportType, reportDate),
                NotificationSourceEnum.LMS_REPORT.name(), instituteId, CommunicationType.EMAIL.name()));

        map.put("LearnerToLearner", baseNotify(
                LmsReportNotificationEmailBody.buildEmailBody("Your " + reportType + " Report", "Your " + reportType + " Learning Report",
                        "Dear Learner, Attached is your learning progress report.", reportType, reportDate),
                NotificationSourceEnum.LMS_REPORT.name(), instituteId, CommunicationType.EMAIL.name()));

        map.put("BatchAndLearnerToParent", baseNotify(
                LmsReportNotificationEmailBody.buildEmailBody("Your Ward's " + reportType + " Report", "Ward's Batch & Self Report",
                        "Dear Parent, Your ward's batch and individual progress reports are attached.", reportType, reportDate),
                NotificationSourceEnum.LMS_REPORT.name(), instituteId, CommunicationType.EMAIL.name()));

        map.put("BatchToParent", baseNotify(
                LmsReportNotificationEmailBody.buildEmailBody("Your Ward's " + reportType + " Report", "Ward's Batch Progress Report",
                        "Dear Parent, Please find the batch progress report for your ward.", reportType, reportDate),
                NotificationSourceEnum.LMS_REPORT.name(), instituteId, CommunicationType.EMAIL.name()));

        map.put("LearnerToParent", baseNotify(
                LmsReportNotificationEmailBody.buildEmailBody("Your Ward's " + reportType + " Report", "Ward's Learning Report",
                        "Dear Parent, Please find your ward's individual progress report attached.", reportType, reportDate),
                NotificationSourceEnum.LMS_REPORT.name(), instituteId, CommunicationType.EMAIL.name()));

        return map;
    }

    private Map<String, List<AttachmentUsersDTO>> initializeUserGroups() {
        return Map.of(
                "BatchAndLearnerToLearner", new ArrayList<>(),
                "BatchToLearner", new ArrayList<>(),
                "LearnerToLearner", new ArrayList<>(),
                "BatchAndLearnerToParent", new ArrayList<>(),
                "BatchToParent", new ArrayList<>(),
                "LearnerToParent", new ArrayList<>()
        );
    }

    private Set<String> extractStudentNotificationTypes(LmsReportNotificationDetailsDTO.InstituteData.PackageSessionData.StudentData studentData,
                                                        Set<String> instituteDefaultTypes) {
        Set<String> types = Optional.ofNullable(studentData.getNotificationSettings())
                .orElse(Collections.emptyList())
                .stream()
                .map(LmsReportNotificationDetailsDTO.InstituteData.NotificationSetting::getType)
                .collect(Collectors.toSet());
        return types.isEmpty() ? instituteDefaultTypes : types;
    }

    private void categorizeAndAddUser(Set<String> types, Map<String, List<AttachmentUsersDTO>> groupMap,
                                      LmsReportNotificationDetailsDTO.InstituteData.PackageSessionData.StudentData student,
                                      String batchPdf, String learnerPdf) {
        if (types.contains("LEARNER_PROGRESS_REPORT") && types.contains("BATCH_PROGRESS_REPORT")) {
            groupMap.get("BatchAndLearnerToLearner").add(buildUserAttachment(student.getUserId(), student.getFullName(), student.getParentEmail(),
                    Map.of("BatchReport.pdf", batchPdf, "LearnerReport.pdf", learnerPdf)));
        } else if (types.contains("LEARNER_PROGRESS_REPORT")) {
            groupMap.get("LearnerToLearner").add(buildUserAttachment(student.getUserId(), student.getFullName(), student.getParentEmail(),
                    Map.of("LearnerReport.pdf", learnerPdf)));
        } else if (types.contains("BATCH_PROGRESS_REPORT")) {
            groupMap.get("BatchToLearner").add(buildUserAttachment(student.getUserId(), student.getFullName(), student.getParentEmail(),
                    Map.of("BatchReport.pdf", batchPdf)));
        }

        if (types.contains("LEARNER_PROGRESS_REPORT_FOR_PARENT") && types.contains("BATCH_PROGRESS_REPORT_FOR_PARENT")) {
            groupMap.get("BatchAndLearnerToParent").add(buildUserAttachment(null, student.getFullName(), student.getParentEmail(),
                    Map.of("BatchReport.pdf", batchPdf, "LearnerReport.pdf", learnerPdf)));
        } else if (types.contains("LEARNER_PROGRESS_REPORT_FOR_PARENT")) {
            groupMap.get("LearnerToParent").add(buildUserAttachment(null, student.getFullName(), student.getParentEmail(),
                    Map.of("LearnerReport.pdf", learnerPdf)));
        } else if (types.contains("BATCH_PROGRESS_REPORT_FOR_PARENT")) {
            groupMap.get("BatchToParent").add(buildUserAttachment(null, student.getFullName(), student.getParentEmail(),
                    Map.of("BatchReport.pdf", batchPdf)));
        }
    }

    private void attachUsersToNotifications(Map<String, AttachmentNotificationDTO> notifyMap,
                                            Map<String, List<AttachmentUsersDTO>> groupMap) {
        groupMap.forEach((key, users) -> notifyMap.get(key).setUsers(users));
    }

    private List<SlideProgressDateWiseDTO> getSlideProgressDTOsOfLearner(ReportFilterDTO filterDTO, CustomUserDetails userDetails) {
        return learnerReportService.getSlideProgressForLearner(filterDTO, userDetails);
    }

    private AttachmentUsersDTO buildUserAttachment(String userId, String fullName, String email, Map<String, String> base64AttachmentAndName) {
        AttachmentUsersDTO dto = new AttachmentUsersDTO();
        dto.setUserId(userId);
        dto.setChannelId(email);
        dto.setPlaceholders(Map.of("name", fullName));
        List<AttachmentUsersDTO.AttachmentDTO> attachments = base64AttachmentAndName.entrySet().stream().map(entry -> {
            AttachmentUsersDTO.AttachmentDTO attachmentDTO = new AttachmentUsersDTO.AttachmentDTO();
            attachmentDTO.setAttachmentName(entry.getKey());
            attachmentDTO.setAttachment(entry.getValue());
            return attachmentDTO;
        }).collect(Collectors.toList());
        dto.setAttachments(attachments);
        return dto;
    }

    private AttachmentNotificationDTO baseNotify(String body, String source, String sourceId, String notificationType) {
        return AttachmentNotificationDTO.builder()
                .source(source)
                .sourceId(sourceId)
                .notificationType(notificationType)
                .body(body)
                .subject("Progress Report")
                .build();
    }

    private boolean isSameDay(Date date1, Date date2) {
        SimpleDateFormat dateFormat = new SimpleDateFormat("yyyyMMdd");
        return dateFormat.format(date1).equals(dateFormat.format(date2));
    }


}
