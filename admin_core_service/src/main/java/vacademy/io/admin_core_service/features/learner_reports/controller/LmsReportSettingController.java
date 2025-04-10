package vacademy.io.admin_core_service.features.learner_reports.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
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
    @PostMapping("/institute/update/{instituteId}")
    public ResponseEntity<String> updateInstituteReportSettings(
            @PathVariable String instituteId,
            @RequestBody LmsReportNotificationSettingDTO dto,
            @RequestAttribute("user") CustomUserDetails user
    ) {
        return ResponseEntity.ok(lmsReportSettingService.addOrUpdateLmsReportSetting(dto, instituteId, user));
    }

    // Update or add settings for learner
    @PostMapping("/learner/update")
    public ResponseEntity<String> updateLearnerReportSettings(
            @RequestParam String userId,
            @RequestBody LmsReportNotificationSettingDTO dto,
            @RequestAttribute("user") CustomUserDetails user
    ) {
        return ResponseEntity.ok(lmsReportSettingService.addOrUpdateLmsReportSetting(dto, userId, user));
    }

    // Update or add settings for learner
    @GetMapping("/institute-setting")
    public ResponseEntity<LmsReportNotificationSettingDTO> getInstituteReportSettings(
            @RequestParam String instituteId,
            @RequestAttribute("user") CustomUserDetails user
    ) {
        return ResponseEntity.ok(lmsReportSettingService.getLmsReportNotificationSettingForInstitute(instituteId, user));
    }

    @GetMapping("/learner-setting")
    public ResponseEntity<LmsReportNotificationSettingDTO> getLearnerReportSettings(
            @RequestParam String userId,
            @RequestParam String instituteId,
            @RequestAttribute("user") CustomUserDetails user
    ) {
        return ResponseEntity.ok(lmsReportSettingService.getLmsReportNotificationSettingForLearner(userId,instituteId, user));
    }

}