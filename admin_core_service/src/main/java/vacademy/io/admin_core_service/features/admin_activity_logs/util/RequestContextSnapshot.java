package vacademy.io.admin_core_service.features.admin_activity_logs.util;

import lombok.Builder;
import lombok.Value;

/**
 * Immutable snapshot of the request-scoped fields the aspect needs to write
 * an audit row. Captured synchronously on the request thread (since
 * {@code RequestContextHolder} is thread-bound) and passed to the writer.
 */
@Value
@Builder
public class RequestContextSnapshot {
    String instituteId;
    String actorId;
    String actorName;
    String actorEmail;
    String httpMethod;
    String endpoint;
    String ipAddress;
    String userAgent;
}
