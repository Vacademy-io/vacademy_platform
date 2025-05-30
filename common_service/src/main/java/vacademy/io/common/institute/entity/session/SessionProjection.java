package vacademy.io.common.institute.entity.session;

import org.springframework.beans.factory.annotation.Value;

import java.sql.Date;

public interface SessionProjection {
    String getId();

    @Value("#{target.session_name}")
    String getSessionName();

    String getStatus();

    @Value("#{target.start_date}")
    Date getStartDate();
}