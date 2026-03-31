package vacademy.io.notification_service.features.send.service;

import vacademy.io.notification_service.features.send.dto.UnifiedSendRequest;
import vacademy.io.notification_service.features.send.dto.UnifiedSendResponse;

/**
 * Interface so BatchProcessorService can call back into channel routing
 * without circular dependency on UnifiedSendService.
 */
public interface SendChannelRouter {
    UnifiedSendResponse routeSync(UnifiedSendRequest request);
}
