package vacademy.io.admin_core_service.features.telephony.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.telephony.controller.dto.TelephonyProviderNumberDTO;
import vacademy.io.admin_core_service.features.telephony.core.TelephonyConfigCache;
import vacademy.io.admin_core_service.features.telephony.persistence.entity.InstituteTelephonyConfig;
import vacademy.io.admin_core_service.features.telephony.persistence.entity.TelephonyProviderNumber;
import vacademy.io.admin_core_service.features.telephony.persistence.repository.InstituteTelephonyConfigRepository;
import vacademy.io.admin_core_service.features.telephony.persistence.repository.TelephonyProviderNumberRepository;
import vacademy.io.common.exceptions.VacademyException;

import java.util.List;

@RestController
@RequestMapping("/admin-core-service/v1/telephony/numbers")
public class TelephonyNumberController {

    @Autowired private TelephonyProviderNumberRepository numberRepo;
    @Autowired private InstituteTelephonyConfigRepository configRepo;
    @Autowired private TelephonyConfigCache configCache;

    @GetMapping
    public ResponseEntity<List<TelephonyProviderNumberDTO>> list(
            @RequestParam("instituteId") String instituteId) {
        return ResponseEntity.ok(
                numberRepo.findByInstituteId(instituteId).stream()
                        .map(TelephonyProviderNumberDTO::from)
                        .toList());
    }

    @PostMapping
    @Transactional
    public ResponseEntity<TelephonyProviderNumberDTO> create(
            @RequestBody TelephonyProviderNumberDTO body) {
        if (body.getInstituteId() == null || body.getInstituteId().isBlank()) {
            throw new VacademyException("instituteId is required");
        }
        InstituteTelephonyConfig cfg = configRepo.findByInstituteId(body.getInstituteId())
                .orElseThrow(() -> new VacademyException(
                        "Configure provider for this institute before adding numbers"));
        if (body.getPhoneNumber() == null || body.getPhoneNumber().isBlank()) {
            throw new VacademyException("phoneNumber is required");
        }
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
                .build();
        TelephonyProviderNumber saved = numberRepo.save(n);
        configCache.evict(cfg.getInstituteId());
        return ResponseEntity.ok(TelephonyProviderNumberDTO.from(saved));
    }

    @PutMapping("/{id}")
    @Transactional
    public ResponseEntity<TelephonyProviderNumberDTO> update(
            @PathVariable String id,
            @RequestBody TelephonyProviderNumberDTO body) {
        TelephonyProviderNumber n = numberRepo.findById(id)
                .orElseThrow(() -> new VacademyException("Number not found"));
        if (body.getLabel()    != null) n.setLabel(body.getLabel());
        if (body.getRegion()   != null) n.setRegion(body.getRegion());
        if (body.getPriority() != null) n.setPriority(body.getPriority());
        if (body.getEnabled()  != null) n.setEnabled(body.getEnabled());
        TelephonyProviderNumber saved = numberRepo.save(n);
        configCache.evict(saved.getInstituteId());
        return ResponseEntity.ok(TelephonyProviderNumberDTO.from(saved));
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<Void> delete(@PathVariable String id) {
        String instituteId = numberRepo.findById(id)
                .map(TelephonyProviderNumber::getInstituteId).orElse(null);
        numberRepo.deleteById(id);
        configCache.evict(instituteId);
        return ResponseEntity.noContent().build();
    }
}
