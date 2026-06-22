package vacademy.io.admin_core_service.features.telephony.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.telephony.controller.dto.TelephonyCounsellorEndpointDTO;
import vacademy.io.admin_core_service.features.telephony.persistence.entity.TelephonyCounsellorEndpoint;
import vacademy.io.admin_core_service.features.telephony.persistence.repository.TelephonyCounsellorEndpointRepository;
import vacademy.io.common.exceptions.VacademyException;

import java.util.List;

/**
 * Admin API to map counsellors to their per-provider endpoint (extension + DID)
 * for no-pool providers (Airtel). JWT-gated (not in the public allowlist).
 */
@RestController
@RequestMapping("/admin-core-service/v1/telephony/counsellor-endpoints")
public class TelephonyCounsellorEndpointController {

    @Autowired private TelephonyCounsellorEndpointRepository repo;

    @GetMapping("/{instituteId}")
    public List<TelephonyCounsellorEndpointDTO> list(
            @PathVariable String instituteId,
            @RequestParam(value = "providerType", required = false, defaultValue = "AIRTEL") String providerType) {
        return repo.findByInstituteIdAndProviderType(instituteId, providerType.trim().toUpperCase())
                .stream().map(TelephonyCounsellorEndpointDTO::from).toList();
    }

    @PutMapping("/{instituteId}")
    @Transactional
    public TelephonyCounsellorEndpointDTO upsert(
            @PathVariable String instituteId,
            @RequestBody TelephonyCounsellorEndpointDTO body) {
        requireNonBlank(body.getCounsellorUserId(), "counsellorUserId is required");
        requireNonBlank(body.getProviderType(), "providerType is required");
        String providerType = body.getProviderType().trim().toUpperCase();

        TelephonyCounsellorEndpoint e = repo
                .findByCounsellorUserIdAndProviderType(body.getCounsellorUserId(), providerType)
                .orElseGet(TelephonyCounsellorEndpoint::new);
        e.setInstituteId(instituteId);
        e.setCounsellorUserId(body.getCounsellorUserId());
        e.setProviderType(providerType);
        if (body.getExtension() != null) e.setExtension(blankToNull(body.getExtension()));
        if (body.getProviderUserId() != null) e.setProviderUserId(blankToNull(body.getProviderUserId()));
        if (body.getDid() != null) e.setDid(blankToNull(body.getDid()));
        if (body.getEnabled() != null) e.setEnabled(body.getEnabled());

        return TelephonyCounsellorEndpointDTO.from(repo.save(e));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        repo.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    private static void requireNonBlank(String s, String msg) {
        if (s == null || s.isBlank()) throw new VacademyException(msg);
    }

    private static String blankToNull(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }
}
