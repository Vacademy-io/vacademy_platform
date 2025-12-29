package vacademy.io.admin_core_service.features.enrollment_policy.notification;

import vacademy.io.admin_core_service.features.enrollment_policy.dto.NotificationConfigDTO;
import vacademy.io.admin_core_service.features.enrollment_policy.dto.NotificationPolicyDTO;
import vacademy.io.admin_core_service.features.enrollment_policy.processor.EnrolmentContext;

public interface INotificationService {
    /**
     * Sends notification with policy information (includes template name and
     * channel configuration).
     * Each implementation should process the channels it supports from the policy's
     * notifications list.
     */
    void sendNotification(EnrolmentContext context, NotificationPolicyDTO policy);
}
