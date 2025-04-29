package vacademy.io.assessment_service.features.announcement.controller;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.assessment_service.features.announcement.dto.AddAnnouncementDTO;
import vacademy.io.assessment_service.features.announcement.service.AnnouncementService;
import vacademy.io.common.auth.model.CustomUserDetails;

@RestController
@RequestMapping("/assessment-service/assessment/announcement/v1")
public class AddAnnouncementController {

    @Autowired
    AnnouncementService announcementService;


    @PostMapping("/add")
    public ResponseEntity<String> addAnnouncement(@RequestAttribute("user") CustomUserDetails user,
                                                  @RequestBody AddAnnouncementDTO addAccessAssessmentDetailsDTO,
                                                  @RequestParam(name = "assessmentId", required = false) String assessmentId,
                                                  @RequestParam(name = "instituteId", required = false) String instituteId) {
        return announcementService.addAnnouncement(user, addAccessAssessmentDetailsDTO, assessmentId, instituteId);
    }

}
