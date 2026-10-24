package vacademy.io.admin_core_service.features.learner_management.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.user_subscription.service.PaymentDeletionService;
import vacademy.io.admin_core_service.features.user_subscription.service.UserPlanService;
import vacademy.io.common.exceptions.VacademyException;

import java.util.Map;

/**
 * Hard terminate + "delete payment history", in ONE transaction: if the history cannot be
 * deleted (an online payment, a referral reward, …) the termination is rolled back too, so the
 * admin never ends up with a removed course whose payments are still showing.
 */
@Service
@RequiredArgsConstructor
public class CourseRemovalHistoryService {

    private final UserPlanService userPlanService;
    private final PaymentDeletionService paymentDeletionService;

    @Transactional
    public Map<String, Object> terminateAndDeleteHistory(String userPlanId, String instituteId, String adminUserId) {
        // Refuse BEFORE terminating: cancelUserPlan fires the SUBSCRIPTION_TERMINATED workflow in its
        // own (REQUIRES_NEW) transaction, which a later rollback here would not take back.
        String blocker = paymentDeletionService.previewPlanHistory(userPlanId, instituteId).blocker();
        if (blocker != null) {
            throw new VacademyException(blocker);
        }
        userPlanService.cancelUserPlan(userPlanId, true);
        return paymentDeletionService.deletePlanHistory(userPlanId, instituteId, adminUserId);
    }
}
