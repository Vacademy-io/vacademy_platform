package vacademy.io.admin_core_service.features.white_label.service;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;
import vacademy.io.admin_core_service.features.white_label.dto.WhiteLabelSetupResponse;

import java.util.List;
import java.util.Map;

/**
 * Thin wrapper around the Cloudflare DNS API.
 *
 * All tokens are read from env variables:
 * CLOUDFLARE_API_TOKEN – scoped Zone:DNS:Edit for the Vacademy zones
 * CLOUDFLARE_ZONE_ID – zone that owns *.vacademy.io (and can also create
 * CNAME proxies for customer-added domains inside the same zone)
 *
 * For fully custom external domains (e.g. learn.myschool.com) the institute
 * admin
 * must point their domain's CNAME at our Cloudflare Worker / origin. We still
 * create the record on our end so that Cloudflare's proxy handles routing.
 *
 * NOTE: Cloudflare API reference:
 * https://developers.cloudflare.com/api/operations/dns-records-for-a-zone-list-dns-records
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CloudflareService {

    private static final String CF_API_BASE = "https://api.cloudflare.com/client/v4";

    @Value("${cloudflare.api.token}")
    private String apiToken;

    @Value("${cloudflare.zone.id}")
    private String zoneId;

    private final RestTemplate restTemplate;

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Returns true only when both Cloudflare credentials are present in the
     * environment.
     * Deployments that don't have CLOUDFLARE_API_TOKEN / CLOUDFLARE_ZONE_ID set
     * will
     * always return false — the white-label DNS feature is disabled for them.
     */
    public boolean isEnabled() {
        return StringUtils.hasText(apiToken) && StringUtils.hasText(zoneId);
    }

    /**
     * Creates or updates a proxied CNAME record in Cloudflare.
     *
     * @param name   DNS name e.g. "learn.myschool.com" or "myschool.vacademy.io"
     * @param target CNAME target, e.g. "learner.vacademy.io"
     * @return result describing the action taken
     */
    public WhiteLabelSetupResponse.DnsRecordResult upsertCname(String name, String target) {
        String existingId = findExistingRecord(name);
        if (existingId != null) {
            return updateCname(existingId, name, target);
        } else {
            return createCname(name, target);
        }
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private HttpHeaders authHeaders() {
        HttpHeaders h = new HttpHeaders();
        h.setBearerAuth(apiToken);
        h.setContentType(MediaType.APPLICATION_JSON);
        return h;
    }

    /**
     * Returns the Cloudflare record ID if a record for `name` already exists, else
     * null.
     */
    private String findExistingRecord(String name) {
        try {
            String url = CF_API_BASE + "/zones/" + zoneId + "/dns_records?type=CNAME&name=" + name;
            ResponseEntity<CfListResponse> resp = restTemplate.exchange(
                    url, HttpMethod.GET,
                    new HttpEntity<>(authHeaders()),
                    CfListResponse.class);
            CfListResponse body = resp.getBody();
            if (body != null && body.getResult() != null && !body.getResult().isEmpty()) {
                return body.getResult().get(0).getId();
            }
        } catch (Exception e) {
            log.warn("[CloudflareService] Could not check existing record for name={}: {}", name, e.getMessage());
        }
        return null;
    }

    private WhiteLabelSetupResponse.DnsRecordResult createCname(String name, String target) {
        String url = CF_API_BASE + "/zones/" + zoneId + "/dns_records";
        Map<String, Object> body = Map.of(
                "type", "CNAME",
                "name", name,
                "content", target,
                "proxied", true,
                "ttl", 1 // 1 = auto in Cloudflare
        );
        try {
            ResponseEntity<CfSingleResponse> resp = restTemplate.exchange(
                    url, HttpMethod.POST,
                    new HttpEntity<>(body, authHeaders()),
                    CfSingleResponse.class);
            CfSingleResponse r = resp.getBody();
            String recordId = (r != null && r.getResult() != null) ? r.getResult().getId() : null;
            log.info("[CloudflareService] Created CNAME {} → {} (id={})", name, target, recordId);
            return buildResult("CREATED", name, target, recordId);
        } catch (HttpClientErrorException e) {
            log.error("[CloudflareService] Failed to create CNAME {} → {}: {}", name, target,
                    e.getResponseBodyAsString());
            throw new RuntimeException("Cloudflare DNS create failed for " + name + ": " + e.getResponseBodyAsString());
        }
    }

    private WhiteLabelSetupResponse.DnsRecordResult updateCname(String recordId, String name, String target) {
        String url = CF_API_BASE + "/zones/" + zoneId + "/dns_records/" + recordId;
        Map<String, Object> body = Map.of(
                "type", "CNAME",
                "name", name,
                "content", target,
                "proxied", true,
                "ttl", 1);
        try {
            restTemplate.exchange(url, HttpMethod.PUT,
                    new HttpEntity<>(body, authHeaders()),
                    Void.class);
            log.info("[CloudflareService] Updated CNAME {} → {} (id={})", name, target, recordId);
            return buildResult("UPDATED", name, target, recordId);
        } catch (HttpClientErrorException e) {
            log.error("[CloudflareService] Failed to update CNAME {} (id={}): {}", name, recordId,
                    e.getResponseBodyAsString());
            throw new RuntimeException("Cloudflare DNS update failed for " + name + ": " + e.getResponseBodyAsString());
        }
    }

    private WhiteLabelSetupResponse.DnsRecordResult buildResult(String action, String name, String target, String id) {
        return WhiteLabelSetupResponse.DnsRecordResult.builder()
                .type("CNAME")
                .name(name)
                .target(target)
                .proxied(true)
                .cloudflareRecordId(id)
                .action(action)
                .build();
    }

    // ── Inner types for Cloudflare API JSON ───────────────────────────────────

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    static class CfListResponse {
        private List<CfRecord> result;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    static class CfSingleResponse {
        private CfRecord result;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    static class CfRecord {
        private String id;
        private String name;
        private String content;

        @JsonProperty("zone_id")
        private String zoneId;
    }
}
