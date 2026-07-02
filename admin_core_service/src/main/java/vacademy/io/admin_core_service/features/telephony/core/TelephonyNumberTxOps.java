package vacademy.io.admin_core_service.features.telephony.core;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.telephony.controller.dto.TelephonyProviderNumberDTO;
import vacademy.io.admin_core_service.features.telephony.persistence.entity.InstituteTelephonyConfig;
import vacademy.io.admin_core_service.features.telephony.persistence.entity.TelephonyProviderNumber;
import vacademy.io.admin_core_service.features.telephony.persistence.repository.InstituteTelephonyConfigRepository;
import vacademy.io.admin_core_service.features.telephony.persistence.repository.TelephonyProviderNumberRepository;
import vacademy.io.common.exceptions.VacademyException;

/**
 * Holds the @Transactional persistence methods for ExoPhone CRUD. Separate
 * bean because the controller calls them from public endpoints that also
 * make an external Exotel HTTP attach call — and we want the DB transaction
 * to commit BEFORE the network call so a slow Exotel API doesn't tie up a
 * connection or roll back an otherwise-successful save.
 *
 * Same Spring-proxy workaround used by {@code CallLifecycleTxOps} and
 * {@code InboundRoutingService.InboundCallLogPersister}: invoking a
 * @Transactional method on the same bean from within the same bean skips
 * the proxy and the annotation has no effect.
 */
@Service
public class TelephonyNumberTxOps {

    @Autowired private TelephonyProviderNumberRepository numberRepo;
    @Autowired private InstituteTelephonyConfigRepository configRepo;
    @Autowired private TelephonyConfigCache configCache;

    @Transactional
    public TelephonyProviderNumber create(TelephonyProviderNumberDTO body) {
        InstituteTelephonyConfig cfg = configRepo.findByInstituteId(body.getInstituteId())
                .orElseThrow(() -> new VacademyException(
                        "Configure provider for this institute before adding numbers"));
        TelephonyProviderNumber n = TelephonyProviderNumber.builder()
                .configId(cfg.getId())
                .instituteId(cfg.getInstituteId())
                .providerType(cfg.getProviderType())
                .phoneNumber(body.getPhoneNumber())
                .providerResourceId(body.getProviderResourceId())
                .label(body.getLabel())
                .region(body.getRegion())
                .priority(body.getPriority() == null ? 100 : body.getPriority())
                .enabled(body.getEnabled() == null ? Boolean.TRUE : body.getEnabled())
                .inboundIvrMenuId(blankToNull(body.getInboundIvrMenuId()))
                .build();
        TelephonyProviderNumber saved = numberRepo.save(n);
        configCache.evict(cfg.getInstituteId());
        return saved;
    }

    @Transactional
    public TelephonyProviderNumber update(String id, TelephonyProviderNumberDTO body) {
        TelephonyProviderNumber n = numberRepo.findById(id)
                .orElseThrow(() -> new VacademyException("Number not found"));
        if (body.getLabel()    != null) n.setLabel(body.getLabel());
        if (body.getRegion()   != null) n.setRegion(body.getRegion());
        if (body.getPriority() != null) n.setPriority(body.getPriority());
        if (body.getEnabled()  != null) n.setEnabled(body.getEnabled());
        if (body.getProviderResourceId() != null) {
            String trimmed = body.getProviderResourceId().trim();
            n.setProviderResourceId(trimmed.isEmpty() ? null : trimmed);
        }
        // Non-null (incl. empty string) = explicit set; empty clears back to default.
        if (body.getInboundIvrMenuId() != null) {
            n.setInboundIvrMenuId(blankToNull(body.getInboundIvrMenuId()));
        }
        TelephonyProviderNumber saved = numberRepo.save(n);
        configCache.evict(saved.getInstituteId());
        return saved;
    }

    @Transactional
    public void delete(String id, String instituteId) {
        numberRepo.deleteById(id);
        configCache.evict(instituteId);
    }

    private static String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }
}
