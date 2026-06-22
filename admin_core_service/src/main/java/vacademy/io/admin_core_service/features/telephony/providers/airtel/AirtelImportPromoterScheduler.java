package vacademy.io.admin_core_service.features.telephony.providers.airtel;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.Limit;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.telephony.persistence.entity.AirtelCallImport;
import vacademy.io.admin_core_service.features.telephony.persistence.repository.AirtelCallImportRepository;

import java.util.List;

/**
 * Drains RECEIVED {@code airtel_call_import} rows through {@link AirtelImportPromoter}
 * (each row in its own transaction). Runs slightly after the import poll so CDRs
 * land before their recordings are matched. Inert unless the importer is enabled.
 */
@Component
@ConditionalOnProperty(prefix = "telephony.airtel.s3", name = "enabled", havingValue = "true")
public class AirtelImportPromoterScheduler {

    private static final Logger log = LoggerFactory.getLogger(AirtelImportPromoterScheduler.class);

    @Autowired private AirtelCallImportRepository importRepo;
    @Autowired private AirtelImportPromoter promoter;

    @Value("${telephony.airtel.promote.max-per-run:200}")
    private int maxPerRun;

    @Scheduled(
            fixedDelayString = "${telephony.airtel.promote.poll-ms:120000}",
            initialDelayString = "${telephony.airtel.promote.initial-delay-ms:90000}")
    public void poll() {
        try {
            List<AirtelCallImport> batch = importRepo.findByProcessingStatusOrderByReceivedAtAsc(
                    AirtelCallImport.STATUS_RECEIVED, Limit.of(maxPerRun));
            int processed = 0;
            for (AirtelCallImport imp : batch) {
                promoter.promoteRow(imp.getId());   // cross-bean call → @Transactional applies
                processed++;
            }
            if (processed > 0) {
                log.info("Airtel promoter: processed {} staging row(s)", processed);
            }
        } catch (Exception e) {
            log.error("Airtel promoter poll failed: {}", e.getMessage(), e);
        }
    }
}
