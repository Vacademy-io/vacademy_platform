package vacademy.io.admin_core_service.features.live_session.provider.entity;

import jakarta.persistence.*;
import lombok.*;

import java.util.Date;

/**
 * Simple key-value config table for runtime settings.
 * Avoids needing env vars or redeployment for config changes.
 */
@Entity
@Table(name = "app_config")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AppConfig {

    @Id
    @Column(name = "config_key", length = 50)
    private String configKey;

    @Column(name = "config_value", nullable = false, length = 255)
    private String configValue;

    @Column(name = "description", length = 255)
    private String description;

    @Column(name = "updated_at")
    private Date updatedAt;

    public int getIntValue(int defaultValue) {
        try {
            return Integer.parseInt(configValue);
        } catch (Exception e) {
            return defaultValue;
        }
    }
}
