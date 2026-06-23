package vacademy.io.admin_core_service.features.telephony.providers.airtel;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * Polls the Airtel CCR/CDR export bucket for new objects and hands each to
 * {@link AirtelCcrImportService} (idempotent by s3 key). Lists by recent date
 * prefixes ({@code <YYYYMMDD>/}) — the export is forward-fill, so old dates
 * never gain new objects; a small look-back absorbs the UTC/IST date boundary.
 *
 * Inert unless {@code telephony.airtel.s3.enabled=true}.
 */
@Component
@ConditionalOnProperty(prefix = "telephony.airtel.s3", name = "enabled", havingValue = "true")
public class AirtelCcrImportScheduler {

    private static final Logger log = LoggerFactory.getLogger(AirtelCcrImportScheduler.class);
    private static final DateTimeFormatter DATE_PREFIX = DateTimeFormatter.ofPattern("yyyyMMdd");

    @Autowired private AirtelCcrS3Reader s3;
    @Autowired private AirtelCcrImportService importService;

    @Value("${telephony.airtel.s3.lookback-days:2}")
    private int lookbackDays;

    @Value("${telephony.airtel.import.max-per-run:500}")
    private int maxPerRun;

    @Scheduled(
            fixedDelayString = "${telephony.airtel.import.poll-ms:120000}",
            initialDelayString = "${telephony.airtel.import.initial-delay-ms:60000}")
    public void poll() {
        try {
            int imported = 0;
            LocalDate today = LocalDate.now(ZoneOffset.UTC);
            for (int d = 0; d <= lookbackDays && imported < maxPerRun; d++) {
                String prefix = today.minusDays(d).format(DATE_PREFIX) + "/";
                List<String> keys = s3.listKeys(prefix);
                for (String key : keys) {
                    if (imported >= maxPerRun) break;
                    boolean target = (key.contains("/Cdr/") && key.endsWith(".json"))
                            || (key.contains("/Rec/") && key.endsWith(".mp3"));
                    if (!target) continue;
                    if (importService.importObject(key)) imported++;
                }
            }
            if (imported > 0) {
                log.info("Airtel CCR import: {} new object(s) ingested", imported);
            }
        } catch (Exception e) {
            log.error("Airtel CCR import poll failed: {}", e.getMessage(), e);
        }
    }
}
