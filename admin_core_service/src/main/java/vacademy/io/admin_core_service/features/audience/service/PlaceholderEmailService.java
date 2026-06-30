package vacademy.io.admin_core_service.features.audience.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.UUID;

/**
 * Single source of truth for "placeholder" emails — the deterministic, non-deliverable
 * addresses synthesized for webhook leads (chiefly Meta/Facebook lead ads) that arrive
 * without an email, so an auth account can still be created and the lead is ingested
 * instead of being dropped.
 *
 * <p>Centralized so EVERY email-resolution / send path detects and skips these addresses
 * using ONE configured domain: the webhook respondent "thank you", the bulk EMAIL blast
 * ({@code AudienceService.sendAudienceMessage}), the per-lead message variable resolver,
 * and the lead-status-change / SLA workflow context ({@code UserLeadProfileService}) all
 * share this logic. Detection is domain-based (no persisted marker / DB migration), so it
 * also covers leads created before this component existed.
 */
@Component
public class PlaceholderEmailService {

    /**
     * Domain used for synthesized placeholder emails. Configurable per environment; kept
     * non-deliverable by intent. Changing it does not retroactively reclassify addresses
     * minted under the previous domain, so prefer a stable value.
     */
    @Value("${audience.placeholder-email.domain:vacademy.com}")
    private String placeholderEmailDomain;

    public String getDomain() {
        return placeholderEmailDomain;
    }

    /**
     * Build a deterministic, collision-resistant placeholder email for a lead with no
     * email. Local-part priority (most-specific identity first):
     * <ol>
     *   <li>name + phone — deterministic per person; a resubmission from the same phone
     *       maps to the same email (and so the same user / dedups).</li>
     *   <li>name + platformLeadId — when there's no phone; unique per platform lead.</li>
     *   <li>name + random — last resort when neither phone nor platform id exists;
     *       guarantees two distinct leads never merge.</li>
     * </ol>
     * e.g. "Raj Singh" + "917999873846" -&gt; rajsingh917999873846@vacademy.com
     *
     * <p>The address is never emailed — every send path treats {@link #isPlaceholder}
     * addresses as "no email".
     */
    public String synthesize(String fullName, String phone, String platformLeadId) {
        String nameSlug = fullName == null ? "" : fullName.toLowerCase().replaceAll("[^a-z0-9]", "");
        if (nameSlug.isEmpty()) {
            nameSlug = "lead";
        }
        // Cap the name slug so an absurdly long name can't blow the local-part length limit.
        if (nameSlug.length() > 40) {
            nameSlug = nameSlug.substring(0, 40);
        }

        String phoneDigits = phone == null ? "" : phone.replaceAll("[^0-9]", "");

        String discriminator;
        if (!phoneDigits.isEmpty()) {
            discriminator = phoneDigits;
        } else if (StringUtils.hasText(platformLeadId)) {
            discriminator = platformLeadId.replaceAll("[^a-zA-Z0-9]", "");
        } else {
            discriminator = UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        }

        return nameSlug + discriminator + "@" + placeholderEmailDomain;
    }

    /**
     * True when an email is a synthesized placeholder (matches the configured placeholder
     * domain). Such addresses are non-deliverable and must be treated as "no email" by
     * every real send path. Returns false for null/blank input or when no domain is set.
     */
    public boolean isPlaceholder(String email) {
        if (!StringUtils.hasText(email) || !StringUtils.hasText(placeholderEmailDomain)) {
            return false;
        }
        return email.toLowerCase().endsWith("@" + placeholderEmailDomain.toLowerCase());
    }
}
