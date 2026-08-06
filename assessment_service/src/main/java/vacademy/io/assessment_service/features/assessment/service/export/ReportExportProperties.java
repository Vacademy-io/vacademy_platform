package vacademy.io.assessment_service.features.assessment.service.export;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Config rather than constants — batch size and the attempt cap depend on
 * per-render wall-clock cost that varies by environment (font rendering,
 * network egress availability), so prod must be tunable without a deploy.
 * See plan §8 / ARCHITECTURE.md §6 (PR4 created files table).
 */
@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "assessment.report-export")
public class ReportExportProperties {
    private int batchSize = 10;
    private long batchPauseMs = 300;
    private int maxAttempts = 150;
    private int staleJobMinutes = 20;
    private int maxRetry = 2;
    private int assemblyTimeoutSeconds = 180;
}
