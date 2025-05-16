package vacademy.io.admin_core_service.features.learner_invitation.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.learner_invitation.dto.*;
import vacademy.io.admin_core_service.features.learner_invitation.services.LearnerInvitationResponseService;
import vacademy.io.admin_core_service.features.learner_invitation.services.LearnerInvitationService;
import vacademy.io.common.auth.config.PageConstants;
import vacademy.io.common.auth.model.CustomUserDetails;

@RestController
@RequestMapping("/admin-core-service/learner-invitation")
public class LearnerInvitationController {

    @Autowired
    private LearnerInvitationService learnerInvitationService;

    @Autowired
    private LearnerInvitationResponseService learnerInvitationResponseService;

    @PostMapping("/create")
    public ResponseEntity<LearnerInvitationDTO> createInvitation(@RequestBody AddLearnerInvitationDTO addLearnerInvitationDTO,
                                                                 @RequestAttribute("user") CustomUserDetails user) {
        LearnerInvitationDTO learnerInvitationDTO = learnerInvitationService.createLearnerInvitationCode(addLearnerInvitationDTO, user);
        return ResponseEntity.ok(learnerInvitationDTO);
    }

    @PostMapping("/invitation-details")
    public Page<InvitationDetailProjection> getInvitationDetails(
            @RequestParam String instituteId,
            @RequestParam(required = false, defaultValue = PageConstants.DEFAULT_PAGE_NUMBER) int pageNo,
            @RequestParam(required = false, defaultValue = PageConstants.DEFAULT_PAGE_SIZE) int pageSize,
            @RequestBody LearnerInvitationDetailFilterDTO filterDTO,
            @RequestAttribute("user") CustomUserDetails user) {

        return learnerInvitationService.getInvitationDetails(instituteId, filterDTO, pageNo, pageSize, user);
    }

    @PostMapping("/invitation-responses")
    public ResponseEntity<Page<OneLearnerInvitationResponse>> getLearnerInvitationResponses(
            @RequestParam String instituteId,
            @RequestBody LearnerInvitationResponsesFilterDTO filterDTO,
            @RequestParam(defaultValue = PageConstants.DEFAULT_PAGE_NUMBER) int pageNo,
            @RequestParam(defaultValue = PageConstants.DEFAULT_PAGE_SIZE) int pageSize,
            @RequestAttribute("user") CustomUserDetails user) {

        Page<OneLearnerInvitationResponse> responses = learnerInvitationResponseService.getLearnerInvitationResponses(filterDTO, instituteId, pageNo, pageSize, user);
        return ResponseEntity.ok(responses);
    }

    @PutMapping("/update-learner-invitation-response-status")
    public ResponseEntity<String> updateLearnerInvitationResponseStatus(@RequestBody LearnerInvitationRequestStatusChangeDTO statusChangeDTO,
                                                                        @RequestAttribute("user") CustomUserDetails user) {
        String responseMessage = learnerInvitationResponseService.updateLearnerInvitationResponseStatus(statusChangeDTO, user);
        return ResponseEntity.ok(responseMessage);
    }

    @PutMapping("/update-learner-invitation-status")
    public ResponseEntity<String> updateLearnerInvitationStatus(@RequestBody LearnerInvitationStatusUpdateDTO statusChangeDTO,
                                                                @RequestAttribute("user") CustomUserDetails user) {
        String responseMessage = learnerInvitationService.updateLearnerInvitationStatus(statusChangeDTO, user);
        return ResponseEntity.ok(responseMessage);
    }

    @PutMapping("/update")
    public ResponseEntity<String> updateLearnerInvitation(@RequestBody LearnerInvitationDTO learnerInvitationDTO,
                                                          @RequestAttribute("user") CustomUserDetails user) {
        String response = learnerInvitationService.updateLearnerInvitation(learnerInvitationDTO, user);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/learner-invitation-detail-by-id")
    public ResponseEntity<LearnerInvitationDTO> getLearnerInvitation(@RequestParam String learnerInvitationId,
                                                                     @RequestAttribute("user") CustomUserDetails user) {
        LearnerInvitationDTO response = learnerInvitationService.getLearnerInvitationById(learnerInvitationId, user);
        return ResponseEntity.ok(response);
    }

}
