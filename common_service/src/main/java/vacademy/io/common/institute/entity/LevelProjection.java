package vacademy.io.common.institute.entity;

import org.springframework.beans.factory.annotation.Value;

public interface LevelProjection {
    String getId();

    @Value("#{target.level_name}")
    String getLevelName();

    Integer getDurationInDays();
}