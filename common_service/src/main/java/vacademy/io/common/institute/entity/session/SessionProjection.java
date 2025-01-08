package vacademy.io.common.institute.entity.session;

import org.springframework.beans.factory.annotation.Value;

public interface SessionProjection {
    String getId();

    @Value("#{target.session_name}")
    String getSessionName();

    String getStatus();
}