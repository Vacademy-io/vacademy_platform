package vacademy.io.common.institute.entity;

import org.springframework.beans.factory.annotation.Value;

public interface SessionProjection {
        String getId();

        @Value("#{target.session_name}")
        String getSessionName();
        
        String getStatus();
    }