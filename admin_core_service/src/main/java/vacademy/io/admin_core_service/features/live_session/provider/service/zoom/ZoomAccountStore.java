package vacademy.io.admin_core_service.features.live_session.provider.service.zoom;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.live_session.provider.dto.zoom.ZoomAccount;
import vacademy.io.admin_core_service.features.live_session.provider.entity.LiveSessionProviderConfig;
import vacademy.io.admin_core_service.features.live_session.provider.repository.LiveSessionProviderConfigRepository;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.meeting.enums.MeetingProvider;

import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Persistence for Zoom accounts on the shared {@code institute_live_session_provider_mapping}
 * table (provider = ZOOM_MEETING) — one row per account, secrets stored
 * AES-encrypted inside config_json. Maps rows to/from {@link ZoomAccount} so the
 * rest of the Zoom code is agnostic to where credentials live.
 *
 * No dedicated table/migration: V164 already dropped the single-config-per-provider
 * constraint and added vendor_user_id + a partial unique index supporting many
 * rows per (institute, provider). We use vendor_user_id = the Zoom Account ID,
 * which doubles as a per-institute dedup guard.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ZoomAccountStore {

    private static final String PROVIDER = MeetingProvider.ZOOM_MEETING.name();
    private static final List<String> ACTIVE = List.of("ACTIVE");

    private final LiveSessionProviderConfigRepository repository;
    private final ObjectMapper objectMapper;

    // ── Reads ────────────────────────────────────────────────────────────────

    public List<ZoomAccount> listByInstitute(String instituteId) {
        return repository.findByInstituteIdAndStatusIn(instituteId, ACTIVE).stream()
                .filter(c -> PROVIDER.equals(c.getProvider()))
                .map(this::toAccount)
                .sorted((a, b) -> a.getLabel() == null ? 1
                        : a.getLabel().compareToIgnoreCase(b.getLabel() == null ? "" : b.getLabel()))
                .collect(Collectors.toList());
    }

    public Optional<ZoomAccount> findByIdAndInstitute(String id, String instituteId) {
        return repository.findById(id)
                .filter(c -> PROVIDER.equals(c.getProvider()) && instituteId.equals(c.getInstituteId()))
                .map(this::toAccount);
    }

    public Optional<ZoomAccount> findById(String id) {
        return repository.findById(id)
                .filter(c -> PROVIDER.equals(c.getProvider()))
                .map(this::toAccount);
    }

    public Optional<ZoomAccount> findDefault(String instituteId) {
        return listByInstitute(instituteId).stream().filter(ZoomAccount::isDefault).findFirst();
    }

    public Optional<ZoomAccount> findByInstituteAndZoomAccountId(String instituteId, String zoomAccountId) {
        return listByInstitute(instituteId).stream()
                .filter(a -> zoomAccountId.equals(a.getZoomAccountId()))
                .findFirst();
    }

    // ── Writes ───────────────────────────────────────────────────────────────

    public ZoomAccount create(ZoomAccount account) {
        LiveSessionProviderConfig row = LiveSessionProviderConfig.builder()
                .instituteId(account.getInstituteId())
                .provider(PROVIDER)
                .vendorUserId(account.getZoomAccountId()) // natural key + per-institute dedup
                .configJson(writeConfig(account))
                .status("ACTIVE")
                .updatedAt(new Date())
                .build();
        return toAccount(repository.save(row));
    }

    public ZoomAccount update(ZoomAccount account) {
        LiveSessionProviderConfig row = repository.findById(account.getId())
                .orElseThrow(() -> new VacademyException("Zoom account not found"));
        row.setVendorUserId(account.getZoomAccountId());
        row.setConfigJson(writeConfig(account));
        if (account.getStatus() != null) {
            row.setStatus(account.getStatus());
        }
        row.setUpdatedAt(new Date());
        return toAccount(repository.save(row));
    }

    public void delete(String id) {
        repository.deleteById(id);
    }

    /** Clears the default flag on every Zoom account for an institute. */
    public void clearDefault(String instituteId) {
        for (LiveSessionProviderConfig c : repository.findByInstituteIdAndStatusIn(instituteId, ACTIVE)) {
            if (!PROVIDER.equals(c.getProvider())) continue;
            ZoomAccount a = toAccount(c);
            if (a.isDefault()) {
                a.setIsDefault(false);
                c.setConfigJson(writeConfig(a));
                c.setUpdatedAt(new Date());
                repository.save(c);
            }
        }
    }

    // ── Mapping ──────────────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private ZoomAccount toAccount(LiveSessionProviderConfig row) {
        Map<String, Object> cfg;
        try {
            cfg = (row.getConfigJson() == null || row.getConfigJson().isBlank())
                    ? new LinkedHashMap<>()
                    : objectMapper.readValue(row.getConfigJson(), new TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            log.error("zoom.account parse failed for row {}: {}", row.getId(), e.getMessage());
            cfg = new LinkedHashMap<>();
        }

        Object lastVerified = cfg.get("lastVerifiedAt");
        return ZoomAccount.builder()
                .id(row.getId())
                .instituteId(row.getInstituteId())
                .status(row.getStatus())
                .createdAt(row.getCreatedAt())
                .label((String) cfg.get("label"))
                .zoomAccountId((String) cfg.getOrDefault("zoomAccountId", row.getVendorUserId()))
                .s2sClientId((String) cfg.get("s2sClientId"))
                .s2sClientSecretEnc((String) cfg.get("s2sClientSecretEnc"))
                .sdkClientKey((String) cfg.get("sdkClientKey"))
                .sdkClientSecretEnc((String) cfg.get("sdkClientSecretEnc"))
                .webhookVerificationTokenEnc((String) cfg.get("webhookVerificationTokenEnc"))
                .authType((String) cfg.getOrDefault("authType", "S2S"))
                .oauthRefreshTokenEnc((String) cfg.get("oauthRefreshTokenEnc"))
                .zoomUserId((String) cfg.get("zoomUserId"))
                .isDefault(Boolean.TRUE.equals(cfg.get("isDefault")))
                .lastVerifiedAt(lastVerified instanceof Number n ? new Date(n.longValue()) : null)
                .build();
    }

    private String writeConfig(ZoomAccount a) {
        Map<String, Object> cfg = new LinkedHashMap<>();
        cfg.put("label", a.getLabel());
        cfg.put("zoomAccountId", a.getZoomAccountId());
        cfg.put("s2sClientId", a.getS2sClientId());
        cfg.put("s2sClientSecretEnc", a.getS2sClientSecretEnc());
        cfg.put("sdkClientKey", a.getSdkClientKey());
        cfg.put("sdkClientSecretEnc", a.getSdkClientSecretEnc());
        cfg.put("webhookVerificationTokenEnc", a.getWebhookVerificationTokenEnc());
        cfg.put("authType", a.getAuthType());
        cfg.put("oauthRefreshTokenEnc", a.getOauthRefreshTokenEnc());
        cfg.put("zoomUserId", a.getZoomUserId());
        cfg.put("isDefault", a.isDefault());
        if (a.getLastVerifiedAt() != null) {
            cfg.put("lastVerifiedAt", a.getLastVerifiedAt().getTime());
        }
        try {
            return objectMapper.writeValueAsString(cfg);
        } catch (Exception e) {
            throw new VacademyException("Failed to serialize Zoom account config");
        }
    }
}
