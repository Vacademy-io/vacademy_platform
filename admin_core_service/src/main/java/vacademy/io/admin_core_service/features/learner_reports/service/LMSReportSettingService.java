package vacademy.io.admin_core_service.features.learner_reports.service;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.learner_reports.dto.report_notification.LmsReportNotificationSettingDTO;
import vacademy.io.admin_core_service.features.notification.entity.NotificationSetting;
import vacademy.io.admin_core_service.features.notification.enums.CommunicationType;
import vacademy.io.admin_core_service.features.notification.enums.NotificationSettingStatusEnum;
import vacademy.io.admin_core_service.features.notification.enums.NotificationSourceEnum;
import vacademy.io.admin_core_service.features.notification.enums.NotificationType;
import vacademy.io.admin_core_service.features.notification.repository.NotificationSettingRepository;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

import java.util.Arrays;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class LMSReportSettingService {

    private final NotificationSettingRepository notificationSettingRepository;

    public void createDefaultLmsReportSettingForInstitute(String instituteId) {
        List<NotificationType> types = Arrays.asList(
                NotificationType.BATCH_PROGRESS_REPORT,
                NotificationType.LEARNER_PROGRESS_REPORT,
                NotificationType.BATCH_PROGRESS_REPORT_FOR_PARENT,
                NotificationType.LEARNER_PROGRESS_REPORT_FOR_PARENT
        );

        for (NotificationType type : types) {
            notificationSettingRepository.save(buildDefaultSetting(type, instituteId));
        }
    }

    private NotificationSetting buildDefaultSetting(NotificationType type, String sourceId) {
        NotificationSetting setting = new NotificationSetting();
        setting.setDaily(true);
        setting.setWeekly(true);
        setting.setMonthly(true);
        setting.setType(type.name());
        setting.setSource(NotificationSourceEnum.INSTITUTE.name());
        setting.setSourceId(sourceId);
        setting.setStatus(NotificationSettingStatusEnum.ACTIVE.name());
        setting.setCommaSeparatedCommunicationTypes(CommunicationType.EMAIL.name() + "," + CommunicationType.WHATSAPP.name());
        return setting;
    }

    @Transactional
    public String addOrUpdateInstituteLmsReportSetting(LmsReportNotificationSettingDTO lmsReportNotificationSettingDTO, String instituteId, CustomUserDetails user) {
        LmsReportNotificationSettingDTO.ReportNotificationSetting studentSetting = lmsReportNotificationSettingDTO.getLearnerSetting();
        addOrUpdateInstituteLmsReportSetting(instituteId, NotificationSourceEnum.INSTITUTE.name(), NotificationType.LEARNER_PROGRESS_REPORT.name(), studentSetting.getCommaSeparatedCommunicationTypes(), studentSetting.getLearnerProgressReport(), studentSetting.getCommaSeparatedEmailIds(), studentSetting.getCommaSeparatedMobileNumber());
        addOrUpdateInstituteLmsReportSetting(instituteId, NotificationSourceEnum.INSTITUTE.name(), NotificationType.BATCH_PROGRESS_REPORT.name(), studentSetting.getCommaSeparatedCommunicationTypes(), studentSetting.getBatchProgressReport(), studentSetting.getCommaSeparatedEmailIds(), studentSetting.getCommaSeparatedMobileNumber());

        LmsReportNotificationSettingDTO.ReportNotificationSetting parentSetting = lmsReportNotificationSettingDTO.getParentSetting(); // 🔁 Corrected here
        addOrUpdateInstituteLmsReportSetting(instituteId, NotificationSourceEnum.INSTITUTE.name(), NotificationType.LEARNER_PROGRESS_REPORT_FOR_PARENT.name(), parentSetting.getCommaSeparatedCommunicationTypes(), parentSetting.getLearnerProgressReport(), parentSetting.getCommaSeparatedEmailIds(), parentSetting.getCommaSeparatedMobileNumber());
        addOrUpdateInstituteLmsReportSetting(instituteId, NotificationSourceEnum.INSTITUTE.name(), NotificationType.BATCH_PROGRESS_REPORT_FOR_PARENT.name(), parentSetting.getCommaSeparatedCommunicationTypes(), parentSetting.getBatchProgressReport(), parentSetting.getCommaSeparatedEmailIds(), parentSetting.getCommaSeparatedMobileNumber());

        return "success";
    }

    public void addOrUpdateInstituteLmsReportSetting(String sourceId, String source, String type, String communicationTypes, LmsReportNotificationSettingDTO.NotificationFrequency frequency,String commaSeparatedEmailId,String commaSeparatedMobileNumber) {
        NotificationSetting notificationSetting = notificationSettingRepository
                .findBySourceAndSourceIdAndTypeAndStatusIn(source, sourceId, type, List.of(NotificationSettingStatusEnum.ACTIVE.name()))
                .orElseGet(() -> {
                    NotificationSetting newSetting = new NotificationSetting();
                    newSetting.setSource(source);
                    newSetting.setSourceId(sourceId);
                    newSetting.setType(type);
                    newSetting.setStatus(NotificationSettingStatusEnum.ACTIVE.name());
                    return newSetting;
                });
        notificationSetting.setCommaSeparatedCommunicationTypes(communicationTypes);
        notificationSetting.setMonthly(frequency.getMonthly());
        notificationSetting.setDaily(frequency.getDaily());
        notificationSetting.setWeekly(frequency.getWeekly());
        notificationSetting.setCommaSeparatedEmailIds(commaSeparatedEmailId);
        notificationSetting.setCommaSeparatedMobileNumbers(commaSeparatedMobileNumber);
        notificationSettingRepository.save(notificationSetting);
    }

    public String addOrUpdateLmsReportSetting(LmsReportNotificationSettingDTO lmsReportNotificationSettingDTO, String userId,CustomUserDetails user){
        LmsReportNotificationSettingDTO.ReportNotificationSetting studentSetting = lmsReportNotificationSettingDTO.getLearnerSetting();
        addOrUpdateInstituteLmsReportSetting(userId, NotificationSourceEnum.LEARNER.name(), NotificationType.LEARNER_PROGRESS_REPORT.name(), studentSetting.getCommaSeparatedCommunicationTypes(), studentSetting.getLearnerProgressReport(),studentSetting.getCommaSeparatedEmailIds(),studentSetting.getCommaSeparatedMobileNumber());
        addOrUpdateInstituteLmsReportSetting(userId, NotificationSourceEnum.LEARNER.name(), NotificationType.BATCH_PROGRESS_REPORT.name(), studentSetting.getCommaSeparatedCommunicationTypes(), studentSetting.getBatchProgressReport(),studentSetting.getCommaSeparatedEmailIds(),studentSetting.getCommaSeparatedMobileNumber());

        LmsReportNotificationSettingDTO.ReportNotificationSetting parentSetting = lmsReportNotificationSettingDTO.getParentSetting();
        addOrUpdateInstituteLmsReportSetting(userId, NotificationSourceEnum.LEARNER.name(), NotificationType.LEARNER_PROGRESS_REPORT_FOR_PARENT.name(), parentSetting.getCommaSeparatedCommunicationTypes(), parentSetting.getLearnerProgressReport(),parentSetting.getCommaSeparatedEmailIds(),parentSetting.getCommaSeparatedMobileNumber());
        addOrUpdateInstituteLmsReportSetting(userId, NotificationSourceEnum.LEARNER.name(), NotificationType.BATCH_PROGRESS_REPORT_FOR_PARENT.name(), parentSetting.getCommaSeparatedCommunicationTypes(), parentSetting.getBatchProgressReport(),parentSetting.getCommaSeparatedEmailIds(),parentSetting.getCommaSeparatedMobileNumber());

        return "success";
    }

    public LmsReportNotificationSettingDTO getLmsReportNotificationSettingForInstitute(String instituteId, CustomUserDetails userDetails) {
        LmsReportNotificationSettingDTO dto = new LmsReportNotificationSettingDTO();
        dto.setLearnerSetting(buildReportSetting(NotificationSourceEnum.INSTITUTE.name(), instituteId, false));
        dto.setParentSetting(buildReportSetting(NotificationSourceEnum.INSTITUTE.name(), instituteId, true));
        return dto;
    }

    public LmsReportNotificationSettingDTO getLmsReportNotificationSettingForLearner(String userId,String instituteId, CustomUserDetails userDetails) {
        LmsReportNotificationSettingDTO dto = new LmsReportNotificationSettingDTO();

        Optional<NotificationSetting>optionalNotificationSetting = notificationSettingRepository.findBySourceAndSourceIdAndTypeAndStatusIn(
                NotificationSourceEnum.LEARNER.name(),
                userId,
                NotificationType.LEARNER_PROGRESS_REPORT.name(),
                List.of(NotificationSettingStatusEnum.ACTIVE.name())
        );
        if (optionalNotificationSetting.isPresent()) {
            dto.setLearnerSetting(buildReportSetting(NotificationSourceEnum.LEARNER.name(), userId, false));
            dto.setParentSetting(buildReportSetting(NotificationSourceEnum.LEARNER.name(), userId, true));
        }
        else{
            dto.setLearnerSetting(buildReportSetting(NotificationSourceEnum.INSTITUTE.name(), instituteId, false));
            dto.setParentSetting(buildReportSetting(NotificationSourceEnum.INSTITUTE.name(), instituteId, true));
        }
        return dto;
    }

    private LmsReportNotificationSettingDTO.ReportNotificationSetting buildReportSetting(String source, String sourceId, boolean isParent) {
        NotificationType learnerType = isParent ? NotificationType.LEARNER_PROGRESS_REPORT_FOR_PARENT : NotificationType.LEARNER_PROGRESS_REPORT;
        NotificationType batchType = isParent ? NotificationType.BATCH_PROGRESS_REPORT_FOR_PARENT : NotificationType.BATCH_PROGRESS_REPORT;

        NotificationSetting learnerSetting = getNotificationSettingBySourceAndSourceIdAndType(source, sourceId, learnerType.name());
        NotificationSetting batchSetting = getNotificationSettingBySourceAndSourceIdAndType(source, sourceId, batchType.name());

        return LmsReportNotificationSettingDTO.ReportNotificationSetting.builder()
                .commaSeparatedCommunicationTypes(learnerSetting.getCommaSeparatedCommunicationTypes())
                .commaSeparatedEmailIds(learnerSetting.getCommaSeparatedEmailIds())
                .commaSeparatedMobileNumber(learnerSetting.getCommaSeparatedMobileNumbers())
                .learnerProgressReport(mapToFrequency(learnerSetting))
                .batchProgressReport(mapToFrequency(batchSetting))
                .build();
    }

    private LmsReportNotificationSettingDTO.NotificationFrequency mapToFrequency(NotificationSetting setting) {
        return LmsReportNotificationSettingDTO.NotificationFrequency.builder()
                .daily(setting.getDaily())
                .weekly(setting.getWeekly())
                .monthly(setting.getMonthly())
                .build();
    }

    public NotificationSetting getNotificationSettingBySourceAndSourceIdAndType(String source, String sourceId, String type) {
        return notificationSettingRepository
                .findBySourceAndSourceIdAndTypeAndStatusIn(source, sourceId, type, List.of(NotificationSettingStatusEnum.ACTIVE.name()))
                .orElseThrow(() -> new VacademyException("Notification Setting not found"));
    }

}
