package vacademy.io.admin_core_service.features.learner_reports.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.learner_reports.dto.report_notification.LmsReportNotificationSettingDTO;
import vacademy.io.admin_core_service.features.learner_reports.service.LMSReportSettingService;
import vacademy.io.common.auth.model.CustomUserDetails;

@RestController
@RequestMapping("/admin-core-service/lms-report-setting")
@RequiredArgsConstructor
public class LmsReportSettingController {

    private final LMSReportSettingService lmsReportSettingService;

    // Update or add settings for institute
    @PostMapping("/institute/{instituteId}/update")
    public String updateInstituteReportSettings(
            @PathVariable String instituteId,
            @RequestBody LmsReportNotificationSettingDTO dto,
            @RequestAttribute("user") CustomUserDetails user
    ) {
        return lmsReportSettingService.addOrUpdateInstituteLmsReportSetting(dto, instituteId, user);
    }

    // Update or add settings for learner
    @PostMapping("/learner/update")
    public String updateLearnerReportSettings(
            @RequestParam String userId,
            @RequestBody LmsReportNotificationSettingDTO dto,
            @RequestAttribute("user") CustomUserDetails user
    ) {
        return lmsReportSettingService.addOrUpdateLmsReportSetting(dto, userId, user);
    }
}