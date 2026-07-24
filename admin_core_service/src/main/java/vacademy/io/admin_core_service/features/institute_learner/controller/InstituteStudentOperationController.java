package vacademy.io.admin_core_service.features.institute_learner.controller;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.admin_activity_logs.annotation.Auditable;
import vacademy.io.admin_core_service.features.institute_learner.dto.InstituteStudentDTO;
import vacademy.io.admin_core_service.features.institute_learner.dto.LearnerBatchRegisterRequestDTO;
import vacademy.io.admin_core_service.features.institute_learner.dto.StudentStatusUpdateRequestWrapper;
import vacademy.io.admin_core_service.features.institute_learner.manager.StudentSessionManager;
import vacademy.io.admin_core_service.features.institute_learner.service.LearnerSessionOperationService;
import vacademy.io.common.auth.model.CustomUserDetails;

@RestController
@RequestMapping("/admin-core-service/institute/institute_learner-operation/v1")
public class InstituteStudentOperationController {

    @Autowired
    private
    StudentSessionManager manager;

    @Autowired
    private LearnerSessionOperationService learnerSessionOperationService;

    /**
     * One mapping, six operations — so the audited action is derived from the
     * request's own {@code operation} field rather than fixed on the annotation,
     * keeping TERMINATE distinguishable from a batch move in the activity log.
     */
    @PostMapping("/update")
    @Auditable(
            entityType = "LEARNER",
            actionExpr = "#requestWrapper?.operation",
            descriptionExpr = "@auditNarrator.statusChangeFor(#requestWrapper?.operation, #requestWrapper?.requests)")
    public void updateStudentStatus(@RequestAttribute("user") CustomUserDetails user, @RequestBody StudentStatusUpdateRequestWrapper requestWrapper) {
        manager.updateStudentStatus(requestWrapper.getRequests(), requestWrapper.getOperation(), user);
    }


    @PostMapping("/add-package-sessions")
    @Auditable(
            entityType = "LEARNER",
            action = "ENROLL",
            descriptionExpr = "@auditNarrator.bulkEnrollmentOf('enrolled', #learnerBatchRegister?.userIds, "
                    + "#learnerBatchRegister?.learnerBatchRegisterInfos?.![packageSessionId])")
    public String addPackageSessionsToLearner(
            @RequestBody LearnerBatchRegisterRequestDTO learnerBatchRegister,
            @RequestAttribute("user") CustomUserDetails user) {

        return learnerSessionOperationService.addPackageSessionsToLearner(learnerBatchRegister, user);
    }

    @PostMapping("/re-enroll-learner")
    @Auditable(
            entityType = "LEARNER",
            action = "ENROLL",
            descriptionExpr = "@auditNarrator.enrollmentOf('re-enrolled', "
                    + "#instituteStudentDTO?.userDetails?.fullName ?: #instituteStudentDTO?.userDetails?.email, "
                    + "{#instituteStudentDTO?.instituteStudentDetails?.packageSessionId})")
    public ResponseEntity<?> reEnrollLearner(
            @RequestBody InstituteStudentDTO instituteStudentDTO,
            @RequestAttribute("user") CustomUserDetails user) {

        return ResponseEntity.ok(learnerSessionOperationService.reEnrollStudent(user, instituteStudentDTO));
    }

}
