package vacademy.io.admin_core_service.features.slide.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.slide.dto.LinkedAssessmentSlideDTO;
import vacademy.io.admin_core_service.features.slide.dto.SlideDTO;
import vacademy.io.admin_core_service.features.slide.service.AssessmentSlideService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

@RestController
@RequestMapping("/admin-core-service/slide/assessment-slide")
public class AssessmentSlideController {

    @Autowired
    private AssessmentSlideService assessmentSlideService;

    @PostMapping("/add-or-update")
    public String addOrUpdateAssessmentSlide(@RequestBody SlideDTO slideDTO,
                                             @RequestParam String chapterId,
                                             @RequestParam String instituteId,
                                             @RequestParam String packageSessionId,
                                             @RequestParam String subjectId,
                                             @RequestParam String moduleId,
                                             @RequestAttribute("user") CustomUserDetails userDetails) {
        return assessmentSlideService.addOrUpdateAssessmentSlide(
                slideDTO, chapterId, packageSessionId, moduleId, subjectId, userDetails);
    }

    /**
     * Which course slides launch this assessment. Called before deleting an
     * assessment so the confirm dialog can name the course content that goes
     * with it instead of asking the admin to confirm a blind cascade.
     */
    @GetMapping("/linked-slides")
    public ResponseEntity<List<LinkedAssessmentSlideDTO>> getLinkedSlides(
            @RequestParam String assessmentId,
            @RequestAttribute("user") CustomUserDetails userDetails) {
        return ResponseEntity.ok(assessmentSlideService.getSlidesForAssessment(assessmentId));
    }

    /**
     * Delete every course slide that launches this assessment. Paired with the
     * assessment delete in the Assessments tab so the two halves of a
     * slide-created assessment don't outlive each other.
     *
     * @return the number of slides deleted
     */
    @DeleteMapping("/linked-slides")
    public ResponseEntity<Integer> deleteLinkedSlides(
            @RequestParam String assessmentId,
            @RequestAttribute("user") CustomUserDetails userDetails) {
        return ResponseEntity.ok(assessmentSlideService.deleteSlidesForAssessment(assessmentId));
    }
}
